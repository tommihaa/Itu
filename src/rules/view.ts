// Renderöi selkosäännöt HTML:ksi src/rules/content.ts:stä. Samaa tulostetta
// käyttää sekä pelin sisäinen näkymä että tuloste (@media print, ks. styles.css).
import {
  RULES,
  RULES_LEAD,
  RULES_TITLE,
  CONTROLS,
  CONTROLS_TITLE,
  ABOUT_TITLE,
  ABOUT_PARAS,
  OTHER_GAMES_TITLE,
  OTHER_GAMES_INTRO,
  OTHER_GAMES,
  INSTALL_TITLE,
  INSTALL_INTRO,
  INSTALL_GROUPS,
  type LetterRow,
  type RuleGroup,
  type RuleSection,
} from "./content";
import {
  TERMS,
  TERM_CATEGORIES,
  findTerm,
  splitWithGlossary,
  type TermEntry,
} from "./terms";

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

/** Escapaa teksti ja kääri termiesiintymät napautettaviksi (termimoduuli). */
function termify(text: string): string {
  return splitWithGlossary(text)
    .map((p) =>
      p.isTerm
        ? `<button type="button" class="sm-term" data-term="${escape(p.term!)}">${escape(p.text)}</button>`
        : escape(p.text),
    )
    .join("");
}

function lettersHtml(rows: LetterRow[]): string {
  const rowHtml = (r: LetterRow) => {
    const cls = r.accept ? "ok" : "bad";
    const sign = r.accept ? "✓" : "✗";
    const chips = r.chars
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => `<span class="sm-letter">${escape(c)}</span>`)
      .join("");
    return `<div class="sm-letter-row ${cls}">
      <span class="sm-letter-label"><span class="sign">${sign}</span> ${escape(r.label)}</span>
      <span class="sm-letter-chips">${chips}</span>
    </div>`;
  };
  return `<div class="sm-rule-letters">${rows.map(rowHtml).join("")}</div>`;
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

function sectionHtml(s: RuleSection): string {
  const body = s.body ? `<p>${s.body.split("\n").map(termify).join("<br>")}</p>` : "";
  const letters = s.letters ? lettersHtml(s.letters) : "";
  const groups = s.groups ? s.groups.map(groupHtml).join("") : "";
  return `<section class="sm-rule-section">
      <h3>${escape(s.heading)}</h3>
      ${body}
      ${letters}
      <div class="sm-rule-groups">${groups}</div>
    </section>`;
}

/** "Sanat"-välilehti: mitkä sanat kelpaavat (ilman painikkeita) — näkymässä ja tulosteessa. */
export function renderWordsContent(): string {
  return `
    <div class="sm-rules-doc">
      <h2>${escape(RULES_TITLE)}</h2>
      <p class="sm-rules-lead">${termify(RULES_LEAD)}</p>
      ${RULES.map(sectionHtml).join("")}
    </div>`;
}

/** "Ohjaus"-välilehti: pelin ohjaus laitteittain — näkymässä ja tulosteessa. */
export function renderControlsContent(): string {
  return `
    <div class="sm-rules-doc">
      <h2>${escape(CONTROLS_TITLE)}</h2>
      ${CONTROLS.map(sectionHtml).join("")}
    </div>`;
}

/** "Termit"-välilehti: pelin termit ryhmittäin — staattinen referenssi (tulostuu kokonaan). */
export function renderTermsContent(): string {
  const item = (t: TermEntry) => `
    <div class="sm-term-item">
      <span class="sm-term-name">${escape(t.term)}</span>
      <span class="sm-term-text">${escape(t.selitys)}${
        t.esimerkki ? ` <span class="sm-term-ex">Esim. ${escape(t.esimerkki)}</span>` : ""
      }</span>
    </div>`;
  const sections = TERM_CATEGORIES.map((c) => {
    const rows = TERMS.filter((t) => t.kategoria === c.key).map(item).join("");
    return rows
      ? `<section class="sm-rule-section"><h3>${escape(c.label)}</h3>${rows}</section>`
      : "";
  }).join("");
  return `
    <div class="sm-rules-doc">
      <h2>Termit</h2>
      <p class="sm-rules-lead">Pelin termit lyhyesti selitettyinä. Samat termit ovat
      napautettavissa myös sääntöteksteissä (katkoviivalla alleviivatut).</p>
      ${sections}
    </div>`;
}

// Versioleima: Vite `define` syöttää nämä build-aikana (ks. vite.config.ts).
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

// Palaute- ja tukilinkit (sama tekijä kuin sisarpeleissä, linkit uudelleenkäytettäviä).
const MAILTO = "mailto:no.jopas@gmail.com?subject=Itu-palaute";
const KOFI = "https://ko-fi.com/tommih";

/** "Esittely / Tietoja"-välilehti: mikä Itu on, palautelinkit ja PWA-asennusohje. */
export function renderAboutContent(): string {
  const paras = ABOUT_PARAS.map((p) => `<p>${escape(p)}</p>`).join("");
  const links = `
    <div class="sm-about-links sm-no-print">
      <a class="sm-about-link" href="${MAILTO}">✉ Lähetä palautetta</a>
      <a class="sm-about-link sm-about-kofi" href="${KOFI}" target="_blank" rel="noopener">☕ Tue Ko-fissa</a>
    </div>`;
  const installGroups = INSTALL_GROUPS.map((g) => {
    const rows = g.rows
      .map(
        ([browser, steps]) =>
          `<div class="sm-install-row"><b>${escape(browser)}</b><span>${escape(steps)}</span></div>`,
      )
      .join("");
    return `<div class="sm-install-group"><h4>${escape(g.title)}</h4>${rows}</div>`;
  }).join("");
  const install = `
    <section class="sm-rule-section">
      <h3>${escape(INSTALL_TITLE)}</h3>
      <p>${escape(INSTALL_INTRO)}</p>
      <div class="sm-install">${installGroups}</div>
    </section>`;
  const otherGames = `
    <section class="sm-rule-section">
      <h3>${escape(OTHER_GAMES_TITLE)}</h3>
      <p>${escape(OTHER_GAMES_INTRO)}</p>
      <div class="sm-other-games">
        ${OTHER_GAMES.map(
          (g) =>
            `<a class="sm-other-game" href="${g.url}" target="_blank" rel="noopener">
              <b>${escape(g.name)}</b><span>${escape(g.blurb)}</span>
            </a>`,
        ).join("")}
      </div>
    </section>`;
  const version = `<p class="sm-about-version">Itu v${escape(__APP_VERSION__)} · ${escape(__BUILD_DATE__)}</p>`;
  return `
    <div class="sm-rules-doc">
      <h2>${escape(ABOUT_TITLE)}</h2>
      ${paras}
      ${links}
      ${otherGames}
      ${install}
      ${version}
    </div>`;
}

/** Kytkee sääntötekstien napautettavat termit: klikkaus avaa selitteen kappaleen
 * alle (toggle; toinen termi korvaa avoimen). Puhdasta DOM-työtä, ei tilaa. */
export function wireTermClicks(container: HTMLElement): void {
  for (const btn of container.querySelectorAll<HTMLButtonElement>(".sm-term")) {
    btn.addEventListener("click", () => {
      const term = btn.dataset.term ?? "";
      const entry = findTerm(term);
      if (!entry) return; // tuntematon → ei näytetä mitään
      const block = btn.closest("p, h3, h4") ?? btn.parentElement;
      if (!block) return;
      const wasOpen =
        block.nextElementSibling?.classList.contains("sm-term-def") &&
        (block.nextElementSibling as HTMLElement).dataset.term === term;
      for (const d of container.querySelectorAll(".sm-term-def")) d.remove();
      for (const t of container.querySelectorAll(".sm-term-open")) t.classList.remove("sm-term-open");
      if (wasOpen) return;
      const div = document.createElement("div");
      div.className = "sm-term-def";
      div.dataset.term = term;
      div.innerHTML = `<b>${escape(entry.term)}</b> · ${escape(entry.selitys)}${
        entry.esimerkki ? ` <span class="sm-term-ex">Esim. ${escape(entry.esimerkki)}</span>` : ""
      }`;
      block.after(div);
      btn.classList.add("sm-term-open");
    });
  }
}
