// Axis maths shared by the charts.

export function niceScale(minv, maxv) {
  const lo0 = Math.min(0, minv), hi0 = Math.max(0, maxv);
  const raw = (hi0 - lo0) / 4 || 1;
  const mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { lo: Math.floor(lo0 / step) * step, hi: Math.ceil(hi0 / step) * step, step };
}

export function wrapLabel(text, max) {
  const lines = [];
  let cur = "";
  String(text).split(" ").forEach((w) => {
    if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  });
  if (cur) lines.push(cur);
  return lines;
}
