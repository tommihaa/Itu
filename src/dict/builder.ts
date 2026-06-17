// Minimoivan DAWG:n (Daciuk, "Incremental Construction of Minimal Acyclic
// Finite-State Automata") rakentaja. Syötteen ON oltava aakkostettu ja uniikki.
// Tämä moduuli on puhdas (ei fs:ää), jotta sekä build-skripti että testit
// voivat rakentaa ja kysellä DAWG:n muistissa. Levyformaatti: ks. encode().

// Pelin kirjaimisto (ks. SANAMIX.md, noppadata): ei b/c/f/g/q/w/x/z/å/š/ž.
// 20 merkkiä → mahtuu 5 bittiin. Järjestys = tavujärjestys (sort vertailee näin).
export const ALPHABET = "abcdefghijklmnoprstuvyäö";

// Reaaliset kirjaimet (mitä noppikirjaimisto sallii). ALPHABET sisältää
// b/c/f/g varmuuden vuoksi indeksoinnissa, mutta gen-skripti suodattaa ne pois.
const CHAR_INDEX: ReadonlyMap<string, number> = new Map(
  [...ALPHABET].map((c, i) => [c, i]),
);

export const DAWG_VERSION = "sanasto-fi-v1";

export interface DawgMeta {
  version: string;
  alphabet: string;
  /** edges-taulukon indeksi, josta juurisolmun kaaret alkavat. */
  rootFirst: number;
  wordCount: number;
  nodeCount: number;
  edgeCount: number;
}

export interface BuiltDawg {
  edges: Uint32Array;
  meta: DawgMeta;
}

// --- Kaaren bittipakkaus (32-bit, talletetaan Uint32Array:hin) ---------------
//   bitit 0..4  : kirjainindeksi (0..23)
//   bitti 5     : isLast — solmun kaariryhmän viimeinen kaari
//   bitti 6     : wordEnd — tämän kaaren seuraaminen päättää kelvollisen sanan
//   bitit 7..31 : target — lapsisolmun ensimmäisen kaaren indeksi (0 = lehti)
// JS:n bittioperaatiot ovat 32-bit etumerkillisiä, joten target koodataan
// kertolaskulla (target*128) eikä siirrolla ylivuodon välttämiseksi.
const LAST = 32;
const WORD_END = 64;
const TARGET_SHIFT = 128;

function packEdge(charIdx: number, isLast: boolean, wordEnd: boolean, target: number): number {
  // Bitit eivät mene päällekkäin → yhteenlasku on tarkka eikä typisty 32-bit
  // etumerkilliseksi kuten |-operaatio tekisi (target voi ylittää 2^24).
  return charIdx + (isLast ? LAST : 0) + (wordEnd ? WORD_END : 0) + target * TARGET_SHIFT;
}

class Node {
  final = false;
  // Lapset lisätään aakkosjärjestyksessä (syöte lajiteltu), Map säilyttää
  // lisäysjärjestyksen → iterointi antaa kaaret kasvavassa kirjainjärjestyksessä.
  readonly edges = new Map<string, Node>();
}

/** Solmun ekvivalenssiavain: final-tila + (kirjain → lapsen kanoninen id). */
function signature(node: Node, idOf: Map<Node, number>): string {
  let sig = node.final ? "1" : "0";
  for (const [ch, child] of node.edges) {
    sig += `|${ch}:${idOf.get(child)}`;
  }
  return sig;
}

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * Rakentaa minimoidun DAWG:n aakkostetusta, uniikista sanalistasta ja
 * serialisoi sen. Heittää, jos sanassa on kirjaimistoon kuulumaton merkki
 * tai jos syöte ei ole lajiteltu/uniikki.
 */
export function buildDawg(words: readonly string[]): BuiltDawg {
  const root = new Node();
  const register = new Map<string, Node>();
  const idOf = new Map<Node, number>();
  let nextId = 0;

  // Rekisteröi minimoitavan haaran (prevWordin osa cp:n jälkeen) alhaalta ylös.
  function replaceOrRegister(state: Node): void {
    // "Viimeisin lapsi" = suurin kirjain = lajitellussa syötteessä aktiivinen haara.
    let lastChar = "";
    for (const ch of state.edges.keys()) lastChar = ch;
    const child = state.edges.get(lastChar)!;
    if (child.edges.size > 0) replaceOrRegister(child);

    const sig = signature(child, idOf);
    const existing = register.get(sig);
    if (existing) {
      state.edges.set(lastChar, existing);
    } else {
      idOf.set(child, nextId++);
      register.set(sig, child);
    }
  }

  let prev = "";
  for (const word of words) {
    if (word <= prev && prev !== "") {
      throw new Error(`Syöte ei ole lajiteltu/uniikki: "${prev}" >= "${word}"`);
    }
    for (const ch of word) {
      if (!CHAR_INDEX.has(ch)) throw new Error(`Kirjaimistoon kuulumaton merkki: "${ch}" sanassa "${word}"`);
    }
    const cp = commonPrefixLen(word, prev);

    // Minimoi prevWordin haara cp:n jälkeen ennen uuden lisäämistä.
    let node = root;
    for (let i = 0; i < cp; i++) node = node.edges.get(word[i])!;
    if (node.edges.size > 0) replaceOrRegister(node);

    // Lisää uusi loppuosa.
    for (let i = cp; i < word.length; i++) {
      const next = new Node();
      node.edges.set(word[i], next);
      node = next;
    }
    node.final = true;
    prev = word;
  }
  if (root.edges.size > 0) replaceOrRegister(root);

  return encode(root, words.length);
}

/** Serialisoi DAWG:n litteäksi kaaritaulukoksi (ks. packEdge). */
function encode(root: Node, wordCount: number): BuiltDawg {
  // Kerää kaikki saavutettavat (kanoniset) solmut DFS:llä järjestykseen.
  const order: Node[] = [];
  const seen = new Set<Node>();
  (function dfs(n: Node) {
    if (seen.has(n)) return;
    seen.add(n);
    order.push(n);
    for (const child of n.edges.values()) dfs(child);
  })(root);

  // firstEdgeIndex per solmu: kaarien kumulatiivinen summa solmujen järjestyksessä.
  // Lehdet (0 kaarta) eivät kasvata summaa; niiden target koodataan 0:ksi.
  const firstEdge = new Map<Node, number>();
  let cursor = 0;
  for (const n of order) {
    firstEdge.set(n, cursor);
    cursor += n.edges.size;
  }
  const edgeCount = cursor;
  const edges = new Uint32Array(edgeCount);

  let w = 0;
  for (const n of order) {
    const entries = [...n.edges.entries()];
    for (let i = 0; i < entries.length; i++) {
      const [ch, child] = entries[i];
      const isLast = i === entries.length - 1;
      const target = child.edges.size > 0 ? firstEdge.get(child)! : 0; // 0 = lehti
      edges[w++] = packEdge(CHAR_INDEX.get(ch)!, isLast, child.final, target);
    }
  }

  return {
    edges,
    meta: {
      version: DAWG_VERSION,
      alphabet: ALPHABET,
      rootFirst: firstEdge.get(root)!,
      wordCount,
      nodeCount: order.length,
      edgeCount,
    },
  };
}
