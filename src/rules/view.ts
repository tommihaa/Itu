// Renderöi selkosäännöt HTML:ksi src/rules/content.ts:stä. Samaa tulostetta
// käyttää sekä pelin sisäinen näkymä että tuloste (@media print, ks. styles.css).
import { RULES, RULES_LEAD, RULES_TITLE, type RuleGroup } from "./content";

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function groupHtml(g: RuleGroup): string {
  const sign = g.accept ? "✓" : "✗";
  const cls = g.accept ? "ok" : "bad";
  const items = g.examples
    .map(
      (e) =>
        `<li><b>${escape(e.word)}</b>${e.hint ? ` <span class="hint">${escape(e.hint)}</span>` : ""}</li>`,
    )
    .join("");
  return `
    <div class="sm-rule-group ${cls}">
      <h4><span class="sign">${sign}</span> ${escape(g.title)}</h4>
      <ul>${items}</ul>
    </div>`;
}

/** Pelkkä sääntösisältö (ilman painikkeita) — käytetään näkymässä ja tulosteessa. */
export function renderRulesContent(): string {
  const sections = RULES.map((s) => {
    const body = s.body
      ? `<p>${s.body.split("\n").map(escape).join("<br>")}</p>`
      : "";
    const groups = s.groups ? s.groups.map(groupHtml).join("") : "";
    return `<section class="sm-rule-section">
      <h3>${escape(s.heading)}</h3>
      ${body}
      <div class="sm-rule-groups">${groups}</div>
    </section>`;
  }).join("");

  return `
    <div class="sm-rules-doc">
      <h2>${escape(RULES_TITLE)}</h2>
      <p class="sm-rules-lead">${escape(RULES_LEAD)}</p>
      ${sections}
    </div>`;
}
