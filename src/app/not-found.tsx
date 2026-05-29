import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Link href="/" aria-label="ReviewBox home">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A84FF] text-xl font-bold text-white shadow-lg shadow-[#0A84FF]/30">
            R
          </div>
        </Link>

        <p className="mt-6 text-sm font-medium uppercase tracking-widest text-white/30">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 max-w-sm text-sm text-white/50">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-[#0A84FF] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0A84FF]/25 transition-opacity hover:opacity-90"
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            Open app
          </Link>
        </div>
      </div>
    </div>
  );
}
