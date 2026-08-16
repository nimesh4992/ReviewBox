/**
 * The two app-store marks, drawn as inline SVG.
 *
 * These replace lucide's `Apple` (which is an apple *fruit*, complete with a
 * leaf — not the Apple Inc. logo) and `Smartphone` (a generic handset standing
 * in for Google Play). Side by side those read as two unrelated pictures rather
 * than two platforms.
 *
 * Drawn rather than downloaded on purpose. Icon marketplaces host user-uploaded
 * imitations of these logos: the shapes are approximate, the licences usually
 * require visible attribution, and redistributing a lookalike of someone's
 * registered trademark is a problem an icon pack does not solve. Naming a
 * platform with its own mark is ordinary identification, so long as the mark is
 * accurate and unmodified — which is what these are.
 *
 * Apple's mark is monochrome and inherits `currentColor`, so it follows the
 * button's text colour in both themes. Google Play's mark is four-colour by
 * definition and keeps its brand colours, which is how it appears everywhere
 * else it is used.
 */

export function AppStoreMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

export function GooglePlayMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M3.06 2.28A1.5 1.5 0 0 0 2.5 3.46v17.08c0 .47.21.9.56 1.18l9.2-9.72-9.2-9.72Z"
        fill="#00A0FF"
      />
      <path
        d="m16.6 15.29-4.34-3.29 4.34-3.29 4.02 2.28c.9.51.9 1.51 0 2.02l-4.02 2.28Z"
        fill="#FFC900"
      />
      <path
        d="m16.6 15.29-4.34-3.29-9.2 9.72c.4.35.98.4 1.46.13l12.08-6.56Z"
        fill="#FF3A44"
      />
      <path
        d="M4.52 2.15c-.48-.27-1.06-.22-1.46.13l9.2 9.72 4.34-3.29L4.52 2.15Z"
        fill="#00E676"
      />
    </svg>
  );
}

/** Picks the right mark for a platform value used across onboarding and settings. */
export function StoreMark({
  platform,
  className,
}: {
  platform: "google-play" | "app-store";
  className?: string;
}) {
  return platform === "google-play" ? (
    <GooglePlayMark className={className} />
  ) : (
    <AppStoreMark className={className} />
  );
}
