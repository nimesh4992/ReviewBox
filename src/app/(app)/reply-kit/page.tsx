import { PageHeader } from "@/components/layout/page-header";
import { ReplyKit } from "@/features/reply-kit/components/reply-kit";

export default function ReplyKitPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Reviews"
        title="Reply Kit"
        description="Manage tags, templates, AI reply styles, and knowledge base for smarter replies."
      />
      <div className="p-4 md:p-6">
        <ReplyKit />
      </div>
    </div>
  );
}
