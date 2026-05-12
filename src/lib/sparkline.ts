export function sparklinePoints(
  data: number[],
  width = 80,
  height = 24,
  padding = 2,
): string {
  if (data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  return data
    .map((v, i) => {
      const x = +(i * step).toFixed(1);
      const y = +(padding + (1 - (v - min) / range) * (height - padding * 2)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
}

export function sparklineArea(
  data: number[],
  width = 80,
  height = 24,
  padding = 2,
): string {
  const pts = sparklinePoints(data, width, height, padding);
  if (!pts) return "";
  return `${pts} ${width},${height} 0,${height}`;
}
