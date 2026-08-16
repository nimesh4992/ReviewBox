/**
 * ReviewBox mark — a speech bubble holding a rising bar chart.
 *
 * One flat brand-blue fill. The previous mark carried a blue gradient, which
 * meant an SVG <linearGradient> with an id — and because the nav and footer
 * each pasted their own copy, two ids and two drifting definitions. Flat fill
 * needs no defs, so one shared component can render anywhere.
 */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <path
        d="M14 8 H50 A8 8 0 0 1 58 16 V40 A8 8 0 0 1 50 48 H28 L18 58 V48 H14 A8 8 0 0 1 6 40 V16 A8 8 0 0 1 14 8 Z"
        fill="var(--rb-blue-500)"
      />
      {/* Three bars, not four. At the size={22} both call sites use, the old
          four 6-unit bars rendered as ~2px strips separated by ~1px gaps — a
          comb, not a chart. Wider bars with real gaps survive the downscale.
          fillOpacity 0.97 was 3% of white over brand blue: invisible, and it
          forced a second paint. */}
      <rect x="15" y="30" width="9" height="10" rx="3" fill="#fff" />
      <rect x="27.5" y="24" width="9" height="16" rx="3" fill="#fff" />
      <rect x="40" y="16" width="9" height="24" rx="3" fill="#fff" />
    </svg>
  );
}
