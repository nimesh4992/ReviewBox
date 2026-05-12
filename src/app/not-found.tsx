import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5B5BD6] text-xl font-bold text-white shadow-lg shadow-[#5B5BD6]/30">
          R
        </div>

        <p className="mt-6 text-sm font-medium uppercase tracking-widest text-white/30">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 max-w-sm text-sm text-white/50">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/dashboard"
          className="mt-8 rounded-xl bg-[#5B5BD6] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#5B5BD6]/25 transition-opacity hover:opacity-90"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
