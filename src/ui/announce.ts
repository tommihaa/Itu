// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
//
// Ruudunlukijan ilmoitukset (Tommin päätös 14.10.2026, DGAndroid/docs/YHTEYDENOTTO_NKL.md ›
// Grillaus). Näkövammaisten liiton Ville Lammisen vastauksen kohta 4: ruudunlukijan on
// kerrottava itse kun pelissä tapahtuu jotain, eikä ilmoituksen tarvitse näkyä näkevälle.
//
// Live-alue on `document.body`n lapsi eikä pelinäkymän, koska `render()` korvaa näkymän
// innerHTML:n joka kerta, ja uudelleen luotu alue jäisi ruudunlukijalta kuulematta.
//
// Viestit kuuluvat yksi kerrallaan, sama malli kuin Jaon `Announcer.jsx`:ssä. Yhdistetty
// ilmoitus kuului TalkBackilla yhtenä virtana (Tommin kuuntelu Pixelillä 14.10.2026).
// Seuraava viesti odottaa arvioidun puheajan ja tauon, koska live-alue ei kerro milloin
// ruudunlukija on lopettanut.

const MS_PER_CHAR = 75;
const MIN_SPEECH_MS = 1000;
const GAP_MS = 700;

let region: HTMLElement | null = null;
let queue: string[] = [];
let busy = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Luo live-alueen kerran. Kutsutaan pelin käynnistyksessä. */
export function mountAnnouncer(): void {
  if (region) return;
  region = document.createElement("div");
  region.className = "sm-sr-only";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  document.body.appendChild(region);
}

function pump(): void {
  if (busy || queue.length === 0 || !region) return;
  busy = true;
  timer = setTimeout(() => {
    const next = queue.shift()!;
    // Tyhjennys ensin, jotta sama teksti peräkkäin kuuluu uudelleen.
    region!.textContent = "";
    // Ajastin eikä requestAnimationFrame: rAF pysähtyy taustalla olevassa välilehdessä.
    setTimeout(() => {
      if (region) region.textContent = next;
    }, 50);
    timer = setTimeout(
      () => {
        busy = false;
        timer = undefined;
        pump();
      },
      Math.max(MIN_SPEECH_MS, next.length * MS_PER_CHAR) + GAP_MS,
    );
  }, 0);
}

/** Jonoon. Viesti päättyy välimerkkiin, jotta puhe laskee sävelkorkeuden. */
export function announce(text: string): void {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return;
  queue.push(/[.!?…]$/.test(t) ? t : t + ".");
  pump();
}

/** Uusi heitto tai kursorin siirto: vanhentuneet viestit pois jonosta. */
export function clearAnnouncements(): void {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = undefined;
  busy = false;
}

/** Kursorin sijainti vanhenee heti kun se liikkuu, joten se korvaa jonon eikä odota sitä. */
export function announceNow(text: string): void {
  clearAnnouncements();
  announce(text);
}
