// Builds an article page from the block list. It contains no article content of its own.
import { BLOCKS } from "../blocks/index.js";
import { heroHtml, mountHero } from "./hero.js";
import { articleHref } from "../router.js";
import { esc } from "../util.js";

let spy = null;

function watchSections(app) {
  if (spy) spy.disconnect();
  const links = [...app.querySelectorAll("nav.toc a[data-scroll]")];
  if (!links.length || !window.IntersectionObserver) return;
  spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.dataset.scroll === en.target.id));
    });
  }, { rootMargin: "-25% 0px -65% 0px" });
  links.forEach((l) => { const el = document.getElementById(l.dataset.scroll); if (el) spy.observe(el); });
}

export async function renderArticle(ctx, id) {
  const app = document.getElementById("app");
  let art;
  try {
    art = await ctx.store.loadArticle(id);
  } catch (e) {
    document.body.dataset.colour = "";
    ctx.renderTeacherBar(null);
    app.innerHTML = '<div class="dash" style="padding-top:0"><p class="empty">That article could not be found. It may not be published yet. <a href="#/">Back to all articles</a></p></div>';
    return;
  }
  const theme = art.mapping ? ctx.cur.themeOf(art.mapping.primary) : null;
  document.body.dataset.colour = theme ? theme.colour_key : "";
  ctx.renderTeacherBar(art);

  const parts = BLOCKS.map((b) => ({ b, html: b.render(art, ctx) })).filter((p) => p.html);
  app.innerHTML = '<div class="layout"><nav class="toc no-print" aria-label="Contents"><a class="back" href="#/">&larr; All articles</a><p>On this page</p>' +
    parts.map((p) => `<a href="${articleHref(art.id)}" data-scroll="sec-${p.b.id}">${esc(ctx.cur.label(p.b.navKey))}</a>`).join("") + "</nav>" +
    `<main>${heroHtml(art, ctx)}${parts.map((p) => p.html).join("")}</main></div>`;

  app.querySelectorAll("nav.toc a[data-scroll]").forEach((l) => {
    l.onclick = (e) => { e.preventDefault(); const el = document.getElementById(l.dataset.scroll); if (el) el.scrollIntoView(); };
  });
  document.getElementById("printbtn").onclick = () => window.print();
  mountHero(app, art, ctx);
  watchSections(app);
  parts.forEach((p) => p.b.mount && p.b.mount(app, art, ctx));
  document.title = `${art.meta.headline} | ${ctx.cur.config.site.name}`;
}
