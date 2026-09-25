// The practice section. Every label, mark total, skill name, answer-box size and marking-level table comes from the
// curriculum config (looked up by the question's kind, or by label key). No wording about marking is written in this file.
import { esc, plural } from "../util.js";

const lines = (n) => `<div class="lines" aria-hidden="true">${"<i></i>".repeat(n)}</div>`;
const list = (items) => `<ul class="tight">${items.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;

function mcqHtml(q, i, total, cur) {
  return `<div class="q mcq" data-i="${i}" data-answer="${esc(q.answer_key)}" data-expl="${esc(q.explanation)}"${i ? " hidden" : ""}>` +
    `<div class="qlabel">${esc(cur.label("question_of", { n: i + 1, total }))} &middot; ${esc(cur.mcqType(q.type))}${pointTag(q, cur)}</div><div class="qtxt">${esc(q.prompt)}</div><div class="opts">` +
    q.options.map((o) => `<button type="button" class="opt" data-k="${esc(o.key)}"><span class="l">${esc(o.key)}</span>${esc(o.text)}</button>`).join("") +
    '</div><div class="explain" hidden></div><div class="mcqnav no-print"></div></div>';
}

function guideHtml(q, cur) {
  const rows = q.answer_guide.rows;
  let html = `<h4>${esc(cur.label("answer_guide"))}</h4><div class="ao">` + rows.map((r) =>
    `<b>${esc(cur.skill(r.skill).label)}${r.marks != null ? " &middot; " + marks(r.marks, cur) : ""}</b><span>${list(r.points)}</span>`).join("") + "</div>";
  (q.answer_guide.notes || []).forEach((n) => { html += `<p class="note" style="margin:.8rem 0 0">${esc(n)}</p>`; });
  return html;
}

function levelsHtml(kind, cur) {
  const tables = kind.level_tables || [];
  if (!tables.length) return "";
  return `<h4>${esc(cur.label("marking_levels"))}</h4>` + tables.map((t) =>
    `<h5>${esc(cur.label("table_heading", { label: t.label, max: t.max }))}</h5><div class="levels">` +
    t.levels.map((l) => `<div class="level"><b>${esc(cur.label("level_heading", { level: l.level, min: l.marks[0], max: l.marks[1] }))}</b>${list(l.descriptors)}</div>`).join("") +
    `<div class="level"><b>${esc(cur.label("zero_marks"))}</b> ${esc(t.zero)}</div></div>`).join("");
}

function writtenHtml(q, cur) {
  const kind = cur.kind(q.kind);
  const big = kind.answer_size === "large";
  return `<h3 style="margin-top:2rem">${esc(cur.label("written_heading", { label: kind.label, marks: marks(kind.total_marks, cur) }))}${pointTag(q, cur)}</h3>` +
    `<div class="q"><div class="qtxt">${esc(q.prompt)}</div>` +
    `<textarea class="attempt" data-for="${esc(q.id)}"${big ? ' style="min-height:13rem"' : ""} aria-label="${esc(cur.label("answer_input"))}"></textarea>${lines(big ? 16 : 8)}` +
    `<p class="hint no-print" data-hint="${esc(q.id)}"></p><button type="button" class="btn reveal" data-target="ans-${esc(q.id)}" data-attempt="${esc(q.id)}">${esc(cur.label("reveal_show"))}</button>` +
    `<div class="answer" id="ans-${esc(q.id)}" hidden>${guideHtml(q, cur)}${levelsHtml(kind, cur)}</div></div>`;
}

const marks = (n, cur) => plural(n, cur.label("mark"));

function pointTag(q, cur) {
  return q.point && cur.point(q.point) ? ` &middot; ${esc(cur.config.site.point_label)} ${esc(q.point)}` : "";
}

export default {
  id: "practice",
  navKey: "nav_practice",

  render(art, ctx) {
    const qs = art.questions || [];
    if (!qs.length) return "";
    const cur = ctx.cur;
    const mcqs = qs.filter((q) => q.kind === "mcq");
    let html = "";
    if (mcqs.length) {
      const kind = cur.kind("mcq");
      html += `<h3>${esc(cur.label("mcq_heading", { label: kind.label, marks: marks(kind.total_marks, cur) }))}</h3><div id="mcqs">` +
        mcqs.map((q, i) => mcqHtml(q, i, mcqs.length, cur)).join("") +
        '<div class="q" id="mcqresult" hidden><div class="qtxt" id="mcqscore"></div><div class="mcqnav"><button type="button" class="btn" id="mcqretry">' + esc(cur.label("try_again")) + "</button></div></div></div>";
    }
    html += qs.filter((q) => q.kind !== "mcq").map((q) => writtenHtml(q, cur)).join("");
    return `<section id="sec-practice"><h2>${esc(cur.label("practice_heading"))}</h2>${html}</section>`;
  },

  mount(root, art, ctx) {
    // Single-answer questions: one question at a time; the answer key and explanation are already in the data.
    const qs = [...root.querySelectorAll("#mcqs .mcq[data-i]")];
    let score = 0;
    const show = (i) => { qs.forEach((q, n) => { q.hidden = n !== i; }); root.querySelector("#mcqresult").hidden = true; };
    qs.forEach((q, n) => {
      q.querySelectorAll(".opt").forEach((b) => {
        b.onclick = () => {
          const pick = b.dataset.k, ans = q.dataset.answer;
          q.querySelectorAll(".opt").forEach((o) => {
            o.disabled = true;
            if (o.dataset.k === ans) o.classList.add("correct");
            else if (o === b) o.classList.add("wrong");
          });
          if (pick === ans) score++;
          const ex = q.querySelector(".explain");
          ex.textContent = (pick === ans ? ctx.cur.label("correct") : ctx.cur.label("incorrect", { answer: ans })) + q.dataset.expl;
          ex.hidden = false;
          const nav = q.querySelector(".mcqnav");
          const last = n === qs.length - 1;
          nav.innerHTML = `<button type="button" class="btn primary">${esc(ctx.cur.label(last ? "see_score" : "next_question"))}</button>`;
          nav.firstChild.onclick = () => {
            if (!last) return show(n + 1);
            qs.forEach((x) => { x.hidden = true; });
            root.querySelector("#mcqscore").textContent = ctx.cur.label("score", { score, total: qs.length });
            root.querySelector("#mcqresult").hidden = false;
          };
        };
      });
    });
    const retry = root.querySelector("#mcqretry");
    if (retry) retry.onclick = () => ctx.rerender();

    // Written questions: students unlock the answer guide by making an attempt. Teachers see it at once.
    root.querySelectorAll(".reveal").forEach((btn) => {
      const id = btn.dataset.attempt;
      const box = root.querySelector(`textarea[data-for="${id}"]`);
      const hint = root.querySelector(`[data-hint="${id}"]`);
      const target = root.querySelector("#" + btn.dataset.target);
      const showText = ctx.cur.label("reveal_show"), hideText = ctx.cur.label("reveal_hide");
      const refresh = () => {
        const ready = ctx.isTeacher() || box.value.trim().length >= 15;
        btn.disabled = !ready;
        hint.textContent = ready ? "" : ctx.cur.label("reveal_hint");
      };
      box.oninput = refresh;
      refresh();
      btn.onclick = () => {
        target.hidden = !target.hidden;
        btn.textContent = target.hidden ? showText : hideText;
      };
    });
  },
};
