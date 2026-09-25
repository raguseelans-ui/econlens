// Figures section: trend chart, bar chart, headline figures, share bar, list of rates, context points.
import { esc, has, safeUrl } from "../util.js";
import { barChart } from "../charts/bar.js";
import { trendChart, trendSeries, trendLegend } from "../charts/trend.js";
import { shareBlock, barsBlock, pointsBlock } from "../charts/parts.js";

function sourceLinks(t) {
  const links = (t.sources || []).filter((s) => safeUrl(s.url))
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`);
  return links.length ? " Data: " + links.join(", ") + "." : "";
}

export default {
  id: "data",
  navKey: "nav_data",
  render(art, ctx) {
    const v = art.visuals;
    if (!v) return "";
    let html = "";
    const t = v.trend, series = t ? trendSeries(t) : [];
    if (series.length) {
      html += `<div class="panel" style="margin-bottom:1rem">${has(t.title) ? `<h3>${esc(t.title)}</h3>` : ""}${trendLegend(series)}` +
        `<div class="chart-wrap">${trendChart(t, series)}</div>` +
        (has(t.caption) ? `<p class="chart-caption">${esc(t.caption)}${sourceLinks(t)}</p>` : "") + "</div>";
    }
    const c = v.chart;
    if (c && Array.isArray(c.values) && c.values.length && c.values.length === (c.labels || []).length) {
      html += `<div class="panel">${has(c.title) ? `<h3>${esc(c.title)}</h3>` : ""}<div class="chart-wrap">${barChart(c)}</div>` +
        (has(c.caption) ? `<p class="chart-caption">${esc(c.caption)}</p>` : "") + "</div>";
    }
    const facts = (v.facts || []).filter((f) => has(f.value));
    if (facts.length) html += '<div class="facts">' + facts.map((f) => `<div class="fact"><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`).join("") + "</div>";
    if (v.share) html += shareBlock(v.share);
    if (v.bars) html += barsBlock(v.bars);
    html += pointsBlock(v);
    return html ? `<section id="sec-data"><h2>${esc(v.title || ctx.cur.label("data_title_default"))}</h2>${html}</section>` : "";
  },
};
