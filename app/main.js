// Start-up: load the config and index, then draw whichever page the address asks for.
import * as store from "./store.js";
import { makeCurriculum } from "./curriculum.js";
import { currentRoute, onRouteChange } from "./router.js";
import { initMode } from "./theme.js";
import { esc } from "./util.js";
import { renderAccount, initLogin } from "./components/chrome.js";
import { renderTeacherBar } from "./components/teacher.js";
import { renderHome } from "./components/home.js";
import { renderArticle } from "./components/article.js";

const ctx = {
  store,
  cur: null,
  isTeacher: () => store.isTeacher(),
  render: () => render(),
  rerender: () => render(),
  renderTeacherBar: (art) => renderTeacherBar(ctx, art),
};

async function render() {
  const route = currentRoute();
  document.body.dataset.colour = "";
  renderAccount(ctx);
  if (route.name === "article") await renderArticle(ctx, route.id);
  else renderHome(ctx);
}

async function start() {
  initMode();
  try {
    await store.init();
    ctx.cur = makeCurriculum(store.state.config);
  } catch (e) {
    document.getElementById("app").innerHTML = `<div class="dash"><p class="empty">${String(e.message || "The articles could not be loaded. Please refresh the page.")}</p></div>`;
    return;
  }
  const site = ctx.cur.config.site;
  document.querySelector(".brand").innerHTML = `${esc(site.name)}<span class="tag-line">${esc(site.tagline)}</span>`;
  initLogin(ctx);
  onRouteChange(render);
  render();
}

start();
