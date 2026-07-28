import Link from "next/link";

import { NewTicketForm } from "@/features/admin/components/new-ticket-form";

export default function AdminNewTicketPage() {
  return (
    <div>
      <Link href="/admin/tickets" className="text-xs text-gray-400 hover:text-gray-600">← Tickets</Link>
      <h1 className="mb-1 mt-3 text-lg font-semibold text-gray-900">Log a ticket</h1>
      <p className="mb-6 text-sm text-gray-400">
        For requests that arrive outside the app (usually email to hello@tryreviewbox.com), so all
        support lives in one queue. If the email matches a customer, the ticket links to their
        workspace automatically.
      </p>
      <NewTicketForm />
    </div>
  );
}
