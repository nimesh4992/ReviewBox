"use client";

/**
 * Extracted verbatim from dashboard/page.tsx.
 *
 * This component and WorkspaceStatusStrip are the two that concurrent PRs
 * (#90/#91) fused into one another when they shared that file — one of six
 * merge corruptions it has suffered. Splitting them means two PRs touching
 * different dashboard widgets no longer touch the same file at all.
 */

export function PortfolioSparkline({ data }: { data: (number | null)[] }) {
  // Null entries are days with no reviews in the trailing window. They keep
  // their slot on the x-axis — that is the whole point, so the spacing between
  // points means elapsed time — but the line must not be drawn across them.
  const values = data.filter((v): v is number => v !== null);

  if (values.length < 2) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[12px] text-fg-3">
        Trend appears here once 2+ days of reviews are synced.
      </div>
    );
  }

  const w = 560, h = 130, padL = 28, padR = 8, padT = 10, padB = 20;

  // Fixed 1–5 domain — ratings live on a five-star scale and the axis must say
  // so. The old domain auto-zoomed to the data (min→max), so a rough month
  // rendered as a 1.4–2.5 window, which reads as "the rating axis ends at 2.5"
  // rather than as a trend on a 5-star scale.
  const ticks = [1, 2, 3, 4, 5];

  const xs = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (w - padL - padR);
  const ys = (v: number) => padT + (1 - (v - 1) / 4) * (h - padT - padB);

  // "M" starts a fresh subpath after every gap, so a break in the data reads as
  // a break in the line instead of a straight run between two distant days.
  let penDown = false;
  const d = data
    .map((v, i) => {
      if (v === null) { penDown = false; return ""; }
      const cmd = penDown ? "L" : "M";
      penDown = true;
      return `${cmd}${xs(i)},${ys(v)}`;
    })
    .filter(Boolean)
    .join(" ");

  // `preserveAspectRatio="none"` is what lets the line stretch to whatever width
  // the card happens to be — but it scales x and y independently, and it scales
  // EVERYTHING in the SVG, glyphs included. On a wide screen the viewBox is
  // stretched about 2x horizontally and not at all vertically, so the axis
  // numbers came out visibly distorted.
  //
  // So the labels leave the SVG. The stretched box keeps only geometry
  // (gridlines and the path, which are supposed to stretch) and the numbers are
  // HTML positioned over it, rendering at their natural proportions.
  const pct = (v: number) => `${(ys(v) / h) * 100}%`;

  return (
    <div className="relative w-full" style={{ height: h }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {ticks.map((g) => (
          <line
            key={g}
            x1={padL}
            x2={w - padR}
            y1={ys(g)}
            y2={ys(g)}
            stroke="var(--rb-border-1)"
          />
        ))}
        <path
          d={d}
          fill="none"
          stroke="#0A84FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          // Stroke width is a length like any other, so the horizontal stretch
          // would thin the line as the card widens. This keeps it at 2px.
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {ticks.map((g) => (
        <span
          key={g}
          className="absolute text-[10px] tabular-nums text-fg-3"
          style={{ top: pct(g), left: 0, width: padL - 6, transform: "translateY(-50%)", textAlign: "right" }}
        >
          {g}
        </span>
      ))}
    </div>
  );
}

