// Selainpuolen DAWG-lataus: hakee pakatun binäärin + metan ja rakentaa
// ExactJudgen. Erillinen asset (ei JS-bundleen) → host gzippaa, lataus on laiska.
import type { BuiltDawg, DawgMeta } from "./builder";
import { ExactJudge } from "./judge";

// Vite tarjoilee public/-tiedostot juuresta; base huomioidaan import.meta.env:llä.
const BASE = import.meta.env.BASE_URL ?? "/";

export async function loadJudge(version = "sanasto-fi-v1"): Promise<ExactJudge> {
  const [metaRes, dawgRes] = await Promise.all([
    fetch(`${BASE}dict/${version}.meta.json`),
    fetch(`${BASE}dict/${version}.dawg`),
  ]);
  if (!metaRes.ok || !dawgRes.ok) {
    throw new Error(`Sanaston lataus epäonnistui: ${version}`);
  }
  const meta: DawgMeta = await metaRes.json();
  const buffer = await dawgRes.arrayBuffer();
  // Binääri kirjoitettu Uint32 little-endianina (kaikki selaimet LE).
  const built: BuiltDawg = { edges: new Uint32Array(buffer), meta };
  return new ExactJudge(built);
}
