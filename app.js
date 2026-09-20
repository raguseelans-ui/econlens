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
  // 3.1 with a unit: "%" gives 3.1%, "$bn" gives $3.1bn, "" gives 3.1
  function fmtNum(v, unit) {
    unit = unit || "";
    var sign = v < 0 ? "−" : "";
    var n = Math.abs(v).toLocaleString("en-GB", { maximumFractionDigits: 2 });
    if (/^[£$€]/.test(unit)) return sign + unit.charAt(0) + n + unit.slice(1);
    return sign + n + unit;
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
  function articles() { return (state.teacher || state.pub).map(withReview); }
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
    var first = String(g.summary_250 || "").split(/\n\s*\n/)[0];
    var body = isRelevant(a) && nonEmpty(first)
      ? '<p class="clamp">' + esc(first) + "</p>"
      : (nonEmpty(g.relevance_reason) ? '<p class="reason"><b>Why not relevant:</b> ' + esc(g.relevance_reason) + "</p>" : "");
    return '<article class="pick"' + (t ? ' data-theme="' + t + '"' : "") + '><div class="tags">' + tags + "</div>" +
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
      : '<p class="empty" style="grid-column:1/-1">No articles match. Try clearing the search or filters.</p>';
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
    app.innerHTML = '<div class="dash" style="padding-top:0"><div class="intro"><h1>Economics in the news</h1><p>Recent articles linked to the Edexcel A Level Economics specification, with summaries, data, key terms and practice questions.</p></div>' +
      '<div class="filters no-print" role="search">' +
      '<input id="fq" type="search" placeholder="Search headlines, topics or terms" aria-label="Search articles" value="' + esc(state.f.q) + '">' +
      '<select id="ft" aria-label="Filter by theme">' + opts([["1", "Theme 1"], ["2", "Theme 2"], ["3", "Theme 3"], ["4", "Theme 4"]], state.f.theme, "All themes") + "</select>" +
      '<select id="fs" aria-label="Filter by source">' + opts(sources.map(function (s) { return [s, s]; }), state.f.source, "All sources") + "</select>" +
      (statuses.length ? '<select id="fst" aria-label="Filter by status">' + opts(statuses.map(function (s) { return [s, s]; }), state.f.status, "All statuses") + "</select>" : "") +
      '</div><p class="count" id="count"></p><div class="picker" id="cards"></div></div>';
    document.getElementById("fq").oninput = function (e) { state.f.q = e.target.value; renderCards(); };
    document.getElementById("ft").onchange = function (e) { state.f.theme = e.target.value; renderCards(); };
    document.getElementById("fs").onchange = function (e) { state.f.source = e.target.value; renderCards(); };
    var fst = document.getElementById("fst");
    if (fst) fst.onchange = function (e) { state.f.status = e.target.value; renderCards(); };
    renderCards();
    document.title = "EconLens: Economics in the news";
  }

  // ---------- charts and data visuals ----------
  function niceScale(minv, maxv) {
    var lo0 = Math.min(0, minv), hi0 = Math.max(0, maxv);
    var raw = (hi0 - lo0) / 4 || 1, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    return { lo: Math.floor(lo0 / step) * step, hi: Math.ceil(hi0 / step) * step, step: step };
  }
  function wrapLabel(text, max) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) {
      if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function chartSvg(c) {
    var vals = c.values, n = vals.length, unit = c.unit || "";
    var W = 720, L = 68, R = 16, T = 30, pw = W - L - R;
    var maxLines = Math.max.apply(null, c.labels.map(function (l) { return wrapLabel(l, Math.max(9, Math.floor(pw / n / 7))).length; }));
    var B = 34 + maxLines * 15, H = 240 + B - 34, ph = H - T - B;
    var sc = niceScale(Math.min.apply(null, vals), Math.max.apply(null, vals));
    function y(v) { return T + (sc.hi - v) / (sc.hi - sc.lo) * ph; }
    var out = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' +
      esc((c.title || "Bar chart") + ": " + c.labels.map(function (l, i) { return l + " " + fmtNum(vals[i], unit); }).join("; ")) + '">';
    for (var t = sc.lo; t <= sc.hi + sc.step / 2; t += sc.step) {
      var v = Math.round(t / sc.step) * sc.step;
      out += '<line class="' + (v === 0 ? "zl" : "gl") + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="axis" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmtNum(v, unit)) + "</text>";
    }
    var slot = pw / n, bw = Math.min(96, slot * 0.58), maxChars = Math.max(9, Math.floor(slot / 7));
    vals.forEach(function (val, i) {
      var x = L + slot * i + (slot - bw) / 2, y0 = y(0), y1 = y(val), top = Math.min(y0, y1), h = Math.max(1, Math.abs(y0 - y1));
      var fill = val < 0 ? "var(--bad)" : "var(--accent)";
      out += '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + h + '" rx="2" style="fill:' + fill + '"/>' +
        '<text class="callout" x="' + (x + bw / 2) + '" y="' + (val < 0 ? top + h + 16 : top - 7) + '" text-anchor="middle">' + esc(fmtNum(val, unit)) + "</text>";
      var lines = wrapLabel(c.labels[i], maxChars), cx = x + bw / 2;
      out += '<text class="axis" x="' + cx + '" y="' + (T + ph + 24) + '" text-anchor="middle">' +
        lines.map(function (ln, k) { return '<tspan x="' + cx + '" dy="' + (k ? 15 : 0) + '">' + esc(ln) + "</tspan>"; }).join("") + "</text>";
    });
    return out + "</svg>";
  }
  // line or step chart drawn only from figures the article states.
  // series: [{name, points: [[label, value], ...]}]; labels are ISO dates or the article's own wording.
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function monthYear(iso) { return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" }); }
  function trendSeries(t) {
    var list = Array.isArray(t.series) && t.series.length ? t.series : [{ name: "", points: t.points }];
    return list.slice(0, 3).map(function (s) {
      return { name: s.name || "", points: (s.points || []).filter(function (p) { return Array.isArray(p) && typeof p[1] === "number"; }) };
    }).filter(function (s) { return s.points.length >= 2; });
  }
  var LINE_COLOURS = ["var(--accent)", "var(--hi)", "#56656e"];
  function trendSvg(t, series) {
    var W = 720, H = 310, L = 56, R = 34, T = 30, B = 52, pw = W - L - R, ph = H - T - B, unit = t.unit || "";
    var labels = [], vals = [];
    series.forEach(function (s) { s.points.forEach(function (p) { vals.push(p[1]); if (labels.indexOf(p[0]) === -1) labels.push(p[0]); }); });
    var isDate = labels.every(function (l) { return ISO.test(l); });
    var ref = t.reference && typeof t.reference.value === "number" ? t.reference.value : null;
    if (ref !== null) vals.push(ref);
    var sc = niceScale(Math.min.apply(null, vals), Math.max.apply(null, vals));
    var xs = {}, d0, d1;
    if (isDate) {
      var times = labels.map(function (l) { return new Date(l + "T00:00:00").getTime(); });
      d0 = Math.min.apply(null, times); d1 = Math.max.apply(null, times);
      labels.forEach(function (l, i) { xs[l] = L + (times[i] - d0) / ((d1 - d0) || 1) * pw; });
    } else {
      labels.forEach(function (l, i) { xs[l] = L + pw * (i + 0.5) / labels.length; });
    }
    function y(v) { return T + (sc.hi - v) / (sc.hi - sc.lo) * ph; }
    var summary = series.map(function (s) {
      var f = s.points[0], l = s.points[s.points.length - 1];
      return (s.name ? s.name + ": " : "") + "from " + fmtNum(f[1], unit) + " (" + f[0] + ") to " + fmtNum(l[1], unit) + " (" + l[0] + ")";
    }).join("; ");
    var out = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc((t.title || "Chart") + ". " + summary + ".") + '">';
    for (var tk = sc.lo; tk <= sc.hi + sc.step / 2; tk += sc.step) {
      var gv = Math.round(tk / sc.step) * sc.step;
      out += '<line class="' + (gv === 0 ? "zl" : "gl") + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(gv) + '" y2="' + y(gv) + '"/>' +
        '<text class="axis" x="' + (L - 8) + '" y="' + (y(gv) + 4) + '" text-anchor="end">' + esc(fmtNum(gv, unit)) + "</text>";
    }
    // x axis labels
    if (isDate) {
      var yr0 = new Date(d0).getFullYear(), yr1 = new Date(d1).getFullYear();
      if (yr1 - yr0 >= 3) {
        var every = yr1 - yr0 > 8 ? 2 : 1;
        for (var yr = yr0; yr <= yr1; yr += every) {
          var xx = L + (new Date(yr, 0, 1).getTime() - d0) / ((d1 - d0) || 1) * pw;
          if (xx >= L - 1 && xx <= W - R + 1) out += '<text class="axis" x="' + Math.max(L, xx) + '" y="' + (H - 18) + '" text-anchor="middle">' + yr + "</text>";
        }
      } else {
        var step = Math.ceil(labels.length / 7);
        labels.forEach(function (l, i) { if (i % step === 0) out += '<text class="axis" x="' + xs[l] + '" y="' + (H - 18) + '" text-anchor="middle">' + esc(monthYear(l)) + "</text>"; });
      }
    } else {
      var skip = Math.ceil(labels.length / Math.max(2, Math.floor(pw / 70))), maxChars = Math.max(6, Math.floor(pw / labels.length / 7));
      labels.forEach(function (l, i) {
        if (i % skip !== 0) return;
        out += '<text class="axis" x="' + xs[l] + '" y="' + (T + ph + 20) + '" text-anchor="middle">' +
          wrapLabel(l, maxChars * skip).slice(0, 2).map(function (ln, k) { return '<tspan x="' + xs[l] + '" dy="' + (k ? 14 : 0) + '">' + esc(ln) + "</tspan>"; }).join("") + "</text>";
      });
    }
    if (ref !== null) {
      out += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(ref) + '" y2="' + y(ref) + '" style="stroke:var(--muted);stroke-dasharray:2 4"/>' +
        '<text class="axis" x="' + (W - R - 2) + '" y="' + (y(ref) + 16) + '" text-anchor="end">' + esc(t.reference.label || "") + "</text>";
    }
    var few = series.every(function (s) { return s.points.length <= 12; });
    series.forEach(function (s, si) {
      var col = LINE_COLOURS[si], d = "";
      s.points.forEach(function (p, i) {
        var px = xs[p[0]].toFixed(1), py = y(p[1]).toFixed(1);
        d += i === 0 ? "M" + px + "," + py : (t.type === "step" ? " H" + px + " V" + py : " L" + px + "," + py);
      });
      out += '<path d="' + d + '" fill="none" style="stroke:' + col + ';stroke-width:3;stroke-linejoin:round"/>';
      s.points.forEach(function (p, i) {
        var end = i === 0 || i === s.points.length - 1;
        if (!few && !end) return;
        out += '<circle cx="' + xs[p[0]] + '" cy="' + y(p[1]) + '" r="' + (end ? 4.5 : 3.5) + '" style="fill:' + col + '"/>';
        var showLabel = series.length === 1 ? (few || end) : i === s.points.length - 1;
        if (showLabel) {
          var above = si === 0 || series.length === 1;
          out += '<text class="callout" x="' + xs[p[0]] + '" y="' + (y(p[1]) + (above ? -11 : 20)) + '" text-anchor="' + (i === s.points.length - 1 ? "end" : i === 0 ? "start" : "middle") + '">' + esc(fmtNum(p[1], unit)) + "</text>";
        }
      });
    });
    return out + "</svg>";
  }
  function trendLegend(series) {
    if (series.length < 2) return "";
    return '<div class="legend">' + series.map(function (s, i) {
      return '<span style="--c:' + LINE_COLOURS[i] + '">' + esc(s.name) + "</span>";
    }).join("") + "</div>";
  }
  function pct(v, total) { var p = v / total * 100; return (p % 1 === 0 ? p : p.toFixed(1)) + "%"; }
  function shareHtml(s) {
    var parts = (s.parts || []).filter(function (p) { return typeof p.value === "number"; });
    if (!parts.length) return "";
    var total = s.total || parts.reduce(function (a, p) { return a + p.value; }, 0), bar = "", legend = "";
    if (s.count) {
      parts.forEach(function (p) { for (var i = 0; i < p.value; i++) bar += '<i' + (p.highlight ? ' class="hi"' : "") + ' style="flex:1"></i>'; });
    } else {
      parts.forEach(function (p) { bar += '<i' + (p.highlight ? ' class="hi"' : "") + ' style="width:' + (p.value / total * 100) + '%"></i>'; });
    }
    parts.forEach(function (p) {
      legend += '<span class="' + (p.highlight ? "hi" : "") + '">' + esc(p.label) + ": " + esc(s.count ? p.value : fmtNum(p.value, s.unit)) +
        (s.count ? "" : " (" + pct(p.value, total) + ")") + "</span>";
    });
    return '<div class="panel" style="margin-top:1rem">' + (nonEmpty(s.title) ? "<h3>" + esc(s.title) + "</h3>" : "") +
      '<div class="share' + (s.count ? "" : " solid") + '" role="img" aria-label="' + esc((s.title || "") + ": " + parts.map(function (p) { return p.label + " " + p.value; }).join(", ")) + '">' + bar + "</div>" +
      '<div class="legend">' + legend + "</div>" + (nonEmpty(s.note) ? '<p class="note" style="margin:0">' + esc(s.note) + "</p>" : "") + "</div>";
  }
  function barsHtml(b) {
    var rows = (b.rows || []).filter(function (r) { return typeof r.value === "number"; });
    if (!rows.length) return "";
    var max = b.max || Math.max.apply(null, rows.map(function (r) { return r.value; }));
    return '<div class="panel" style="margin-top:1rem">' + (nonEmpty(b.title) ? "<h3>" + esc(b.title) + "</h3>" : "") +
      rows.map(function (r) {
        return '<div class="mrow"><span>' + esc(r.label) + '</span><i style="--w:' + Math.max(2, r.value / max * 100) + '%"></i><b>' + esc(fmtNum(r.value, b.unit)) + "</b></div>";
      }).join("") + (nonEmpty(b.note) ? '<p class="note" style="margin:.6rem 0 0">' + esc(b.note) + "</p>" : "") + "</div>";
  }
  function pointsHtml(v) {
    var pts = (v.points || []).filter(function (p) { return nonEmpty(p.text); });
    if (!pts.length) return "";
    return '<h3 style="margin-top:1.6rem">' + esc(v.points_title || "More context") + '</h3><div class="evals">' +
      pts.map(function (p) { return '<div class="eval">' + (nonEmpty(p.label) ? "<b>" + esc(p.label) + "</b>" : "") + esc(p.text) + "</div>"; }).join("") + "</div>";
  }
  function dataSection(g) {
    var v = g.visuals;
    if (!v) return "";
    var html = "", c = v.chart, tr = v.trend;
    var trS = tr ? trendSeries(tr) : [];
    if (trS.length) {
      html += '<div class="panel" style="margin-bottom:1rem">' + (nonEmpty(tr.title) ? "<h3>" + esc(tr.title) + "</h3>" : "") + trendLegend(trS) +
        '<div class="chart-wrap">' + trendSvg(tr, trS) + "</div>" + (nonEmpty(tr.caption) ? '<p class="chart-caption">' + esc(tr.caption) + (Array.isArray(tr.sources) && tr.sources.length
          ? " Data: " + tr.sources.filter(function (x) { return safeUrl(x.url); }).map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.name) + "</a>"; }).join(", ") + "." : "") + "</p>" : "") + "</div>";
    }
    if (c && Array.isArray(c.values) && c.values.length && c.values.length === (c.labels || []).length) {
      html += '<div class="panel">' + (nonEmpty(c.title) ? "<h3>" + esc(c.title) + "</h3>" : "") + '<div class="chart-wrap">' + chartSvg(c) + "</div>" +
        (nonEmpty(c.caption) ? '<p class="chart-caption">' + esc(c.caption) + "</p>" : "") + "</div>";
    }
    var facts = (v.facts || []).filter(function (f) { return nonEmpty(f.value); });
    if (facts.length) html += '<div class="facts">' + facts.map(function (f) { return '<div class="fact"><b>' + esc(f.value) + "</b><span>" + esc(f.label) + "</span></div>"; }).join("") + "</div>";
    if (v.share) html += shareHtml(v.share);
    if (v.bars) html += barsHtml(v.bars);
    html += pointsHtml(v);
    return html ? '<section id="sec-data"><h2>' + esc(v.title || "The data") + "</h2>" + html + "</section>" : "";
  }

  // ---------- article sections ----------
  function summarySection(g) {
    var body = nonEmpty(g.summary_250) ? paras(g.summary_250) : "";
    var why = nonEmpty(g.why_it_matters) ? '<h3 style="margin-top:1.6rem">Why it matters</h3><div class="panel tint">' + paras(g.why_it_matters) + "</div>" : "";
    return body || why ? '<section id="sec-summary"><h2>Summary</h2>' + body + why + "</section>" : "";
  }
  function splitLabel(s) {
    var m = /^([^:]{2,40}):\s+([\s\S]+)$/.exec(s);
    return m ? { label: m[1], text: m[2] } : { label: "", text: s };
  }
  function theorySection(g) {
    var t = g.theory || {}, html = "";
    if (nonEmpty(t.concepts)) html += '<h3>Concepts to bring in</h3><ul class="tight" style="margin-bottom:1.6rem;columns:2 280px">' + t.concepts.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
    var steps = nonEmpty(t.chain_steps) ? t.chain_steps : String(t.chain_of_reasoning || "").split(/(?<=[.!?])\s+(?=[A-Z])/).filter(nonEmpty);
    if (steps.length) html += "<h3>Applying the theory</h3><ol class=\"chain\">" + steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    if (nonEmpty(t.evaluation_points)) {
      html += '<h3 style="margin-top:1.4rem">Evaluation points</h3><div class="evals">' + t.evaluation_points.map(function (e) {
        var p = splitLabel(e);
        return '<div class="eval">' + (p.label ? "<b>" + esc(p.label) + "</b>" : "") + esc(p.text) + "</div>";
      }).join("") + "</div>";
    }
    return html ? '<section id="sec-theory"><h2>Theory connections</h2>' + html + "</section>" : "";
  }
  function termsSection(g) {
    var terms = (g.key_terms || []).filter(function (t) { return nonEmpty(t.term); })
      .sort(function (a, b) { return a.term.localeCompare(b.term, "en-GB", { sensitivity: "base" }); });
    return terms.length ? '<section id="sec-terms"><h2>Key terms</h2><dl class="terms">' + terms.map(function (t) {
      return "<div><dt>" + esc(t.term) + "</dt><dd>" + esc(t.definition) + "</dd></div>";
    }).join("") + "</dl></section>" : "";
  }

  // mark scheme text -> rows of assessment objectives
  var AO = { Knowledge: "AO1", Application: "AO2", Analysis: "AO3", Evaluation: "AO4" };
  function parseAO(text, withMarks) {
    var re = withMarks
      ? /(Knowledge|Application|Analysis|Evaluation)\s*\((\d+)\s*marks?\):\s*/g
      : /(Knowledge|Application|Analysis|Evaluation)((?: (?:for|of|against) [a-z ]+?)?):\s*/g;
    var hits = [], m;
    while ((m = re.exec(text))) hits.push({ ao: m[1], extra: withMarks ? m[2] : (m[2] || "").trim(), start: m.index, end: re.lastIndex });
    if (!hits.length) return null;
    var rows = hits.map(function (h, i) {
      var body = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length).trim();
      return { label: AO[h.ao] + (withMarks ? " · " + h.extra : ""), sub: withMarks ? "" : h.extra, text: body };
    });
    var note = "", last = rows[rows.length - 1], k = last.text.search(/\s+Award /);
    if (k > -1) { note = last.text.slice(k).trim(); last.text = last.text.slice(0, k).trim(); }
    return { rows: rows, note: note };
  }
  function aoHtml(parsed) {
    return '<div class="ao">' + parsed.rows.map(function (r) {
      return "<b>" + esc(r.label) + (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") + "</b><span>" + esc(r.text) + "</span>";
    }).join("") + "</div>" + (parsed.note ? '<p class="note" style="margin:.8rem 0 0">' + esc(parsed.note) + "</p>" : "");
  }
  function levelsHtml(text) {
    var re = /Level (\d)\s*\(([^)]+?)(?: marks?)?\):\s*/g, hits = [], m;
    while ((m = re.exec(text))) hits.push({ n: m[1], marks: m[2], start: m.index, end: re.lastIndex });
    if (!hits.length) return "<p>" + esc(text) + "</p>";
    var note = text.slice(0, hits[0].start).trim();
    return '<div class="levels">' + hits.map(function (h, i) {
      return '<div class="level"><b>Level ' + h.n + " · " + esc(h.marks) + " marks</b><br>" + esc(text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length).trim()) + "</div>";
    }).join("") + "</div>" + (note ? '<p class="note" style="margin:.8rem 0 0">' + esc(note) + "</p>" : "");
  }
  function cleanQuestion(q) { return String(q || "").replace(/\s*\(\s*\d+\s*marks?\s*\)\s*$/i, ""); }
  function commandWord(q) { var m = /^\s*([A-Za-z]+)/.exec(q || ""); return m ? m[1] : ""; }
  function linesHtml(rows) { return '<div class="lines" aria-hidden="true">' + new Array(rows + 1).join("<i></i>") + "</div>"; }

  function examSection(g) {
    var html = "", mcqs = (g.mcqs || []).filter(function (q) { return nonEmpty(q.question) && q.options; });
    if (mcqs.length) {
      html += '<h3>Multiple choice</h3><div id="mcqs">';
      mcqs.forEach(function (q, i) {
        html += '<div class="q mcq" data-i="' + i + '" data-answer="' + esc(q.answer) + '" data-expl="' + esc(q.explanation) + '"' + (i ? " hidden" : "") + ">" +
          '<div class="qlabel">Question ' + (i + 1) + " of " + mcqs.length + (nonEmpty(q.type) ? " &middot; " + esc(q.type) : "") + '</div><div class="qtxt">' + esc(q.question) + '</div><div class="opts">' +
          Object.keys(q.options).sort().map(function (k) {
            return '<button type="button" class="opt" data-k="' + esc(k) + '"><span class="l">' + esc(k) + "</span>" + esc(q.options[k]) + "</button>";
          }).join("") + '</div><div class="explain" hidden></div><div class="mcqnav no-print"></div></div>';
      });
      html += '<div class="q" id="mcqresult" hidden><div class="qtxt" id="mcqscore"></div><div class="mcqnav"><button type="button" class="btn" id="mcqretry">Try again</button></div></div></div>';
    }
    var sa = g.short_answer || {};
    if (nonEmpty(sa.question)) {
      var parsed = parseAO(sa.mark_scheme || "", true);
      html += '<h3 style="margin-top:2rem">Short answer &middot; ' + esc(sa.marks || 4) + " marks &middot; " + esc(commandWord(sa.question)) + "</h3>" +
        '<div class="q"><div class="qtxt">' + esc(cleanQuestion(sa.question)) + "</div>" +
        '<textarea class="attempt" data-for="sa" aria-label="Your answer to the short answer question"></textarea>' + linesHtml(8) +
        (nonEmpty(sa.mark_scheme)
          ? '<p class="hint no-print" data-hint="sa"></p><button type="button" class="btn reveal" data-target="sa-ans" data-attempt="sa">Show mark scheme</button>' +
            '<div class="answer" id="sa-ans" hidden><h4>Mark scheme</h4>' + (parsed ? aoHtml(parsed) : "<p>" + esc(sa.mark_scheme) + "</p>") + "</div>" : "") + "</div>";
    }
    var ex = g.extended || {};
    if (nonEmpty(ex.question)) {
      var has = nonEmpty(ex.indicative_content) || nonEmpty(ex.level_descriptors);
      var ic = nonEmpty(ex.indicative_content) ? parseAO(ex.indicative_content, false) : null;
      html += '<h3 style="margin-top:2rem">Extended answer &middot; ' + esc(ex.marks || 10) + " marks &middot; " + esc(commandWord(ex.question)) + "</h3>" +
        '<div class="q"><div class="qtxt">' + esc(cleanQuestion(ex.question)) + "</div>" +
        '<textarea class="attempt" data-for="ex" style="min-height:13rem" aria-label="Your answer to the extended question"></textarea>' + linesHtml(16) +
        (has ? '<p class="hint no-print" data-hint="ex"></p><button type="button" class="btn reveal" data-target="ex-ans" data-attempt="ex">Show indicative content</button>' +
          '<div class="answer" id="ex-ans" hidden>' +
          (nonEmpty(ex.indicative_content) ? "<h4>Indicative content</h4>" + (ic ? aoHtml(ic) : "<p>" + esc(ex.indicative_content) + "</p>") : "") +
          (nonEmpty(ex.level_descriptors) ? "<h4>Level descriptors</h4>" + levelsHtml(ex.level_descriptors) : "") + "</div>" : "") + "</div>";
    }
    return html ? '<section id="sec-practice"><h2>Exam practice</h2>' + html + "</section>" : "";
  }
  function discussSection(g) {
    var d = g.discussion || {};
    if (!nonEmpty(d.prompt)) return "";
    return '<section id="sec-discuss"><h2>Class discussion</h2><div class="discuss"><p class="prompt">' + esc(d.prompt) + "</p>" +
      (isTeacher() && nonEmpty(d.teacher_note) ? '<p class="note"><b>Teacher note:</b> ' + esc(d.teacher_note) + "</p>" : "") + "</div></section>";
  }

  // ---------- article page ----------
  function article(id) {
    var a = articles().filter(function (x) { return x.id === id; })[0];
    if (!a) { app.innerHTML = '<div class="dash" style="padding-top:0"><p class="empty">That article could not be found. It may not be published yet. <a href="#/">Back to all articles</a></p></div>'; return; }
    var g = a.generated || {}, m = g.mapping || {}, t = themeOf(a), st = statusInfo(a), link = safeUrl(a.url);
    document.body.setAttribute("data-theme", t);

    var chips = "";
    if (t) {
      chips += '<span class="chip primary">' + esc(m.primary_code + " " + m.primary_title) + "</span>";
      (m.secondary_codes || []).forEach(function (c) { chips += '<span class="chip">' + esc(c + " " + specTitle(c)) + "</span>"; });
      if (nonEmpty(m.confidence_band)) chips += '<span class="chip">Mapping confidence: ' + esc(m.confidence_band) + (isTeacher() && typeof m.confidence === "number" ? " (" + Math.round(m.confidence * 100) + "%)" : "") + "</span>";
    }
    chips += '<span class="status ' + st.cls + '" style="margin-left:0">' + st.label + "</span>";

    var intro = "";
    if (nonEmpty(m.justification)) intro += "<p>" + esc(m.justification) + "</p>";
    if (nonEmpty(m.cross_theme_note)) intro += "<p><b>Cross-theme links:</b> " + esc(m.cross_theme_note) + "</p>";
    if (!isRelevant(a) && nonEmpty(g.relevance_reason)) intro += "<p><b>Marked as not relevant:</b> " + esc(g.relevance_reason) + "</p>";

    var banner = a.status === "Approved" && isRelevant(a)
      ? '<p class="banner reviewed">Reviewed by a teacher</p>'
      : '<p class="banner">AI-generated resources. Not official Edexcel material.</p>';
    if (!link && isTeacher()) banner += '<p class="banner warn">There is no link to the original article. Add one in the data file before approving, because students need it.</p>';

    var sections = [
      ["sec-data", "The data", dataSection(g)], ["sec-summary", "Summary", summarySection(g)], ["sec-theory", "Theory", theorySection(g)],
      ["sec-terms", "Key terms", termsSection(g)], ["sec-practice", "Exam practice", examSection(g)], ["sec-discuss", "Discussion", discussSection(g)]
    ].filter(function (s) { return s[2]; });

    app.innerHTML = '<div class="layout"><nav class="toc no-print" aria-label="Contents"><a class="back" href="#/">&larr; All articles</a><p>On this page</p>' +
      sections.map(function (s) { return '<a href="#/a/' + encodeURIComponent(a.id) + '" data-scroll="' + s[0] + '">' + s[1] + "</a>"; }).join("") + "</nav>" +
      '<main><header class="hero"><div class="chips">' + chips + "</div><h1>" + esc(a.headline) + "</h1>" +
      '<p class="meta">Source: ' + esc(a.source) + ", " + esc(fmtDate(a.date)) + ".</p>" + intro + banner +
      '<div class="toolbar no-print">' + (link ? '<a class="btn primary" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Read the full article &#8599;</a>' : "") +
      '<button type="button" class="btn" id="printbtn">Print or save as PDF</button></div>' +
      (link ? '<p class="print-link note" style="margin-top:.6rem">Full article: ' + esc(link) + "</p>" : "") + "</header>" +
      sections.map(function (s) { return s[2]; }).join("") + "</main></div>";
    wireArticle(a);
    document.title = a.headline + " | EconLens";
  }

  function wireArticle() {
    [].forEach.call(app.querySelectorAll("nav.toc a[data-scroll]"), function (l) {
      l.onclick = function (e) { e.preventDefault(); var el = document.getElementById(l.getAttribute("data-scroll")); if (el) el.scrollIntoView(); };
    });
    document.getElementById("printbtn").onclick = function () { window.print(); };

    // multiple choice: one question at a time
    var qs = [].slice.call(app.querySelectorAll("#mcqs .mcq[data-i]")), score = 0;
    function show(i) { qs.forEach(function (q, n) { q.hidden = n !== i; }); document.getElementById("mcqresult").hidden = true; }
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
          var ex = q.querySelector(".explain");
          ex.innerHTML = (pick === ans ? "<b>Correct.</b> " : "<b>Not quite.</b> The answer is " + esc(ans) + ". ") + esc(q.getAttribute("data-expl"));
          ex.hidden = false;
          var nav = q.querySelector(".mcqnav");
          nav.innerHTML = '<button type="button" class="btn primary">' + (n < qs.length - 1 ? "Next question" : "See your score") + "</button>";
          nav.firstChild.onclick = function () {
            if (n < qs.length - 1) show(n + 1);
            else {
              qs.forEach(function (x) { x.hidden = true; });
              document.getElementById("mcqscore").textContent = "You scored " + score + " out of " + qs.length + ".";
              document.getElementById("mcqresult").hidden = false;
            }
          };
        };
      });
    });
    var retry = document.getElementById("mcqretry");
    if (retry) retry.onclick = function () { score = 0; render(); document.getElementById("sec-practice").scrollIntoView(); };

    // answers unlock for students once they have made an attempt
    [].forEach.call(app.querySelectorAll(".reveal"), function (btn) {
      var box = app.querySelector('textarea[data-for="' + btn.getAttribute("data-attempt") + '"]');
      var hint = app.querySelector('[data-hint="' + btn.getAttribute("data-attempt") + '"]');
      var target = document.getElementById(btn.getAttribute("data-target"));
      function refresh() {
        var ready = isTeacher() || box.value.trim().length >= 15;
        btn.disabled = !ready;
        if (hint) hint.textContent = ready ? "" : "Write your answer first. The answer guide unlocks once you have made an attempt.";
      }
      box.oninput = refresh;
      refresh();
      var label = btn.textContent;
      btn.onclick = function () { target.hidden = !target.hidden; btn.textContent = target.hidden ? label : label.replace("Show", "Hide"); };
    });
  }

  // ---------- teacher bar ----------
  function lessonText(a) {
    var g = a.generated || {}, out = [];
    out.push(a.headline + " (" + a.source + ", " + fmtDate(a.date) + ")");
    if (safeUrl(a.url)) out.push(a.url);
    if (nonEmpty(g.mapping && g.mapping.primary_code)) out.push("Specification: " + g.mapping.primary_code + " " + g.mapping.primary_title);
    if (nonEmpty(g.summary_250)) out.push("\nSUMMARY\n" + g.summary_250);
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
    var html = '<div class="in no-print"><div class="row"><b>Teacher view</b>';
    if (a) {
      html += '<button class="btn good" data-act="approve">Approve</button><button class="btn bad" data-act="flag">Flag</button>' +
        '<button class="btn" data-act="pending">Reset to pending</button>';
      if (a.generated && a.generated.mapping) {
        var cur = a.generated.mapping.primary_code || "";
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
        '<button class="linkbtn inline" data-act="download">Download review file</button> and save it as data/review.json, then publish, or ' +
        '<button class="linkbtn inline" data-act="clear">clear local changes</button>.</p>';
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
    document.body.setAttribute("data-theme", "");
    renderAccount();
    renderTeacherBar(id);
    if (id) article(id); else home();
  }
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });

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
    app.innerHTML = '<div class="dash"><p class="empty">The articles could not be loaded. Please refresh the page.</p></div>';
  });
})();
