// Line or step chart over time. Series points are [label, value]; a label is an ISO date or the
// article's own wording (for example "Mar 2026").
import { esc, fmtNum } from "../util.js";
import { niceScale, wrapLabel } from "./scale.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const COLOURS = ["var(--accent)", "var(--hi)", "#56656e"];
const monthYear = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" });

export function trendSeries(t) {
  return (t.series || []).slice(0, 3)
    .map((s) => ({ name: s.name || "", points: (s.points || []).filter((p) => Array.isArray(p) && typeof p[1] === "number") }))
    .filter((s) => s.points.length >= 2);
}

export function trendLegend(series) {
  if (series.length < 2) return "";
  return '<div class="legend">' + series.map((s, i) => `<span style="--c:${COLOURS[i]}">${esc(s.name)}</span>`).join("") + "</div>";
}

export function trendChart(t, series) {
  const W = 720, H = 310, L = 56, R = 34, T = 30, B = 52, pw = W - L - R, ph = H - T - B, unit = t.unit || "";
  const labels = [], vals = [];
  series.forEach((s) => s.points.forEach((p) => { vals.push(p[1]); if (!labels.includes(p[0])) labels.push(p[0]); }));
  const isDate = labels.every((l) => ISO.test(l));
  const ref = t.reference && typeof t.reference.value === "number" ? t.reference.value : null;
  if (ref !== null) vals.push(ref);
  const sc = niceScale(Math.min(...vals), Math.max(...vals));
  const xs = {};
  let d0 = 0, d1 = 0;
  if (isDate) {
    const times = labels.map((l) => new Date(l + "T00:00:00").getTime());
    d0 = Math.min(...times); d1 = Math.max(...times);
    labels.forEach((l, i) => { xs[l] = L + (times[i] - d0) / ((d1 - d0) || 1) * pw; });
  } else {
    labels.forEach((l, i) => { xs[l] = L + pw * (i + 0.5) / labels.length; });
  }
  const y = (v) => T + (sc.hi - v) / (sc.hi - sc.lo) * ph;
  const summary = series.map((s) => {
    const f = s.points[0], l = s.points[s.points.length - 1];
    return (s.name ? s.name + ": " : "") + `from ${fmtNum(f[1], unit)} (${f[0]}) to ${fmtNum(l[1], unit)} (${l[0]})`;
  }).join("; ");
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((t.title || "Chart") + ". " + summary + ".")}">`;
  for (let tk = sc.lo; tk <= sc.hi + sc.step / 2; tk += sc.step) {
    const gv = Math.round(tk / sc.step) * sc.step;
    out += `<line class="${gv === 0 ? "zl" : "gl"}" x1="${L}" x2="${W - R}" y1="${y(gv)}" y2="${y(gv)}"/>` +
      `<text class="axis" x="${L - 8}" y="${y(gv) + 4}" text-anchor="end">${esc(fmtNum(gv, unit))}</text>`;
  }
  if (isDate) {
    const yr0 = new Date(d0).getFullYear(), yr1 = new Date(d1).getFullYear();
    if (yr1 - yr0 >= 3) {
      const every = yr1 - yr0 > 8 ? 2 : 1;
      for (let yr = yr0; yr <= yr1; yr += every) {
        const xx = L + (new Date(yr, 0, 1).getTime() - d0) / ((d1 - d0) || 1) * pw;
        if (xx >= L - 1 && xx <= W - R + 1) out += `<text class="axis" x="${Math.max(L, xx)}" y="${H - 18}" text-anchor="middle">${yr}</text>`;
      }
    } else {
      const step = Math.ceil(labels.length / 7);
      labels.forEach((l, i) => { if (i % step === 0) out += `<text class="axis" x="${xs[l]}" y="${H - 18}" text-anchor="middle">${esc(monthYear(l))}</text>`; });
    }
  } else {
    const skip = Math.ceil(labels.length / Math.max(2, Math.floor(pw / 70)));
    const maxChars = Math.max(6, Math.floor(pw / labels.length / 7));
    labels.forEach((l, i) => {
      if (i % skip !== 0) return;
      out += `<text class="axis" x="${xs[l]}" y="${T + ph + 20}" text-anchor="middle">` +
        wrapLabel(l, maxChars * skip).slice(0, 2).map((ln, k) => `<tspan x="${xs[l]}" dy="${k ? 14 : 0}">${esc(ln)}</tspan>`).join("") + "</text>";
    });
  }
  if (ref !== null) {
    out += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(ref)}" y2="${y(ref)}" style="stroke:var(--muted);stroke-dasharray:2 4"/>` +
      `<text class="axis" x="${W - R - 2}" y="${y(ref) + 16}" text-anchor="end">${esc(t.reference.label || "")}</text>`;
  }
  const few = series.every((s) => s.points.length <= 12);
  series.forEach((s, si) => {
    const col = COLOURS[si];
    let d = "";
    s.points.forEach((p, i) => {
      const px = xs[p[0]].toFixed(1), py = y(p[1]).toFixed(1);
      d += i === 0 ? `M${px},${py}` : (t.type === "step" ? ` H${px} V${py}` : ` L${px},${py}`);
    });
    out += `<path class="trace" pathLength="1" d="${d}" fill="none" style="stroke:${col};stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round"/>`;
    s.points.forEach((p, i) => {
      const end = i === 0 || i === s.points.length - 1;
      if (!few && !end) return;
      out += `<circle cx="${xs[p[0]]}" cy="${y(p[1])}" r="${end ? 4.5 : 3.5}" style="fill:${col}"/>`;
      const showLabel = series.length === 1 ? (few || end) : i === s.points.length - 1;
      if (showLabel) {
        const above = si === 0 || series.length === 1;
        out += `<text class="callout" x="${xs[p[0]]}" y="${y(p[1]) + (above ? -11 : 20)}" text-anchor="${i === s.points.length - 1 ? "end" : i === 0 ? "start" : "middle"}">${esc(fmtNum(p[1], unit))}</text>`;
      }
    });
  });
  return out + "</svg>";
}
