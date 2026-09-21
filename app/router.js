// Hash routes: "#/" is the home page, "#/a/<id>" is an article.

export function currentRoute() {
  const m = /^#\/a\/(.+)$/.exec(location.hash);
  return m ? { name: "article", id: decodeURIComponent(m[1]) } : { name: "home" };
}

export function articleHref(id) {
  return "#/a/" + encodeURIComponent(id);
}

export function onRouteChange(fn) {
  window.addEventListener("hashchange", () => {
    fn(currentRoute());
    window.scrollTo(0, 0);
  });
}
