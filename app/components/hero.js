// The top of an article: label, chips, headline, source, banner and the link to the original.
import { esc, has, safeUrl, fmtDate } from "../util.js";

export function heroHtml(art, ctx) {
  const cur = ctx.cur, m = art.mapping, meta = art.meta;
  const theme = m ? cur.themeOf(m.primary) : null;
  const status = art.state && art.state.status;
  const link = safeUrl(meta.url);

  let chips = "";
  if (m) {
    [m.primary, ...(m.secondary || [])].forEach((c, i) => {
      const label = esc(c + " " + cur.specTitle(c)), cls = "chip" + (i === 0 ? " primary" : "");
      // A code with tagged points becomes a button that shows them; one without stays plain.
      chips += cur.pointsOf(c, m.points || []).length
        ? `<button type="button" class="${cls} has-pts" data-code="${esc(c)}" aria-expanded="false" title="${esc(cur.config.site.points_hint)}">${label}</button>`
        : `<span class="${cls}">${label}</span>`;
    });
    if (has(m.confidence_band)) {
      const n = typeof m.confidence === "number" ? ` (${Math.round(m.confidence * 100)}%)` : ""; // numeric score exists only in teacher files
      chips += `<span class="chip">${esc(cur.label("mapping_confidence", { band: m.confidence_band }))}${esc(n)}</span>`;
    }
  }
  if (status) chips += `<span class="status ${esc(status)}" style="margin-left:0">${esc(cur.status(status).label)}</span>`;

  let intro = "";
  if (m && has(m.justification)) intro += `<p>${esc(m.justification)}</p>`;
  if (m && has(m.cross_theme_note)) intro += `<p><b>${esc(cur.label("cross_theme"))}</b> ${esc(m.cross_theme_note)}</p>`;
  if (!art.relevance.relevant) intro += `<p><b>${esc(cur.label("not_relevant_note"))}</b> ${esc(art.relevance.reason)}</p>`;

  const site = cur.config.site;
  let banner = status === "approved"
    ? `<p class="banner reviewed">${esc(site.banner_reviewed)}</p>`
    : `<p class="banner">${esc(site.banner_unreviewed)}</p>`;
  if (!link && ctx.isTeacher()) banner += '<p class="banner warn">There is no link to the original article. Students need one before this is published.</p>';

  return '<header class="hero">' +
    (theme ? `<p class="eyebrow">${esc(theme.label)} &middot; ${esc(m.primary)}</p>` : "") +
    `<div class="chips">${chips}</div><ul class="ptlist" hidden></ul><h1>${esc(meta.headline)}</h1>` +
    `<p class="meta">${esc(cur.label("source_line", { source: meta.source, date: fmtDate(meta.published) }))}</p>${intro}${banner}` +
    '<div class="toolbar no-print">' +
    (link ? `<a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(cur.label("read_full"))} &#8599;</a>` : "") +
    '<button type="button" class="btn" id="printbtn">' + esc(cur.label("print_pdf")) + "</button></div>" +
    (link ? `<p class="print-link note" style="margin-top:.6rem">${esc(cur.label("read_full"))}: ${esc(link)}</p>` : "") + "</header>";
}

// Chips with points: press one to list that code's points under the chips; press it again to close.
export function mountHero(app, art, ctx) {
  const box = app.querySelector(".ptlist");
  const chips = [...app.querySelectorAll(".chip.has-pts")];
  if (!box) return;
  chips.forEach((chip) => {
    chip.onclick = () => {
      const open = chip.getAttribute("aria-expanded") === "true";
      chips.forEach((c) => c.setAttribute("aria-expanded", "false"));
      if (open) { box.hidden = true; return; }
      chip.setAttribute("aria-expanded", "true");
      box.innerHTML = ctx.cur.pointsOf(chip.dataset.code, art.mapping.points).map((p) => `<li><b>${esc(p.id)}</b> ${esc(p.display)}</li>`).join("");
      box.hidden = false;
    };
  });
}
