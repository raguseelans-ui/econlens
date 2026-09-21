import { esc } from "../util.js";

const paragraphs = (list) => list.map((p) => `<p>${esc(p)}</p>`).join("");

export default {
  id: "summary",
  nav: "Summary",
  render(art) {
    const body = (art.summary && art.summary.paragraphs) || [];
    const why = (art.why_it_matters && art.why_it_matters.paragraphs) || [];
    if (!body.length && !why.length) return "";
    return `<section id="sec-summary"><h2>Summary</h2>${paragraphs(body)}` +
      (why.length ? `<h3 style="margin-top:1.6rem">Why it matters</h3><div class="panel tint">${paragraphs(why)}</div>` : "") + "</section>";
  },
};
