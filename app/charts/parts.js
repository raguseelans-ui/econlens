// Part-of-a-whole bar, list of rates, and labelled context points.
import { esc, fmtNum, has } from "../util.js";

const pct = (v, total) => { const p = v / total * 100; return (p % 1 === 0 ? p : p.toFixed(1)) + "%"; };

export function shareBlock(s) {
  const parts = (s.parts || []).filter((p) => typeof p.value === "number");
  if (!parts.length) return "";
  const total = s.total || parts.reduce((a, p) => a + p.value, 0);
  let bar = "", legend = "";
  parts.forEach((p) => {
    const hi = p.highlight ? ' class="hi"' : "";
    if (s.count) for (let i = 0; i < p.value; i++) bar += `<i${hi} style="flex:1"></i>`;
    else bar += `<i${hi} style="width:${p.value / total * 100}%"></i>`;
    legend += `<span class="${p.highlight ? "hi" : ""}">${esc(p.label)}: ${esc(s.count ? p.value : fmtNum(p.value, s.unit))}${s.count ? "" : " (" + pct(p.value, total) + ")"}</span>`;
  });
  return `<div class="panel" style="margin-top:1rem">${has(s.title) ? `<h3>${esc(s.title)}</h3>` : ""}` +
    `<div class="share${s.count ? "" : " solid"}" role="img" aria-label="${esc((s.title || "") + ": " + parts.map((p) => p.label + " " + p.value).join(", "))}">${bar}</div>` +
    `<div class="legend">${legend}</div>${has(s.note) ? `<p class="note" style="margin:0">${esc(s.note)}</p>` : ""}</div>`;
}

export function barsBlock(b) {
  const rows = (b.rows || []).filter((r) => typeof r.value === "number");
  if (!rows.length) return "";
  const max = b.max || Math.max(...rows.map((r) => r.value));
  return `<div class="panel" style="margin-top:1rem">${has(b.title) ? `<h3>${esc(b.title)}</h3>` : ""}` +
    rows.map((r) => `<div class="mrow"><span>${esc(r.label)}</span><i style="--w:${Math.max(2, r.value / max * 100)}%"></i><b>${esc(fmtNum(r.value, b.unit))}</b></div>`).join("") +
    `${has(b.note) ? `<p class="note" style="margin:.6rem 0 0">${esc(b.note)}</p>` : ""}</div>`;
}

export function pointsBlock(v) {
  const pts = (v.points || []).filter((p) => has(p.text));
  if (!pts.length) return "";
  return `<h3 style="margin-top:1.6rem">${esc(v.points_title || "More context")}</h3><div class="evals">` +
    pts.map((p) => `<div class="eval">${has(p.label) ? `<b>${esc(p.label)}</b>` : ""}${esc(p.text)}</div>`).join("") + "</div>";
}
