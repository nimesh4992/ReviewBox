import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface OnboardingBannerProps {
  showOnboarding?: boolean;
}

export function OnboardingBanner({ showOnboarding = false }: OnboardingBannerProps) {
  if (!showOnboarding) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="size-4 shrink-0 text-amber-500" strokeWidth={1.5} />
      <span>
        Get started &mdash; connect your first app to see live review data.{" "}
        <Link
          href="/settings"
          className="font-semibold underline underline-offset-2 hover:text-amber-900"
        >
          Go to Settings
        </Link>
      </span>
    </div>
  );
}
