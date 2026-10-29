import additions from "./characterAdditions.json";
import { normalizeCharacterId } from "@/lib/normalizeCharacterId";

/** PC の `CharacterDefinition` に対応（モバイル表示用の最小フィールド） */
export type CharacterCatalogEntry = {
  id: string;
  number: number;
  stars: number;
  name: string;
  rarity: "common" | "rare" | "epic" | "ultra-rare";
  story: string;
  portraitSrc: string;
  personalityTags: string[];
  characterColor: { primary: string; soft: string };
};

/**
 * PC [`posture-app/src/features/characters/characterCatalog.ts` の `CHARACTER_CATALOG`]
 * の ID と番号に対応。既存 7 種は旧モバイル文言を維持する。
 */
export const CHARACTER_CATALOG: CharacterCatalogEntry[] = [
  {
    id: "normal-nago",
    number: 1,
    stars: 1,
    name: "シマアナゴ",
    rarity: "common",
    story: "いつもそばで姿勢を見守ってくれる、基本のピンアナゴ。",
    portraitSrc: "/characters/anago/normal-nago/portrait.png",
    characterColor: { primary: "#f28a18", soft: "#f8d7b2" },
    personalityTags: ["ムードメーカー", "フレンドリー"],
  },
  {
    id: "shin-anago",
    number: 2,
    stars: 1,
    name: "シン・アナゴ",
    rarity: "common",
    story: "姿勢のいい時間にひょっこり現れる、まっすぐなピンアナゴ。",
    portraitSrc: "/characters/anago/shin-anago/portrait.png",
    characterColor: { primary: "#f05a63", soft: "#f6d2d4" },
    personalityTags: ["頑張り屋さん", "まっすぐ"],
  },
  {
    id: "kuro-anyago",
    number: 3,
    stars: 1,
    name: "クロアニャゴ",
    rarity: "common",
    story: "集中している人のそばが好きな、落ち着いた黒いピンアナゴ。",
    portraitSrc: "/characters/anago/kuro-anyago/portrait.png",
    characterColor: { primary: "#555c66", soft: "#cfd1d4" },
    personalityTags: ["クール", "ツンデレ"],
  },
  {
    id: "hat-anago",
    number: 7,
    stars: 1,
    name: "ハットアナゴ",
    rarity: "rare",
    story: "休憩と集中の切り替えが上手な、おしゃれ好きのピンアナゴ。",
    portraitSrc: "/characters/anago/hat-anago/portrait.png",
    characterColor: { primary: "#1677c8", soft: "#c8dbee" },
    personalityTags: ["しっかり者", "おしゃれ"],
  },
  {
    id: "oto-anago",
    number: 6,
    stars: 1,
    name: "オトアナゴ",
    rarity: "common",
    story: "良い姿勢のリズムに合わせてゆらゆらする白いピンアナゴ。",
    portraitSrc: "/characters/anago/oto-anago/portrait.png",
    characterColor: { primary: "#777777", soft: "#f1f1ef" },
    personalityTags: ["音楽好き", "リズム感"],
  },
  {
    id: "dot-nago",
    number: 4,
    stars: 1,
    name: "ドットナゴ",
    rarity: "rare",
    story: "ドット模様と一緒に、集中のリズムを刻むピンアナゴ。",
    portraitSrc: "/characters/anago/dot-nago/portrait.png",
    characterColor: { primary: "#d4aa20", soft: "#f1e9bf" },
    personalityTags: ["ドット", "集中型"],
  },
  {
    id: "moja-anago",
    number: 5,
    stars: 1,
    name: "モジャアナゴ",
    rarity: "epic",
    story: "良い姿勢を続ける人にだけ姿を見せる、もじゃもじゃ不思議なピンアナゴ。",
    portraitSrc: "/characters/anago/moja-anago/portrait.png",
    characterColor: { primary: "#36a25d", soft: "#c9ead2" },
    personalityTags: ["もじゃもじゃ", "こだわり強い"],
  },
  ...additions.map(({ presentation: _presentation, ...entry }) => ({
    ...entry, rarity: entry.rarity as CharacterCatalogEntry["rarity"],
  })),
];

/** スロット index（0 始まり）に対応するカタログ行。未定義の番号は null。 */
export function getCatalogEntryAtSlotIndex(slotIndex: number): CharacterCatalogEntry | null {
  const entry = CHARACTER_CATALOG.find(item => item.number === slotIndex + 1);
  return entry ?? null;
}

/** `characterId`（エイリアス含む）に一致するカタログ行。WS ペイロードに色が無いときのフォールバック用。 */
export function getCatalogEntryByCharacterId(characterId: string): CharacterCatalogEntry | null {
  const needle = normalizeCharacterId(characterId);
  return CHARACTER_CATALOG.find((e) => e.id === needle) ?? null;
}
