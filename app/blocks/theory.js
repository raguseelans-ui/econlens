import { esc } from "../util.js";

export default {
  id: "theory",
  nav: "Theory",
  render(art) {
    const t = art.theory;
    if (!t) return "";
    let html = "";
    if ((t.concepts || []).length) {
      html += '<h3>Concepts to bring in</h3><ul class="tight" style="margin-bottom:1.6rem;columns:2 280px">' +
        t.concepts.map((c) => `<li>${esc(c)}</li>`).join("") + "</ul>";
    }
    if ((t.chain || []).length) {
      html += '<h3>Applying the theory</h3><ol class="chain">' + t.chain.map((s) => `<li>${esc(s)}</li>`).join("") + "</ol>";
    }
    if ((t.evaluation || []).length) {
      html += '<h3 style="margin-top:1.4rem">Evaluation points</h3><div class="evals">' +
        t.evaluation.map((e) => `<div class="eval"><b>${esc(e.label)}</b>${esc(e.text)}</div>`).join("") + "</div>";
    }
    return html ? `<section id="sec-theory"><h2>Theory connections</h2>${html}</section>` : "";
  },
};
