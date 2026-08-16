import type {
  ReviewPriority,
  SupportTicket,
  SupportTicketAuthor,
  SupportTicketMessage,
  SupportTicketSource,
  SupportTicketStatus,
} from "@/types/review";

// Vocabulary mirrors the CHECK constraints in migration 017 — change both
// together or inserts start failing.
export const TICKET_STATUSES: SupportTicketStatus[] = ["open", "pending", "resolved", "closed"];
export const TICKET_PRIORITIES: ReviewPriority[] = ["urgent", "high", "normal", "low"];
export const TICKET_SOURCES: SupportTicketSource[] = ["in_app", "email", "manual"];

export const TICKET_SUBJECT_MAX = 200;
export const TICKET_BODY_MAX = 5000;
export const TICKET_EMAIL_MAX = 320;

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface TicketInput {
  subject: string;
  body: string;
}

/** Validate the customer-facing create payload (subject + first message). */
export function parseTicketInput(raw: unknown): ParseResult<TicketInput> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const record = raw as Record<string, unknown>;
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";

  if (!subject) return { ok: false, message: "Subject is required." };
  if (!body) return { ok: false, message: "Message is required." };
  if (subject.length > TICKET_SUBJECT_MAX) {
    return { ok: false, message: `Subject must be ${TICKET_SUBJECT_MAX} characters or fewer.` };
  }
  if (body.length > TICKET_BODY_MAX) {
    return { ok: false, message: `Message must be ${TICKET_BODY_MAX} characters or fewer.` };
  }
  return { ok: true, value: { subject, body } };
}

export interface ManualTicketInput extends TicketInput {
  requesterEmail: string;
  requesterName: string | null;
  priority: ReviewPriority;
  source: SupportTicketSource;
}

/** Validate the admin "log a ticket" payload (requests arriving by email). */
export function parseManualTicketInput(raw: unknown): ParseResult<ManualTicketInput> {
  const base = parseTicketInput(raw);
  if (!base.ok) return base;

  const record = raw as Record<string, unknown>;
  const requesterEmail =
    typeof record.requesterEmail === "string" ? record.requesterEmail.trim() : "";
  if (!requesterEmail || requesterEmail.length > TICKET_EMAIL_MAX || !EMAIL_SHAPE.test(requesterEmail)) {
    return { ok: false, message: "A valid requester email is required." };
  }

  const requesterName =
    typeof record.requesterName === "string" && record.requesterName.trim()
      ? record.requesterName.trim().slice(0, 120)
      : null;

  const priority = (
    typeof record.priority === "string" && (TICKET_PRIORITIES as string[]).includes(record.priority)
      ? record.priority
      : "normal"
  ) as ReviewPriority;

  // Admin-logged tickets are things that arrived outside the app; "in_app" is
  // reserved for the customer-facing route.
  const source = (
    typeof record.source === "string" && record.source !== "in_app" &&
    (TICKET_SOURCES as string[]).includes(record.source)
      ? record.source
      : "manual"
  ) as SupportTicketSource;

  return {
    ok: true,
    value: { ...base.value, requesterEmail, requesterName, priority, source },
  };
}

export interface TicketUpdate {
  status?: SupportTicketStatus;
  priority?: ReviewPriority;
}

/** Validate a PATCH payload. At least one recognized field must be present. */
export function parseTicketUpdate(raw: unknown): ParseResult<TicketUpdate> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const record = raw as Record<string, unknown>;
  const value: TicketUpdate = {};

  if (record.status !== undefined) {
    if (typeof record.status !== "string" || !(TICKET_STATUSES as string[]).includes(record.status)) {
      return { ok: false, message: `status must be one of: ${TICKET_STATUSES.join(", ")}.` };
    }
    value.status = record.status as SupportTicketStatus;
  }
  if (record.priority !== undefined) {
    if (typeof record.priority !== "string" || !(TICKET_PRIORITIES as string[]).includes(record.priority)) {
      return { ok: false, message: `priority must be one of: ${TICKET_PRIORITIES.join(", ")}.` };
    }
    value.priority = record.priority as ReviewPriority;
  }

  if (value.status === undefined && value.priority === undefined) {
    return { ok: false, message: "Nothing to update — provide status and/or priority." };
  }
  return { ok: true, value };
}

export interface TicketMessageInput {
  body: string;
  isInternal: boolean;
}

/** Validate an admin thread message (reply or internal note). */
export function parseTicketMessageInput(raw: unknown): ParseResult<TicketMessageInput> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const record = raw as Record<string, unknown>;
  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (!body) return { ok: false, message: "Message is required." };
  if (body.length > TICKET_BODY_MAX) {
    return { ok: false, message: `Message must be ${TICKET_BODY_MAX} characters or fewer.` };
  }
  return { ok: true, value: { body, isInternal: record.isInternal === true } };
}

/**
 * True when the error means migration 017 hasn't been applied yet. Callers
 * degrade gracefully instead of 500ing — same pattern the Competitors screen
 * uses for migration 016.
 *
 * Lives in `@/lib/db-errors` now, alongside the missing-COLUMN check: both
 * have a Postgres form and a PostgREST schema-cache form, and checking only
 * one of the two is what took onboarding down. Re-exported here so the ticket
 * call sites keep reading naturally.
 */
export { isMissingTableError } from "./db-errors";

/** Map a support_tickets row (snake_case, optionally with embedded workspace). */
export function mapTicketRow(row: Record<string, unknown>): SupportTicket {
  const workspace = row.workspaces as { name?: string } | null | undefined;
  return {
    id: row.id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    workspaceName: workspace?.name ?? null,
    requesterEmail: row.requester_email as string,
    requesterName: (row.requester_name as string | null) ?? null,
    subject: row.subject as string,
    status: row.status as SupportTicketStatus,
    priority: row.priority as ReviewPriority,
    source: row.source as SupportTicketSource,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastMessageAt: (row.last_message_at as string) ?? (row.created_at as string),
  };
}

/** Map a support_ticket_messages row. */
export function mapTicketMessageRow(row: Record<string, unknown>): SupportTicketMessage {
  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    authorType: row.author_type as SupportTicketAuthor,
    authorName: (row.author_name as string | null) ?? null,
    body: row.body as string,
    isInternal: row.is_internal === true,
    createdAt: row.created_at as string,
  };
}
