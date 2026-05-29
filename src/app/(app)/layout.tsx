import { AppShell } from "@/components/layout/app-shell";
import { CredentialsBanner } from "@/components/layout/credentials-banner";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <CredentialsBanner />
      {children}
    </AppShell>
  );
}
