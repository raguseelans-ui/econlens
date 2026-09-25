import { esc, has } from "../util.js";

export default {
  id: "discuss",
  navKey: "nav_discuss",
  render(art, ctx) {
    const d = art.discussion;
    if (!d || !has(d.prompt)) return "";
    // teacher_note only exists in the encrypted teacher files
    return `<section id="sec-discuss"><h2>${esc(ctx.cur.label("discuss_heading"))}</h2><div class="discuss"><p class="prompt">${esc(d.prompt)}</p>` +
      (has(d.teacher_note) ? `<p class="note"><b>${esc(ctx.cur.label("teacher_note_label"))}</b> ${esc(d.teacher_note)}</p>` : "") + "</div></section>";
  },
};
