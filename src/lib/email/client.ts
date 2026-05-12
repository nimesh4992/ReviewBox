import { Resend } from "resend";

export const FROM = "Revi <hello@revi.app>"; // update domain when live

// Lazy singleton — avoids build-time crash when RESEND_API_KEY is not set
let _resend: Resend | null = null;

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — emails disabled");
    return null;
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
