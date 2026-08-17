"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { track } from "@/lib/analytics";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
};

export function UpgradeToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [plan, setPlan] = useState<string>("");

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      const p = searchParams.get("plan") ?? "";
      setPlan(p);
      setVisible(true);
      if (p === "starter" || p === "pro") {
        track({ name: "upgrade_completed", properties: { plan: p } });
      }
      // Clean the URL so a refresh doesn't re-show the toast
      router.replace("/dashboard");
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  if (!visible) return null;

  const label = PLAN_LABEL[plan] ?? plan;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-5 py-3 shadow-lg dark:border-emerald-900/40 dark:bg-[#1a1d27]">
        <CheckCircle2 className="size-5 text-emerald-500" />
        <div>
          <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white">
            You&apos;re on {label || "the new plan"}!
          </p>
          <p className="text-[12px] text-[#86868B]">All features unlocked. Welcome aboard.</p>
        </div>
      </div>
    </div>
  );
}
