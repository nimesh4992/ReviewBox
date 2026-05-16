/**
 * App Store Connect API client
 *
 * Auth: JWT signed with ES256 (ECDSA P-256) using the workspace's .p8 private key.
 * Each JWT is valid for 20 minutes (Apple limit).
 *
 * Docs: https://developer.apple.com/documentation/appstoreconnectapi
 */

const BASE = "https://api.appstoreconnect.apple.com/v1";

// ── JWT ───────────────────────────────────────────────────────────────────────

function b64url(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Decode base64 string into a plain ArrayBuffer (avoids Uint8Array<ArrayBufferLike> generics). */
function b64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

/**
 * Build and sign an App Store Connect JWT.
 * keyId    — from App Store Connect → Users & Access → Keys
 * issuerId — shown next to the key list
 * p8Key    — contents of the .p8 file (include header/footer)
 */
export async function buildJWT(
  keyId: string,
  issuerId: string,
  p8Key: string,
): Promise<string> {
  const pemBody = p8Key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const keyBuf  = b64ToBuffer(pemBody); // plain ArrayBuffer

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "ES256", kid: keyId };
  const payload = { iss: issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" };

  const enc = new TextEncoder();
  const h   = b64url(enc.encode(JSON.stringify(header)));
  const p   = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    enc.encode(`${h}.${p}`),
  );

  return `${h}.${p}.${b64url(sig)}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function asc<T>(path: string, jwt: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`App Store Connect ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AscReview {
  id: string;
  attributes: {
    rating: number;
    title: string | null;
    body: string;
    reviewerNickname: string;
    createdDate: string;
    territory: string;
  };
  relationships?: {
    response?: {
      data: { id: string; type: string } | null;
    };
  };
}

/**
 * Resolve the numeric App Store app ID from a bundle ID.
 * Returns null if the app isn't found under this key's account.
 */
export async function fetchAppStoreId(
  bundleId: string,
  jwt: string,
): Promise<string | null> {
  try {
    const data = await asc<{ data: { id: string }[] }>(
      `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=id`,
      jwt,
    );
    return data.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the most recent customer reviews for an app.
 * appStoreId — the numeric ID returned by fetchAppStoreId()
 */
export async function fetchReviews(
  appStoreId: string,
  jwt: string,
  limit = 200,
): Promise<AscReview[]> {
  const results: AscReview[] = [];
  let url: string | null =
    `/apps/${appStoreId}/customerReviews?sort=-createdDate&limit=${Math.min(limit, 200)}&fields[customerReviews]=rating,title,body,reviewerNickname,createdDate,territory,response`;

  type PageResp = { data: AscReview[]; links?: { next?: string } };
  while (url && results.length < limit) {
    const page: PageResp = await asc<PageResp>(url, jwt);
    results.push(...page.data);
    const next: string | undefined = page.links?.next;
    url = next ? next.replace(BASE, "") : null;
  }

  return results.slice(0, limit);
}

/**
 * Submit or update a developer reply to a customer review.
 * Returns the response ID on success.
 */
export async function submitReply(
  reviewId: string,
  replyText: string,
  jwt: string,
): Promise<string> {
  const data = await asc<{ data: { id: string } }>(
    "/customerReviewResponses",
    jwt,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "customerReviewResponses",
          attributes: { body: replyText },
          relationships: {
            review: { data: { type: "customerReviews", id: reviewId } },
          },
        },
      }),
    },
  );
  return data.data.id;
}

/**
 * Delete an existing developer reply.
 */
export async function deleteReply(responseId: string, jwt: string): Promise<void> {
  await fetch(`${BASE}/customerReviewResponses/${responseId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  });
}
