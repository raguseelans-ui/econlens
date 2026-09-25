// Loads the published files and holds the app's state. It knows where files are and how they are
// encrypted. It knows nothing about the economics inside them.
import { deriveKey, decryptJson } from "./crypto.js";

export const SUPPORTED_CONTRACT = ["0.1"]; // major.minor versions this app can display
const REVIEW_KEY = "econlens-review";

export const state = {
  config: null,
  index: null,          // public index
  teacherKey: null,     // set after login
  teacherIndex: null,   // every article, including pending and flagged
  review: readReview(), // teacher changes not yet applied to the database
  filters: { q: "", theme: "", source: "", status: "" },
};
const articleCache = new Map();

async function getJson(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function init() {
  const [config, index] = await Promise.all([getJson("config/curriculum.json"), getJson("content/index.json")]);
  const major = String(index.contract_version).split(".").slice(0, 2).join(".");
  if (!SUPPORTED_CONTRACT.includes(major)) {
    throw new Error(`These files use data contract ${index.contract_version}, which this version of the site cannot display.`);
  }
  state.config = config;
  state.index = index;
}

export const isTeacher = () => !!state.teacherKey;

// ---------------------------------------------------------------- teacher session
export async function teacherLogin(password) {
  const info = await getJson("teacher/key.json");
  const key = await deriveKey(password, info);
  const index = await decryptJson(key, await getJson("teacher/index.enc"));
  state.teacherKey = key;
  state.teacherIndex = index;
  articleCache.clear();
}

export function teacherLogout() {
  state.teacherKey = null;
  state.teacherIndex = null;
  state.filters.status = "";
  articleCache.clear();
}

// ---------------------------------------------------------------- reading
export function entries() {
  const list = isTeacher() ? state.teacherIndex.articles : state.index.articles;
  if (!isTeacher()) return list; // unpublished review changes are for the teacher's own view only
  return list.map((e) => {
    const r = state.review[e.id];
    return r ? { ...e, status: r.status || e.status, primary: r.primary || e.primary } : e;
  });
}

export async function loadArticle(id) {
  const entry = (isTeacher() ? state.teacherIndex : state.index).articles.find((e) => e.id === id);
  if (!entry) throw new Error("not found");
  if (!articleCache.has(id)) {
    const blob = await getJson(entry.file);
    articleCache.set(id, isTeacher() ? await decryptJson(state.teacherKey, blob) : blob);
  }
  return isTeacher() ? applyReview(articleCache.get(id)) : articleCache.get(id);
}

// ---------------------------------------------------------------- teacher review overlay
function readReview() {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}"); } catch (e) { return {}; }
}

export function setReview(id, patch) {
  state.review[id] = { ...state.review[id], ...patch };
  try { localStorage.setItem(REVIEW_KEY, JSON.stringify(state.review)); } catch (e) { /* kept in memory only */ }
}

export function clearReview() {
  state.review = {};
  try { localStorage.setItem(REVIEW_KEY, "{}"); } catch (e) { /* ignore */ }
}

export const reviewCount = () => Object.keys(state.review).length;

export function applyReview(article) {
  const r = state.review[article.id];
  if (!r) return article;
  const copy = JSON.parse(JSON.stringify(article));
  if (r.status) copy.state = { ...(copy.state || {}), status: r.status };
  if (r.primary && copy.mapping && copy.mapping.primary !== r.primary) {
    // The new main code swaps places with the old one, as the review tool does when the change is applied.
    const old = copy.mapping.primary;
    copy.mapping.secondary = (copy.mapping.secondary || []).map((c) => (c === r.primary ? old : c));
    copy.mapping.primary = r.primary;
  }
  return copy;
}

export function reviewFileText() {
  return JSON.stringify(state.review, null, 2);
}
