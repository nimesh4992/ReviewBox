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
      <rect x="14" y="32" width="6" height="8" rx="3" fill="#fff" fillOpacity="0.97" />
      <rect x="23" y="29" width="6" height="11" rx="3" fill="#fff" fillOpacity="0.97" />
      <rect x="32" y="25" width="6" height="15" rx="3" fill="#fff" fillOpacity="0.97" />
      <rect x="41" y="20" width="6" height="20" rx="3" fill="#fff" fillOpacity="0.97" />
    </svg>
  );
}
