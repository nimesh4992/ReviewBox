interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

/** Plain stat tile for the internal admin portal (light theme only). */
export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
