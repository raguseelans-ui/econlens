import { esc, has } from "../util.js";

export default {
  id: "discuss",
  nav: "Discussion",
  render(art) {
    const d = art.discussion;
    if (!d || !has(d.prompt)) return "";
    // teacher_note only exists in the encrypted teacher files
    return `<section id="sec-discuss"><h2>Class discussion</h2><div class="discuss"><p class="prompt">${esc(d.prompt)}</p>` +
      (has(d.teacher_note) ? `<p class="note"><b>Teacher note:</b> ${esc(d.teacher_note)}</p>` : "") + "</div></section>";
  },
};
