import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * These go through the public API with a fake Redis rather than testing a key
 * builder, because the bug this module prevents lives in the *sequence* —
 * acquire, run, release — not in any one call. A test that asserted "the key
 * is sync:lock:<id>" would have passed against every broken version of this
 * file I could write.
 *
 * The fake implements the three Redis behaviours the lock depends on:
 *   - SET NX returns null instead of "OK" when the key exists,
 *   - EVAL runs a compare-and-delete,
 *   - EX sets a TTL (recorded, so the caller's value can be asserted).
 */

interface SetOpts { nx?: boolean; ex?: number }

const store = new Map<string, string>();
const ttls = new Map<string, number>();
let evalScripts: string[] = [];
let setShouldThrow = false;
let evalShouldThrow = false;

vi.mock("@upstash/redis", () => ({
  Redis: class {
    async set(key: string, value: string, opts?: SetOpts): Promise<string | null> {
      if (setShouldThrow) throw new Error("redis unreachable");
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      if (opts?.ex !== undefined) ttls.set(key, opts.ex);
      return "OK";
    }
    async eval(script: string, keys: string[], args: string[]): Promise<number> {
      if (evalShouldThrow) throw new Error("redis unreachable");
      evalScripts.push(script);
      // Compare-and-delete, the semantics RELEASE_SCRIPT must implement.
      if (store.get(keys[0]) === args[0]) {
        store.delete(keys[0]);
        return 1;
      }
      return 0;
    }
  },
}));

beforeEach(() => {
  store.clear();
  ttls.clear();
  evalScripts = [];
  setShouldThrow = false;
  evalShouldThrow = false;
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  vi.resetModules();
});

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.restoreAllMocks();
});

async function load() {
  return import("./sync-lock");
}

/** A promise you can resolve from the outside, to hold a lock open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("withWorkspaceSyncLock", () => {
  it("runs the work and returns its result when the lock is free", async () => {
    const { withWorkspaceSyncLock } = await load();

    const outcome = await withWorkspaceSyncLock("ws_1", async () => "synced");

    expect(outcome).toEqual({ ran: true, result: "synced" });
  });

  it("refuses a second run for the same workspace while the first is in flight", async () => {
    const { withWorkspaceSyncLock } = await load();
    const gate = deferred<string>();

    let secondRan = false;

    const first = withWorkspaceSyncLock("ws_1", () => gate.promise);
    // Give the first call a turn so it has actually acquired the lock.
    await Promise.resolve();
    await Promise.resolve();

    const second = await withWorkspaceSyncLock("ws_1", async () => {
      secondRan = true;
      return "should not happen";
    });

    expect(second).toEqual({ ran: false, reason: "already_running" });
    // The point of the lock: the work function itself must not execute. A
    // version that returned `ran: false` but still called `work` would pass
    // every assertion about the return value and none of the ones that matter.
    expect(secondRan).toBe(false);

    gate.resolve("done");
    await expect(first).resolves.toEqual({ ran: true, result: "done" });
  });

  it("does not block a DIFFERENT workspace", async () => {
    const { withWorkspaceSyncLock } = await load();
    const gate = deferred<string>();

    const first = withWorkspaceSyncLock("ws_1", () => gate.promise);
    await Promise.resolve();
    await Promise.resolve();

    const other = await withWorkspaceSyncLock("ws_2", async () => "ok");
    expect(other).toEqual({ ran: true, result: "ok" });

    gate.resolve("done");
    await first;
  });

  it("releases the lock so the next sync can acquire it", async () => {
    const { withWorkspaceSyncLock } = await load();

    await withWorkspaceSyncLock("ws_1", async () => "first");
    const second = await withWorkspaceSyncLock("ws_1", async () => "second");

    expect(second).toEqual({ ran: true, result: "second" });
  });

  it("releases the lock when the work throws, and rethrows", async () => {
    const { withWorkspaceSyncLock } = await load();

    await expect(
      withWorkspaceSyncLock("ws_1", async () => { throw new Error("store timed out"); }),
    ).rejects.toThrow("store timed out");

    // Without the finally, one failed sync would wedge the workspace for the
    // whole TTL — and sync failures are the norm, not the exception (a store
    // 500, a revoked Play Console invite).
    const next = await withWorkspaceSyncLock("ws_1", async () => "recovered");
    expect(next).toEqual({ ran: true, result: "recovered" });
  });

  it("sets a TTL so a killed run cannot wedge the workspace forever", async () => {
    const { withWorkspaceSyncLock, SYNC_LOCK_TTL_SECONDS } = await load();
    let ttlDuringRun: number | undefined;

    await withWorkspaceSyncLock("ws_1", async () => {
      ttlDuringRun = ttls.get("sync:lock:ws_1");
      return null;
    });

    expect(ttlDuringRun).toBe(SYNC_LOCK_TTL_SECONDS);
    // The sync route declares maxDuration = 60; a TTL at or below that could
    // expire while the run it guards is still going.
    expect(SYNC_LOCK_TTL_SECONDS).toBeGreaterThan(60);
  });

  it("releases with a compare-and-delete, never a bare DEL", async () => {
    const { withWorkspaceSyncLock } = await load();

    await withWorkspaceSyncLock("ws_1", async () => null);

    expect(evalScripts).toHaveLength(1);
    const script = evalScripts[0];
    // If a run overruns the TTL, the key it would delete belongs to the NEXT
    // holder — a bare DEL would let a third run start alongside them, so the
    // lock would cause the very race it exists to prevent.
    expect(script).toContain('redis.call("get", KEYS[1]) == ARGV[1]');
    expect(script).toContain('redis.call("del", KEYS[1])');
  });

  it("does not delete a lock it no longer owns", async () => {
    const { withWorkspaceSyncLock } = await load();
    const gate = deferred<null>();

    const slow = withWorkspaceSyncLock("ws_1", () => gate.promise);
    await Promise.resolve();
    await Promise.resolve();

    // Simulate the TTL expiring mid-run and a second worker taking the lock.
    store.set("sync:lock:ws_1", "someone-elses-token");

    gate.resolve(null);
    await slow;

    // The slow run's release must have been a no-op.
    expect(store.get("sync:lock:ws_1")).toBe("someone-elses-token");
  });

  it("runs unlocked when Redis is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    const { withWorkspaceSyncLock } = await load();

    // Local dev has no Upstash credentials. Refusing to sync there would make
    // the whole product untestable locally.
    const outcome = await withWorkspaceSyncLock("ws_1", async () => "ran anyway");
    expect(outcome).toEqual({ ran: true, result: "ran anyway" });
  });

  it("runs unlocked when acquiring the lock throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { withWorkspaceSyncLock } = await load();
    setShouldThrow = true;

    // Fail OPEN. A lock that takes review sync offline whenever Upstash has a
    // bad minute is a worse trade than the race it prevents — and unlocked is
    // exactly the behaviour that shipped before this module existed.
    const outcome = await withWorkspaceSyncLock("ws_1", async () => "ran anyway");
    expect(outcome).toEqual({ ran: true, result: "ran anyway" });
  });

  it("still returns the result when releasing the lock throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { withWorkspaceSyncLock } = await load();
    evalShouldThrow = true;

    // A failed release is survivable — the TTL clears it. A failed release
    // that swallowed the sync's result would not be.
    const outcome = await withWorkspaceSyncLock("ws_1", async () => "synced");
    expect(outcome).toEqual({ ran: true, result: "synced" });
  });
});
