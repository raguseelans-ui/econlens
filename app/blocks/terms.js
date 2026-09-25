import { esc } from "../util.js";

export default {
  id: "terms",
  navKey: "nav_terms",
  render(art, ctx) {
    const terms = [...(art.key_terms || [])].sort((a, b) => a.term.localeCompare(b.term, "en-GB", { sensitivity: "base" }));
    if (!terms.length) return "";
    return `<section id="sec-terms"><h2>${esc(ctx.cur.label("terms_heading"))}</h2><dl class="terms">` +
      terms.map((t) => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.definition)}</dd></div>`).join("") + "</dl></section>";
  },
};
