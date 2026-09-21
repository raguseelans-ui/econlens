// Small helpers with no knowledge of economics or the curriculum.

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function safeUrl(u) {
  return /^https?:\/\//i.test(u || "") ? u : "";
}

// True for a non-empty list, a non-blank string, or any other present value.
export function has(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "";
  return v != null && v !== false;
}

export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "";
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// 3.1 with unit "%" gives 3.1%, "$bn" gives $3.1bn, "" gives 3.1
export function fmtNum(v, unit) {
  unit = unit || "";
  const sign = v < 0 ? "−" : "";
  const n = Math.abs(v).toLocaleString("en-GB", { maximumFractionDigits: 2 });
  if (/^[£$€]/.test(unit)) return sign + unit.charAt(0) + n + unit.slice(1);
  return sign + n + unit;
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
