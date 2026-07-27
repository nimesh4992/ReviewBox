import { describe, expect, it } from "vitest";

import {
  TICKET_BODY_MAX,
  TICKET_SUBJECT_MAX,
  isMissingTableError,
  mapTicketMessageRow,
  mapTicketRow,
  parseManualTicketInput,
  parseTicketInput,
  parseTicketMessageInput,
  parseTicketUpdate,
} from "./support-tickets";

describe("parseTicketInput", () => {
  it("accepts a valid payload and trims whitespace", () => {
    const result = parseTicketInput({ subject: "  Sync broken  ", body: "  It stopped.  " });
    expect(result).toEqual({ ok: true, value: { subject: "Sync broken", body: "It stopped." } });
  });

  it.each([null, undefined, "hi", 42, []])("rejects non-object body %p", (raw) => {
    expect(parseTicketInput(raw as unknown).ok).toBe(false);
  });

  it("rejects a missing or blank subject", () => {
    expect(parseTicketInput({ body: "x" }).ok).toBe(false);
    expect(parseTicketInput({ subject: "   ", body: "x" }).ok).toBe(false);
  });

  it("rejects a missing or blank message", () => {
    expect(parseTicketInput({ subject: "x" }).ok).toBe(false);
    expect(parseTicketInput({ subject: "x", body: "  " }).ok).toBe(false);
  });

  it("rejects over-length fields", () => {
    expect(parseTicketInput({ subject: "s".repeat(TICKET_SUBJECT_MAX + 1), body: "x" }).ok).toBe(false);
    expect(parseTicketInput({ subject: "x", body: "b".repeat(TICKET_BODY_MAX + 1) }).ok).toBe(false);
  });

  it("rejects non-string subject/body instead of coercing", () => {
    expect(parseTicketInput({ subject: 123, body: "x" }).ok).toBe(false);
    expect(parseTicketInput({ subject: "x", body: { toString: () => "x" } }).ok).toBe(false);
  });
});

describe("parseManualTicketInput", () => {
  const valid = {
    subject: "Refund question",
    body: "Customer emailed asking about refunds.",
    requesterEmail: "dev@example.com",
  };

  it("accepts a valid payload with defaults", () => {
    const result = parseManualTicketInput(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe("normal");
      expect(result.value.source).toBe("manual");
      expect(result.value.requesterName).toBeNull();
    }
  });

  it("rejects a missing or malformed email", () => {
    expect(parseManualTicketInput({ ...valid, requesterEmail: undefined }).ok).toBe(false);
    expect(parseManualTicketInput({ ...valid, requesterEmail: "not-an-email" }).ok).toBe(false);
    expect(parseManualTicketInput({ ...valid, requesterEmail: "a@b" }).ok).toBe(false);
  });

  it("keeps a recognized priority and source", () => {
    const result = parseManualTicketInput({ ...valid, priority: "urgent", source: "email" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe("urgent");
      expect(result.value.source).toBe("email");
    }
  });

  it("never accepts in_app as an admin-logged source", () => {
    const result = parseManualTicketInput({ ...valid, source: "in_app" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.source).toBe("manual");
  });

  it("falls back to defaults on unknown priority/source", () => {
    const result = parseManualTicketInput({ ...valid, priority: "asap", source: "carrier-pigeon" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priority).toBe("normal");
      expect(result.value.source).toBe("manual");
    }
  });
});

describe("parseTicketUpdate", () => {
  it("accepts status-only, priority-only, and both", () => {
    expect(parseTicketUpdate({ status: "resolved" })).toEqual({ ok: true, value: { status: "resolved" } });
    expect(parseTicketUpdate({ priority: "high" })).toEqual({ ok: true, value: { priority: "high" } });
    expect(parseTicketUpdate({ status: "closed", priority: "low" })).toEqual({
      ok: true,
      value: { status: "closed", priority: "low" },
    });
  });

  it("rejects unknown status or priority values", () => {
    expect(parseTicketUpdate({ status: "reopened" }).ok).toBe(false);
    expect(parseTicketUpdate({ priority: "critical" }).ok).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(parseTicketUpdate({}).ok).toBe(false);
    expect(parseTicketUpdate({ unrelated: true }).ok).toBe(false);
  });
});

describe("parseTicketMessageInput", () => {
  it("accepts a reply and defaults isInternal to false", () => {
    expect(parseTicketMessageInput({ body: "On it." })).toEqual({
      ok: true,
      value: { body: "On it.", isInternal: false },
    });
  });

  it("only honours isInternal when it is literally true", () => {
    const internal = parseTicketMessageInput({ body: "note", isInternal: true });
    expect(internal.ok && internal.value.isInternal).toBe(true);
    const truthy = parseTicketMessageInput({ body: "note", isInternal: "yes" });
    expect(truthy.ok && !truthy.value.isInternal).toBe(true);
  });

  it("rejects blank and over-length messages", () => {
    expect(parseTicketMessageInput({ body: "  " }).ok).toBe(false);
    expect(parseTicketMessageInput({ body: "b".repeat(TICKET_BODY_MAX + 1) }).ok).toBe(false);
  });
});

describe("isMissingTableError", () => {
  it("matches only Postgres 42P01", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "42703" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
    expect(isMissingTableError({})).toBe(false);
  });
});

describe("row mappers", () => {
  it("maps a ticket row with embedded workspace", () => {
    const ticket = mapTicketRow({
      id: "t1",
      workspace_id: "w1",
      workspaces: { name: "Acme" },
      requester_email: "a@b.co",
      requester_name: null,
      subject: "Help",
      status: "open",
      priority: "normal",
      source: "in_app",
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
      last_message_at: "2026-07-27T01:00:00Z",
    });
    expect(ticket.workspaceName).toBe("Acme");
    expect(ticket.lastMessageAt).toBe("2026-07-27T01:00:00Z");
  });

  it("handles a workspace-less ticket and missing last_message_at", () => {
    const ticket = mapTicketRow({
      id: "t2",
      workspace_id: null,
      requester_email: "a@b.co",
      subject: "Hi",
      status: "open",
      priority: "low",
      source: "email",
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
      last_message_at: null,
    });
    expect(ticket.workspaceId).toBeNull();
    expect(ticket.workspaceName).toBeNull();
    expect(ticket.lastMessageAt).toBe("2026-07-27T00:00:00Z");
  });

  it("maps a message row, treating non-boolean is_internal as false", () => {
    const msg = mapTicketMessageRow({
      id: "m1",
      ticket_id: "t1",
      author_type: "admin",
      author_name: "ReviewBox",
      body: "Done.",
      is_internal: null,
      created_at: "2026-07-27T00:00:00Z",
    });
    expect(msg.isInternal).toBe(false);
    expect(msg.authorType).toBe("admin");
  });
});
