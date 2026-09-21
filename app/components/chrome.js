// Top bar buttons (light/dark, teacher login and logout) and the login dialog.
import { toggleMode } from "../theme.js";

export function renderAccount(ctx) {
  const el = document.getElementById("account");
  el.innerHTML = '<button class="linkbtn" id="modebtn" type="button" aria-label="Switch between light and dark mode">Switch light / dark</button>' +
    (ctx.store.isTeacher()
      ? '<button class="linkbtn" id="logout" type="button">Log out of teacher view</button>'
      : '<button class="linkbtn" id="login-open" type="button">Teacher login</button>');
  document.getElementById("modebtn").onclick = toggleMode;
  const out = document.getElementById("logout"), open = document.getElementById("login-open");
  if (out) out.onclick = () => { ctx.store.teacherLogout(); ctx.render(); };
  if (open) open.onclick = () => { document.getElementById("login").showModal(); document.getElementById("pw").focus(); };
}

export function initLogin(ctx) {
  const dialog = document.getElementById("login"), err = document.getElementById("loginerr");
  document.getElementById("logincancel").onclick = () => dialog.close();
  document.getElementById("loginform").onsubmit = async (e) => {
    e.preventDefault();
    err.hidden = true;
    try {
      await ctx.store.teacherLogin(document.getElementById("pw").value);
      document.getElementById("pw").value = "";
      dialog.close();
      ctx.render();
    } catch (ex) {
      err.textContent = ex && ex.message === "secure" ? "Teacher login needs a secure (https) connection." : "That password did not work. Please try again.";
      err.hidden = false;
    }
  };
}
