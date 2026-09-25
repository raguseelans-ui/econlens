// The home page: search, filters and a card for each article. Cards are built from index entries only.
import { esc, fmtDate } from "../util.js";
import { articleHref } from "../router.js";

function statusOf(e, cur) {
  return e.relevant ? { cls: e.status, label: cur.status(e.status).label } : { cls: "notrel", label: cur.label("not_relevant") };
}

function haystack(e, cur) {
  return [e.headline, e.source, e.primary, cur.specTitle(e.primary), ...(e.secondary || []), ...(e.keywords || [])].join(" ").toLowerCase();
}

function cardHtml(e, cur) {
  const theme = e.relevant ? cur.themeOf(e.primary) : null;
  const st = statusOf(e, cur);
  let tags = "";
  if (theme) tags += `<span class="badge">${esc(theme.label)}</span><span class="tag">${esc(e.primary + " " + cur.specTitle(e.primary))}</span>`;
  tags += `<span class="status ${esc(st.cls)}">${esc(st.label)}</span>`;
  const body = e.summary ? `<p class="clamp">${esc(e.summary)}</p>` : (e.reason ? `<p class="reason"><b>${esc(cur.label("why_not_relevant"))}</b> ${esc(e.reason)}</p>` : "");
  return `<article class="pick"${theme ? ` data-colour="${esc(theme.colour_key)}"` : ""}><div class="tags">${tags}</div>` +
    `<h2><a href="${articleHref(e.id)}">${esc(e.headline)}</a></h2>` +
    `<p class="meta">${esc(e.source)} &middot; ${esc(fmtDate(e.published))}</p>${body}</article>`;
}

function renderCards(ctx) {
  const { cur, store } = ctx, f = store.state.filters, q = f.q.trim().toLowerCase();
  const list = store.entries().filter((e) => {
    const theme = e.relevant ? cur.themeOf(e.primary) : null;
    if (f.theme && (!theme || String(theme.id) !== f.theme)) return false;
    if (f.source && e.source !== f.source) return false;
    if (f.status && statusOf(e, cur).label !== f.status) return false;
    return !q || haystack(e, cur).includes(q);
  }).sort((a, b) => (b.published || "").localeCompare(a.published || ""));
  document.getElementById("count").textContent = list.length + (list.length === 1 ? " article" : " articles");
  document.getElementById("cards").innerHTML = list.length ? list.map((e) => cardHtml(e, cur)).join("")
    : '<p class="empty" style="grid-column:1/-1">No articles match. Try clearing the search or filters.</p>';
}

const options = (pairs, current, all) => `<option value="">${all}</option>` +
  pairs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(current) ? " selected" : ""}>${esc(l)}</option>`).join("");

export function renderHome(ctx) {
  const { cur, store } = ctx, f = store.state.filters, app = document.getElementById("app");
  document.body.dataset.colour = "";
  ctx.renderTeacherBar(null);
  const sources = [...new Set(store.entries().map((e) => e.source))].sort();
  const statuses = store.isTeacher() ? [...cur.config.statuses.map((s) => s.label), NOT_RELEVANT] : [];
  const site = cur.config.site;
  app.innerHTML = `<div class="dash" style="padding-top:0"><div class="intro"><h1>${esc(site.home_title)}</h1><p>${esc(site.home_intro)}</p></div>` +
    '<div class="filters no-print" role="search">' +
    `<input id="fq" type="search" placeholder="Search headlines, topics or terms" aria-label="Search articles" value="${esc(f.q)}">` +
    `<select id="ft" aria-label="Filter by theme">${options(cur.themes.map((t) => [t.id, t.label]), f.theme, "All themes")}</select>` +
    `<select id="fs" aria-label="Filter by source">${options(sources.map((s) => [s, s]), f.source, "All sources")}</select>` +
    (statuses.length ? `<select id="fst" aria-label="Filter by status">${options(statuses.map((s) => [s, s]), f.status, "All statuses")}</select>` : "") +
    '</div><p class="count" id="count"></p><div class="picker" id="cards"></div></div>';
  const bind = (id, key) => { const el = document.getElementById(id); if (el) el.oninput = el.onchange = (e) => { f[key] = e.target.value; renderCards(ctx); }; };
  bind("fq", "q"); bind("ft", "theme"); bind("fs", "source"); bind("fst", "status");
  renderCards(ctx);
  document.title = `${cur.config.site.name}: ${cur.config.site.home_title}`;
}
