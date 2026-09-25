// Teacher tools: status buttons, mapping editor, copy for lesson, print, and the review file.
// Changes are kept in this browser and downloaded as a file that the local review tool applies to the database.
import { esc, safeUrl, fmtDate, plural } from "../util.js";

const BUTTON_CLASS = { approved: "good", flagged: "bad" };

function lessonText(art, cur) {
  const m = art.mapping, out = [];
  out.push(`${art.meta.headline} (${art.meta.source}, ${fmtDate(art.meta.published)})`);
  if (safeUrl(art.meta.url)) out.push(art.meta.url);
  if (m) out.push(`${cur.label("specification")} ${m.primary} ${cur.specTitle(m.primary)}`);
  if (art.summary) out.push(`\n${cur.label("copy_summary")}\n` + art.summary.paragraphs.join("\n\n"));
  const terms = [...(art.key_terms || [])].sort((a, b) => a.term.localeCompare(b.term, "en-GB"));
  if (terms.length) out.push(`\n${cur.label("copy_terms")}\n` + terms.map((t) => `${t.term}: ${t.definition}`).join("\n"));
  const qs = (art.questions || []).map((q, i) => {
    if (q.kind === "mcq") return `${i + 1}. ${q.prompt}\n` + q.options.map((o) => `   ${o.key}. ${o.text}`).join("\n");
    const k = cur.kind(q.kind);
    return `${k.label} (${plural(k.total_marks, cur.label("mark"))}): ${q.prompt}`;
  });
  if (qs.length) out.push(`\n${cur.label("copy_questions")}\n` + qs.join("\n\n"));
  if (art.discussion) out.push(`\n${cur.label("copy_discussion")}\n` + art.discussion.prompt);
  return out.join("\n");
}

function copyText(text, done) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(true); } catch (e) { done(false); }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback);
  else fallback();
}

export function renderTeacherBar(ctx, art) {
  const bar = document.getElementById("teacherbar"), { store, cur } = ctx;
  if (!store.isTeacher()) { bar.hidden = true; bar.innerHTML = ""; return; }
  const changes = store.reviewCount();
  let html = '<div class="in no-print"><div class="row"><b>Teacher view</b>';
  if (art) {
    html += cur.config.statuses.map((s) => `<button class="btn ${BUTTON_CLASS[s.key] || ""}" data-status="${esc(s.key)}">${esc(s.action)}</button>`).join("");
    if (art.mapping) {
      const codes = cur.specCodes.filter((s) => cur.pointsOf(s.code, art.mapping.points || []).length);  // a main code needs a tagged point in it
      html += '<label>Edit mapping <select id="mapsel"><option value="">Choose a spec code</option>' +
        codes.map((s) => `<option value="${esc(s.code)}"${s.code === art.mapping.primary ? " selected" : ""}>${esc(s.code + " " + s.title)}</option>`).join("") +
        "</select></label>";
    }
    html += '<button class="btn" id="copybtn">Copy for lesson</button><button class="btn" id="tprint">Print</button>';
  }
  html += "</div>";
  if (changes) {
    html += `<p class="note">${plural(changes, "change")} saved in this browser only. ` +
      '<button class="linkbtn inline" id="dlreview">Download review file</button> and give it to the review tool, or ' +
      '<button class="linkbtn inline" id="clearreview">clear local changes</button>.</p>';
  }
  bar.innerHTML = html + "</div>";
  bar.hidden = false;

  bar.querySelectorAll("[data-status]").forEach((b) => { b.onclick = () => { store.setReview(art.id, { status: b.dataset.status }); ctx.render(); }; });
  const sel = document.getElementById("mapsel");
  if (sel) sel.onchange = () => { if (sel.value) { store.setReview(art.id, { primary: sel.value }); ctx.render(); } };
  const copy = document.getElementById("copybtn");
  if (copy) copy.onclick = () => copyText(lessonText(art, cur), (ok) => { copy.textContent = ok ? "Copied" : "Copy failed"; setTimeout(() => { copy.textContent = "Copy for lesson"; }, 1800); });
  const p = document.getElementById("tprint");
  if (p) p.onclick = () => window.print();
  const dl = document.getElementById("dlreview");
  if (dl) dl.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([store.reviewFileText()], { type: "application/json" }));
    a.download = "review.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const clr = document.getElementById("clearreview");
  if (clr) clr.onclick = () => { if (confirm("Clear all changes saved in this browser?")) { store.clearReview(); ctx.render(); } };
}
