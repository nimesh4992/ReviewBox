import { AppShell } from "@/components/layout/app-shell";
import { FirstVisitModal } from "@/components/onboarding/first-visit-modal";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <FirstVisitModal />
      {children}
    </AppShell>
  );
}
