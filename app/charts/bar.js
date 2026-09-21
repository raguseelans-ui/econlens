// Bar chart: 2 to 6 figures, negative values allowed.
import { esc, fmtNum } from "../util.js";
import { niceScale, wrapLabel } from "./scale.js";

let count = 0;

export function barChart(c) {
  const vals = c.values, n = vals.length, unit = c.unit || "";
  const W = 720, L = 68, R = 16, T = 30, pw = W - L - R;
  const maxLines = Math.max(...c.labels.map((l) => wrapLabel(l, Math.max(9, Math.floor(pw / n / 7))).length));
  const B = 34 + maxLines * 15, H = 240 + B - 34, ph = H - T - B;
  const sc = niceScale(Math.min(...vals), Math.max(...vals));
  const y = (v) => T + (sc.hi - v) / (sc.hi - sc.lo) * ph;
  const gid = "g" + ++count;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc((c.title || "Bar chart") + ": " + c.labels.map((l, i) => l + " " + fmtNum(vals[i], unit)).join("; "))}">`;
  out += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.45"/></linearGradient></defs>`;
  for (let t = sc.lo; t <= sc.hi + sc.step / 2; t += sc.step) {
    const v = Math.round(t / sc.step) * sc.step;
    out += `<line class="${v === 0 ? "zl" : "gl"}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>` +
      `<text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmtNum(v, unit))}</text>`;
  }
  const slot = pw / n, bw = Math.min(96, slot * 0.58), maxChars = Math.max(9, Math.floor(slot / 7));
  vals.forEach((val, i) => {
    const x = L + slot * i + (slot - bw) / 2, y0 = y(0), y1 = y(val);
    const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y0 - y1));
    const fill = val < 0 ? "var(--bad)" : `url(#${gid})`;
    out += `<rect class="bar${val < 0 ? " neg" : ""}" x="${x}" y="${top}" width="${bw}" height="${h}" rx="3" style="fill:${fill};animation-delay:${i * 90}ms"/>` +
      `<text class="callout" x="${x + bw / 2}" y="${val < 0 ? top + h + 16 : top - 7}" text-anchor="middle">${esc(fmtNum(val, unit))}</text>`;
    const cx = x + bw / 2;
    out += `<text class="axis" x="${cx}" y="${T + ph + 24}" text-anchor="middle">` +
      wrapLabel(c.labels[i], maxChars).map((ln, k) => `<tspan x="${cx}" dy="${k ? 15 : 0}">${esc(ln)}</tspan>`).join("") + "</text>";
  });
  return out + "</svg>";
}
