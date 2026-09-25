import { esc } from "../util.js";

const paragraphs = (list) => list.map((p) => `<p>${esc(p)}</p>`).join("");

export default {
  id: "summary",
  navKey: "nav_summary",
  render(art, ctx) {
    const body = (art.summary && art.summary.paragraphs) || [];
    const why = (art.why_it_matters && art.why_it_matters.paragraphs) || [];
    if (!body.length && !why.length) return "";
    return `<section id="sec-summary"><h2>${esc(ctx.cur.label("summary_heading"))}</h2>${paragraphs(body)}` +
      (why.length ? `<h3 style="margin-top:1.6rem">${esc(ctx.cur.label("why_heading"))}</h3><div class="panel tint">${paragraphs(why)}</div>` : "") + "</section>";
  },
};
