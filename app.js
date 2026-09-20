(function () {
  "use strict";

  var REVIEW_KEY = "econlens-review";
  var state = { pub: [], teacher: null, specs: [], themes: {}, review: {}, f: { q: "", theme: "", source: "", status: "" } };
  var app = document.getElementById("app");

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function nonEmpty(v) {
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" ? v.trim() !== "" : !!v;
  }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return iso || "";
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function paras(text) {
    return String(text || "").split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; }).join("");
  }
  function breakUp(text) {
    return String(text || "").replace(/\.\s+(?=(?:Knowledge|Application|Analysis(?: for support| against support)?|Evaluation|Level [1-4])\s*[(:])/g, ".\n");
  }
  function storage(op, val) {
    try {
      if (op === "get") return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
      if (op === "set") localStorage.setItem(REVIEW_KEY, JSON.stringify(val));
    } catch (e) { /* private mode or blocked storage: carry on without saving */ }
    return {};
  }
  function specTitle(code) {
    for (var i = 0; i < state.specs.length; i++) if (state.specs[i].code === code) return state.specs[i].title;
    return "";
  }

  // ---------- data ----------
  function withReview(a) {
    var r = state.review[a.id];
    if (!r) return a;
    var copy = JSON.parse(JSON.stringify(a));
    if (r.status) copy.status = r.status;
    if (r.primary_code) {
      copy.generated.mapping.primary_code = r.primary_code;
      copy.generated.mapping.primary_title = r.primary_title || specTitle(r.primary_code);
    }
    return copy;
  }
  function articles() {
    return (state.teacher || state.pub).map(withReview);
  }
  function isTeacher() { return !!state.teacher; }
  function isRelevant(a) { return a.generated && a.generated.relevant !== false && nonEmpty((a.generated.mapping || {}).primary_code); }
  function themeOf(a) {
    var c = ((a.generated || {}).mapping || {}).primary_code || "";
    return isRelevant(a) && /^[1-4]/.test(c) ? c.charAt(0) : "";
  }
  function statusInfo(a) {
    if (!isRelevant(a)) return { cls: "notrel", label: "Not relevant" };
    if (a.status === "Approved") return { cls: "approved", label: "Approved" };
    if (a.status === "Flagged") return { cls: "flagged", label: "Flagged" };
    return { cls: "pending", label: "Pending review" };
  }

  // ---------- login ----------
  function b64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function decrypt(blob, password) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("secure"));
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iter, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(blob.iv) }, key, b64(blob.data));
    }).then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }
  var loginDialog = document.getElementById("login");
  var loginErr = document.getElementById("loginerr");
  document.getElementById("logincancel").onclick = function () { loginDialog.close(); };
  document.getElementById("loginform").onsubmit = function (e) {
    e.preventDefault();
    var pw = document.getElementById("pw").value;
    loginErr.hidden = true;
    fetch("teacher.enc", { cache: "no-cache" }).then(function (r) { return r.json(); })
      .then(function (blob) { return decrypt(blob, pw); })
      .then(function (data) {
        state.teacher = data;
        document.getElementById("pw").value = "";
        loginDialog.close();
        render();
      })
      .catch(function (err) {
        loginErr.textContent = err && err.message === "secure"
          ? "Teacher login needs a secure (https) connection."
          : "That password did not work. Please try again.";
        loginErr.hidden = false;
      });
  };

  // ---------- home ----------
  function haystack(a) {
    var g = a.generated || {}, m = g.mapping || {};
    var parts = [a.headline, a.source, m.primary_code, m.primary_title].concat(m.secondary_codes || [], (g.theory || {}).concepts || []);
    (g.key_terms || []).forEach(function (t) { parts.push(t.term); });
    return parts.join(" ").toLowerCase();
  }
  function cardHtml(a) {
    var g = a.generated || {}, m = g.mapping || {}, t = themeOf(a), st = statusInfo(a);
    var tags = "";
    if (t) tags += '<span class="badge">Theme ' + t + '</span><span class="tag">' + esc(m.primary_code + " " + m.primary_title) + "</span>";
    tags += '<span class="status ' + st.cls + '">' + st.label + "</span>";
    var body = isRelevant(a) && nonEmpty(g.summary_100)
      ? '<p class="clamp">' + esc(g.summary_100) + "</p>"
      : (nonEmpty(g.relevance_reason) ? '<p class="reason"><b>Why not relevant:</b> ' + esc(g.relevance_reason) + "</p>" : "");
    return '<article class="card"' + (t ? ' data-theme="' + t + '"' : "") + '><div class="tags">' + tags + "</div>" +
      '<h2><a href="#/a/' + encodeURIComponent(a.id) + '">' + esc(a.headline) + "</a></h2>" +
      '<p class="meta">' + esc(a.source) + " &middot; " + esc(fmtDate(a.date)) + "</p>" + body + "</article>";
  }
  function renderCards() {
    var f = state.f, q = f.q.trim().toLowerCase();
    var list = articles().filter(function (a) {
      if (f.theme && themeOf(a) !== f.theme) return false;
      if (f.source && a.source !== f.source) return false;
      if (f.status && statusInfo(a).label !== f.status) return false;
      return !q || haystack(a).indexOf(q) !== -1;
    }).sort(function (x, y) { return (y.date || "").localeCompare(x.date || ""); });
    document.getElementById("count").textContent = list.length + (list.length === 1 ? " article" : " articles");
    document.getElementById("cards").innerHTML = list.length ? list.map(cardHtml).join("")
      : '<p class="empty">No articles match. Try clearing the search or filters.</p>';
  }
  function home() {
    var all = articles();
    var sources = [];
    all.forEach(function (a) { if (sources.indexOf(a.source) === -1) sources.push(a.source); });
    sources.sort();
    var statuses = isTeacher() ? ["Approved", "Pending review", "Flagged", "Not relevant"] : [];
    function opts(vals, cur, label) {
      return '<option value="">' + label + "</option>" + vals.map(function (v) {
        return '<option value="' + esc(v[0]) + '"' + (v[0] === cur ? " selected" : "") + ">" + esc(v[1]) + "</option>";
      }).join("");
    }
    app.innerHTML = '<div class="intro"><h1>Economics in the news</h1><p>Recent articles linked to the Edexcel A Level Economics specification, with summaries, key terms and practice questions.</p></div>' +
      '<div class="filters no-print" role="search">' +
      '<input id="fq" type="search" placeholder="Search headlines, topics or terms" aria-label="Search articles" value="' + esc(state.f.q) + '">' +
      '<select id="ft" aria-label="Filter by theme">' + opts([["1", "Theme 1"], ["2", "Theme 2"], ["3", "Theme 3"], ["4", "Theme 4"]], state.f.theme, "All themes") + "</select>" +
      '<select id="fs" aria-label="Filter by source">' + opts(sources.map(function (s) { return [s, s]; }), state.f.source, "All sources") + "</select>" +
      (statuses.length ? '<select id="fst" aria-label="Filter by status">' + opts(statuses.map(function (s) { return [s, s]; }), state.f.status, "All statuses") + "</select>" : "") +
      '</div><p class="count" id="count"></p><div class="cards" id="cards"></div>';
    document.getElementById("fq").oninput = function (e) { state.f.q = e.target.value; renderCards(); };
    document.getElementById("ft").onchange = function (e) { state.f.theme = e.target.value; renderCards(); };
    document.getElementById("fs").onchange = function (e) { state.f.source = e.target.value; renderCards(); };
    var fst = document.getElementById("fst");
    if (fst) fst.onchange = function (e) { state.f.status = e.target.value; renderCards(); };
    renderCards();
    document.title = "EconLens: Economics in the news";
  }

  // ---------- article page ----------
  function section(id, title, inner) {
    return nonEmpty(inner) ? '<section id="' + id + '"><h2>' + title + "</h2>" + inner + "</section>" : "";
  }
  function summarySection(g) {
    var s1 = nonEmpty(g.summary_100), s2 = nonEmpty(g.summary_250);
    if (!s1 && !s2) return "";
    var tabs = s1 && s2
      ? '<div class="tabs no-print" role="tablist"><button role="tab" aria-selected="true" data-tab="s100">Short (100 words)</button><button role="tab" aria-selected="false" data-tab="s250">Full (250 words)</button></div>'
      : "";
    return '<div class="summary">' + tabs +
      (s1 ? '<div id="s100" role="tabpanel"><p class="print-only">Short summary</p>' + paras(g.summary_100) + "</div>" : "") +
      (s2 ? '<div id="s250" role="tabpanel"' + (s1 ? " hidden" : "") + '><p class="print-only">Full summary</p>' + paras(g.summary_250) + "</div>" : "") + "</div>";
  }
  function specSection(g) {
    var m = g.mapping || {};
    if (!nonEmpty(m.primary_code)) return "";
    var html = '<ul class="speclist"><li><b>' + esc(m.primary_code + " " + m.primary_title) + '</b> <span class="tag small plain">Primary</span>' +
      (nonEmpty(m.justification) ? "<br>" + esc(m.justification) : "") + "</li>";
    (m.secondary_codes || []).forEach(function (c) {
      var t = specTitle(c);
      html += "<li><b>" + esc(c + (t ? " " + t : "")) + '</b> <span class="tag small plain">Secondary</span></li>';
    });
    html += "</ul>";
    if (nonEmpty(m.cross_theme_note)) html += '<div class="panel plain" style="margin-top:1rem"><p>' + esc(m.cross_theme_note) + "</p></div>";
    if (nonEmpty(m.confidence_band)) {
      html += '<span class="conf">Match confidence: ' + esc(m.confidence_band) +
        (isTeacher() && typeof m.confidence === "number" ? " (" + m.confidence.toFixed(2) + ")" : "") + "</span>";
    }
    return html;
  }
  function theorySection(g) {
    var t = g.theory || {}, html = "";
    if (nonEmpty(t.concepts)) html += "<h3>Key concepts</h3><div class=\"tags\">" + t.concepts.map(function (c) { return '<span class="tag">' + esc(c) + "</span>"; }).join("") + "</div>";
    if (nonEmpty(t.chain_of_reasoning)) html += "<h3>Applying the theory</h3>" + paras(t.chain_of_reasoning);
    if (nonEmpty(t.evaluation_points)) html += "<h3>Evaluation points</h3><ul class=\"evals\">" + t.evaluation_points.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>";
    return html;
  }
  function termsSection(g) {
    var terms = (g.key_terms || []).filter(function (t) { return nonEmpty(t.term); })
      .sort(function (a, b) { return a.term.localeCompare(b.term, "en-GB", { sensitivity: "base" }); });
    return terms.map(function (t) {
      return '<details class="term"><summary>' + esc(t.term) + "</summary><p>" + esc(t.definition) + "</p></details>";
    }).join("");
  }
  function cleanQuestion(q) { return String(q || "").replace(/\s*\(\s*\d+\s*marks?\s*\)\s*$/i, ""); }
  function commandWord(q) { var m = /^\s*([A-Za-z]+)/.exec(q || ""); return m ? m[1] : ""; }
  function linesHtml() { return '<div class="lines" aria-hidden="true">' + new Array(9).join("<i></i>") + "</div>"; }

  function examSection(g) {
    var html = "", mcqs = (g.mcqs || []).filter(function (q) { return nonEmpty(q.question) && q.options; });
    if (mcqs.length) {
      html += '<div class="qhead"><h3>Multiple choice</h3><span class="tag plain">1 mark each</span></div><div id="mcqs">';
      mcqs.forEach(function (q, i) {
        html += '<div class="mcq" data-i="' + i + '" data-answer="' + esc(q.answer) + '" data-expl="' + esc(q.explanation) + '"' + (i ? " hidden" : "") + '>' +
          '<p class="n">Question ' + (i + 1) + " of " + mcqs.length + '</p><p class="qtext">' + esc(q.question) + '</p><div class="opts">' +
          Object.keys(q.options).sort().map(function (k) {
            return '<button type="button" class="opt" data-k="' + esc(k) + '"><b>' + esc(k) + "</b><span>" + esc(q.options[k]) + "</span></button>";
          }).join("") + '</div><div class="feedback" hidden></div><div class="mcqnav no-print"></div>' +
          '</div>';
      });
      html += '<div class="mcq" id="mcqresult" hidden><p class="qtext" id="mcqscore"></p><div class="mcqnav"><button type="button" class="btn" id="mcqretry">Try again</button></div></div></div>';
    }
    var sa = g.short_answer || {};
    if (nonEmpty(sa.question)) {
      html += '<div class="qhead"><h3>Short answer</h3><span class="tag plain">' + esc(sa.marks || 4) + ' marks</span><span class="tag plain">' + esc(commandWord(sa.question)) + '</span></div>' +
        '<p class="qtext">' + esc(cleanQuestion(sa.question)) + "</p>" +
        '<textarea class="attempt" data-for="sa" aria-label="Your answer to the short answer question"></textarea>' + linesHtml() +
        (nonEmpty(sa.mark_scheme)
          ? '<p class="hint no-print" data-hint="sa"></p><button type="button" class="btn reveal" data-target="sa-ans" data-attempt="sa">Show mark scheme</button>' +
            '<div class="panel plain answer" id="sa-ans" hidden><b>Mark scheme</b>\n' + esc(breakUp(sa.mark_scheme)) + "</div>" : "");
    }
    var ex = g.extended || {};
    if (nonEmpty(ex.question)) {
      var has = nonEmpty(ex.indicative_content) || nonEmpty(ex.level_descriptors);
      html += '<div class="qhead"><h3>Extended answer</h3><span class="tag plain">' + esc(ex.marks || 10) + ' marks</span><span class="tag plain">' + esc(commandWord(ex.question)) + '</span></div>' +
        '<p class="qtext">' + esc(cleanQuestion(ex.question)) + "</p>" +
        '<textarea class="attempt" data-for="ex" style="min-height:14rem" aria-label="Your answer to the extended question"></textarea>' + linesHtml().replace(/<i><\/i>/g, "<i></i><i></i>") +
        (has ? '<p class="hint no-print" data-hint="ex"></p><button type="button" class="btn reveal" data-target="ex-ans" data-attempt="ex">Show indicative content</button>' +
          '<div class="panel plain answer" id="ex-ans" hidden>' +
          (nonEmpty(ex.indicative_content) ? "<b>Indicative content</b>\n" + esc(breakUp(ex.indicative_content)) : "") +
          (nonEmpty(ex.level_descriptors) ? "\n\n<b>Level descriptors</b>\n" + esc(breakUp(ex.level_descriptors)) : "") + "</div>" : "");
    }
    return html;
  }
  function discussSection(g) {
    var d = g.discussion || {};
    if (!nonEmpty(d.prompt)) return "";
    return '<div class="panel discuss"><p style="font-size:1.1rem;font-weight:600;margin:0">' + esc(d.prompt) + "</p>" +
      (isTeacher() && nonEmpty(d.teacher_note) ? '<p class="reason"><b>Teacher note:</b> ' + esc(d.teacher_note) + "</p>" : "") + "</div>";
  }

  function article(id) {
    var a = articles().filter(function (x) { return x.id === id; })[0];
    if (!a) { app.innerHTML = '<a class="back" href="#/">&larr; All articles</a><p class="empty">That article could not be found. It may not be published yet.</p>'; return; }
    var g = a.generated || {}, m = g.mapping || {}, t = themeOf(a), st = statusInfo(a), link = safeUrl(a.url);
    var tags = t ? '<span class="badge">Theme ' + t + '</span><span class="tag">' + esc(m.primary_code + " " + m.primary_title) + "</span>" : "";
    (m.secondary_codes || []).forEach(function (c) { tags += '<span class="tag small">' + esc(c) + "</span>"; });
    tags += '<span class="status ' + st.cls + '">' + st.label + "</span>";
    var banner = a.status === "Approved" && isRelevant(a)
      ? '<p class="banner reviewed">Reviewed by a teacher</p>'
      : '<p class="banner">AI-generated resources. Not official Edexcel material.</p>';
    var notRel = !isRelevant(a) && nonEmpty(g.relevance_reason)
      ? '<section><div class="panel plain"><b>Marked as not relevant.</b><p>' + esc(g.relevance_reason) + "</p></div></section>" : "";

    app.innerHTML = '<a class="back no-print" href="#/">&larr; All articles</a>' +
      '<div class="article"' + (t ? ' data-theme="' + t + '"' : "") + '><header><div class="tags">' + tags + "</div>" +
      "<h1>" + esc(a.headline) + '</h1><p class="meta">' + esc(a.source) + " &middot; " + esc(fmtDate(a.date)) +
      (link ? ' &middot; <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Read the original article</a>' : "") + "</p>" +
      banner + "</header>" + notRel +
      section("summary", "Summary", summarySection(g)) +
      section("why", "Why it matters", nonEmpty(g.why_it_matters) ? '<div class="panel">' + paras(g.why_it_matters) + "</div>" : "") +
      section("spec", "Specification links", specSection(g)) +
      section("theory", "Theory connections", theorySection(g)) +
      section("terms", "Key terms", termsSection(g)) +
      section("exam", "Exam practice", examSection(g)) +
      section("discuss", "Class discussion", discussSection(g)) + "</div>";
    wireArticle(a);
    document.title = a.headline + " | EconLens";
  }

  function wireArticle(a) {
    var root = app;
    // summary toggle
    [].forEach.call(root.querySelectorAll(".tabs [role=tab]"), function (tab) {
      tab.onclick = function () {
        [].forEach.call(root.querySelectorAll(".tabs [role=tab]"), function (o) {
          var on = o === tab;
          o.setAttribute("aria-selected", on);
          document.getElementById(o.getAttribute("data-tab")).hidden = !on;
        });
      };
    });
    // multiple choice, one question at a time
    var qs = [].slice.call(root.querySelectorAll("#mcqs .mcq[data-i]")), idx = 0, score = 0;
    function show(i) {
      idx = i;
      qs.forEach(function (q, n) { q.hidden = n !== i; });
      document.getElementById("mcqresult").hidden = true;
    }
    qs.forEach(function (q, n) {
      [].forEach.call(q.querySelectorAll(".opt"), function (b) {
        b.onclick = function () {
          var pick = b.getAttribute("data-k"), ans = q.getAttribute("data-answer");
          [].forEach.call(q.querySelectorAll(".opt"), function (o) {
            o.disabled = true;
            if (o.getAttribute("data-k") === ans) o.classList.add("correct");
            else if (o === b) o.classList.add("wrong");
          });
          if (pick === ans) score++;
          var fb = q.querySelector(".feedback");
          fb.innerHTML = (pick === ans ? '<b class="right">Correct.</b> ' : '<b class="no">Not quite.</b> The answer is ' + esc(ans) + ". ") + esc(q.getAttribute("data-expl"));
          fb.hidden = false;
          var nav = q.querySelector(".mcqnav");
          nav.innerHTML = '<button type="button" class="btn primary">' + (n < qs.length - 1 ? "Next question" : "See your score") + "</button>";
          nav.firstChild.onclick = function () {
            if (n < qs.length - 1) show(n + 1);
            else {
              qs.forEach(function (x) { x.hidden = true; });
              var r = document.getElementById("mcqresult");
              document.getElementById("mcqscore").textContent = "You scored " + score + " out of " + qs.length + ".";
              r.hidden = false;
            }
          };
        };
      });
    });
    var retry = document.getElementById("mcqretry");
    if (retry) retry.onclick = function () { article(a.id); document.getElementById("exam").scrollIntoView(); };

    // text attempts unlock the answers for students
    [].forEach.call(root.querySelectorAll(".reveal"), function (btn) {
      var box = root.querySelector('textarea[data-for="' + btn.getAttribute("data-attempt") + '"]');
      var hint = root.querySelector('[data-hint="' + btn.getAttribute("data-attempt") + '"]');
      var target = document.getElementById(btn.getAttribute("data-target"));
      function refresh() {
        var ready = isTeacher() || box.value.trim().length >= 15;
        btn.disabled = !ready;
        if (hint) hint.textContent = ready ? "" : "Write your answer first. The mark scheme unlocks once you have made an attempt.";
      }
      box.oninput = refresh;
      refresh();
      var label = btn.textContent;
      btn.onclick = function () {
        target.hidden = !target.hidden;
        btn.textContent = target.hidden ? label : label.replace("Show", "Hide");
      };
    });
  }

  // ---------- teacher bar ----------
  function lessonText(a) {
    var g = a.generated || {}, out = [];
    out.push(a.headline + " (" + a.source + ", " + fmtDate(a.date) + ")");
    if (safeUrl(a.url)) out.push(a.url);
    if (nonEmpty(g.mapping && g.mapping.primary_code)) out.push("Specification: " + g.mapping.primary_code + " " + g.mapping.primary_title);
    if (nonEmpty(g.summary_100)) out.push("\nSUMMARY\n" + g.summary_100);
    var terms = (g.key_terms || []).slice().sort(function (x, y) { return x.term.localeCompare(y.term, "en-GB"); });
    if (terms.length) out.push("\nKEY TERMS\n" + terms.map(function (t) { return t.term + ": " + t.definition; }).join("\n"));
    var qs = [];
    (g.mcqs || []).forEach(function (q, i) {
      qs.push((i + 1) + ". " + q.question + "\n" + Object.keys(q.options || {}).sort().map(function (k) { return "   " + k + ". " + q.options[k]; }).join("\n"));
    });
    if (g.short_answer && nonEmpty(g.short_answer.question)) qs.push("Short answer: " + g.short_answer.question);
    if (g.extended && nonEmpty(g.extended.question)) qs.push("Extended answer: " + g.extended.question);
    if (qs.length) out.push("\nQUESTIONS\n" + qs.join("\n\n"));
    if (g.discussion && nonEmpty(g.discussion.prompt)) out.push("\nDISCUSSION\n" + g.discussion.prompt);
    return out.join("\n");
  }
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(true); } catch (e) { done(false); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }
  function setReview(id, patch) {
    state.review[id] = Object.assign({}, state.review[id], patch);
    storage("set", state.review);
    render();
  }
  function renderAccount() {
    var el = document.getElementById("account");
    el.innerHTML = isTeacher()
      ? '<button class="linkbtn" id="logout">Log out of teacher view</button>'
      : '<button class="linkbtn" id="login-open">Teacher login</button>';
    var lo = document.getElementById("logout"), li = document.getElementById("login-open");
    if (lo) lo.onclick = function () { state.teacher = null; state.f.status = ""; render(); };
    if (li) li.onclick = function () { loginDialog.showModal(); document.getElementById("pw").focus(); };
  }
  function renderTeacherBar(currentId) {
    var bar = document.getElementById("teacherbar");
    if (!isTeacher()) { bar.hidden = true; bar.innerHTML = ""; return; }
    var a = currentId ? articles().filter(function (x) { return x.id === currentId; })[0] : null;
    var changes = Object.keys(state.review).length;
    var html = '<div class="wrap no-print"><div class="row"><b>Teacher view</b>';
    if (a) {
      html += '<button class="btn good" data-act="approve">Approve</button><button class="btn bad" data-act="flag">Flag</button>' +
        '<button class="btn" data-act="pending">Reset to pending</button>';
      if (isRelevant(a) || (a.generated && a.generated.mapping)) {
        var cur = (a.generated.mapping || {}).primary_code || "";
        html += '<label>Edit mapping <select id="mapsel"><option value="">Choose a spec code</option>';
        [1, 2, 3, 4].forEach(function (n) {
          html += '<optgroup label="Theme ' + n + ": " + esc(state.themes[n] || "") + '">' + state.specs.filter(function (s) { return s.theme === n; }).map(function (s) {
            return '<option value="' + esc(s.code) + '"' + (s.code === cur ? " selected" : "") + ">" + esc(s.code + " " + s.title) + "</option>";
          }).join("") + "</optgroup>";
        });
        html += "</select></label>";
      }
      html += '<button class="btn" data-act="copy">Copy for lesson</button><button class="btn" data-act="print">Print</button>';
    }
    html += "</div>";
    if (changes) {
      html += '<p class="note">' + changes + (changes === 1 ? " change is" : " changes are") + " saved in this browser only. " +
        '<button class="linkbtn" data-act="download">Download review file</button> and send it to the site owner to publish, or ' +
        '<button class="linkbtn" data-act="clear">clear local changes</button>.</p>';
    }
    bar.innerHTML = html + "</div>";
    bar.hidden = false;
    bar.onclick = function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) return;
      if (act === "approve") setReview(a.id, { status: "Approved" });
      else if (act === "flag") setReview(a.id, { status: "Flagged" });
      else if (act === "pending") setReview(a.id, { status: "Pending review" });
      else if (act === "print") window.print();
      else if (act === "copy") copyText(lessonText(a), function (ok) { e.target.textContent = ok ? "Copied" : "Copy failed"; setTimeout(function () { e.target.textContent = "Copy for lesson"; }, 1800); });
      else if (act === "clear") { if (confirm("Clear all changes saved in this browser?")) { state.review = {}; storage("set", {}); render(); } }
      else if (act === "download") {
        var blob = new Blob([JSON.stringify(state.review, null, 2)], { type: "application/json" });
        var l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = "review.json"; l.click();
        setTimeout(function () { URL.revokeObjectURL(l.href); }, 1000);
      }
    };
    var sel = document.getElementById("mapsel");
    if (sel) sel.onchange = function () { if (sel.value) setReview(a.id, { primary_code: sel.value, primary_title: specTitle(sel.value) }); };
  }

  // ---------- routing ----------
  function render() {
    var m = /^#\/a\/(.+)$/.exec(location.hash);
    var id = m ? decodeURIComponent(m[1]) : null;
    renderAccount();
    renderTeacherBar(id);
    if (id) article(id); else home();
  }
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });

  // open every accordion for printing, then put them back
  var openState = [];
  window.addEventListener("beforeprint", function () {
    var d = [].slice.call(document.querySelectorAll("details.term"));
    openState = d.map(function (x) { return x.open; });
    d.forEach(function (x) { x.open = true; });
  });
  window.addEventListener("afterprint", function () {
    [].forEach.call(document.querySelectorAll("details.term"), function (x, i) { x.open = !!openState[i]; });
  });

  // ---------- start ----------
  state.review = storage("get");
  Promise.all([
    fetch("public.json", { cache: "no-cache" }).then(function (r) { return r.json(); }),
    fetch("specs.json", { cache: "no-cache" }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    state.pub = res[0];
    state.specs = res[1].specs;
    state.themes = res[1].themes;
    render();
  }).catch(function () {
    app.innerHTML = '<p class="empty">The articles could not be loaded. Please refresh the page.</p>';
  });
})();
