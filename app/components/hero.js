// The top of an article: label, chips, headline, source, banner and the link to the original.
import { esc, has, safeUrl, fmtDate } from "../util.js";

export function heroHtml(art, ctx) {
  const cur = ctx.cur, m = art.mapping, meta = art.meta;
  const theme = m ? cur.themeOf(m.primary) : null;
  const status = art.state && art.state.status;
  const link = safeUrl(meta.url);

  let chips = "";
  if (m) {
    chips += `<span class="chip primary">${esc(m.primary + " " + cur.specTitle(m.primary))}</span>`;
    (m.secondary || []).forEach((c) => { chips += `<span class="chip">${esc(c + " " + cur.specTitle(c))}</span>`; });
    if (has(m.confidence_band)) {
      const n = typeof m.confidence === "number" ? ` (${Math.round(m.confidence * 100)}%)` : ""; // numeric score exists only in teacher files
      chips += `<span class="chip">Mapping confidence: ${esc(m.confidence_band)}${n}</span>`;
    }
  }
  if (status) chips += `<span class="status ${esc(status)}" style="margin-left:0">${esc(cur.status(status).label)}</span>`;

  let intro = "";
  if (m && has(m.justification)) intro += `<p>${esc(m.justification)}</p>`;
  if (m && has(m.cross_theme_note)) intro += `<p><b>Cross-theme links:</b> ${esc(m.cross_theme_note)}</p>`;
  if (!art.relevance.relevant) intro += `<p><b>Marked as not relevant:</b> ${esc(art.relevance.reason)}</p>`;

  const site = cur.config.site;
  let banner = status === "approved"
    ? `<p class="banner reviewed">${esc(site.banner_reviewed)}</p>`
    : `<p class="banner">${esc(site.banner_unreviewed)}</p>`;
  if (!link && ctx.isTeacher()) banner += '<p class="banner warn">There is no link to the original article. Students need one before this is published.</p>';

  return '<header class="hero">' +
    (theme ? `<p class="eyebrow">${esc(theme.label)} &middot; ${esc(m.primary)}</p>` : "") +
    `<div class="chips">${chips}</div><h1>${esc(meta.headline)}</h1>` +
    `<p class="meta">Source: ${esc(meta.source)}, ${esc(fmtDate(meta.published))}.</p>${intro}${banner}` +
    '<div class="toolbar no-print">' +
    (link ? `<a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Read the full article &#8599;</a>` : "") +
    '<button type="button" class="btn" id="printbtn">Print or save as PDF</button></div>' +
    (link ? `<p class="print-link note" style="margin-top:.6rem">Full article: ${esc(link)}</p>` : "") + "</header>";
}
