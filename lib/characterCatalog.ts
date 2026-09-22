import { normalizeCharacterId } from "@/lib/normalizeCharacterId";

/** PC の `CharacterDefinition` に対応（モバイル表示用の最小フィールド） */
export type CharacterCatalogEntry = {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic";
  story: string;
  portraitSrc: string;
  personalityTags: string[];
  characterColor: { primary: string; soft: string };
};

/** Web・デスクトップと同じID、表示内容、並び順。 */
export const CHARACTER_CATALOG: CharacterCatalogEntry[] = [
  {
    id: "normal-nago",
    name: "シマアナゴ",
    rarity: "common",
    story: "いつもそばで姿勢を見守ってくれる、基本のピンアナゴ。",
    portraitSrc: "/characters/anago/normal-nago/portrait.png",
    characterColor: {
      primary: "#e87820",
      soft: "#ffe8d4",
    },
    personalityTags: ["ムードメーカー", "フレンドリー"],
  },
  {
    id: "shin-anago",
    name: "シン・アナゴ",
    rarity: "common",
    story: "姿勢のいい時間にひょっこり現れる、まっすぐなピンアナゴ。",
    portraitSrc: "/characters/anago/shin-anago/portrait.png",
    characterColor: {
      primary: "#e84858",
      soft: "#fde2e5",
    },
    personalityTags: ["頑張り屋さん", "負けず嫌い"],
  },
  {
    id: "kuro-anyago",
    name: "クロアニャゴ",
    rarity: "common",
    story: "集中している人のそばが好きな、落ち着いた黒いピンアナゴ。",
    portraitSrc: "/characters/anago/kuro-anyago/portrait.png",
    characterColor: {
      primary: "#5a6270",
      soft: "#e6e8eb",
    },
    personalityTags: ["クール", "ツンデレ"],
  },
  {
    id: "dot-nago",
    name: "クマアナゴ",
    rarity: "rare",
    story: "ドット模様と一緒に、集中のリズムを刻むピンアナゴ。",
    portraitSrc: "/characters/anago/dot-nago/portrait.png",
    characterColor: {
      primary: "#c99812",
      soft: "#fff6d9",
    },
    personalityTags: ["おっとり", "天然"],
  },
  {
    id: "moja-anago",
    name: "モジャアナゴ",
    rarity: "epic",
    story: "良い姿勢を続ける人にだけ姿を見せる、もじゃもじゃ不思議なピンアナゴ。",
    portraitSrc: "/characters/anago/moja-anago/portrait.png",
    characterColor: {
      primary: "#2d8f52",
      soft: "#d9f3e3",
    },
    personalityTags: ["くせもの", "こだわり強い"],
  },
  {
    id: "oto-anago",
    name: "オトアナゴ",
    rarity: "common",
    story: "良い姿勢のリズムに合わせてゆらゆらする白いピンアナゴ。",
    portraitSrc: "/characters/anago/oto-anago/portrait.png",
    characterColor: {
      primary: "#6d6d6d",
      soft: "#ebebeb",
    },
    personalityTags: ["音楽好き", "クリエイティブ"],
  },
  {
    id: "hat-anago",
    name: "ハットナゴ",
    rarity: "rare",
    story: "休憩と集中の切り替えが上手な、おしゃれ好きのピンアナゴ。",
    portraitSrc: "/characters/anago/hat-anago/portrait.png",
    characterColor: {
      primary: "#1b6fb3",
      soft: "#d3e8fa",
    },
    personalityTags: ["しっかり者", "リーダー気質"],
  },
  {
    id: "nasubi-nago",
    name: "ナスビナゴ",
    rarity: "common",
    story: "なすびの冠を戴き、落ち着いた集中のそばにひょっこり顔を出すピンアナゴ。",
    portraitSrc: "/characters/anago/nasubi-nago/portrait.png",
    characterColor: {
      primary: "#6b4eab",
      soft: "#ece6f7",
    },
    personalityTags: ["落ち着きがある", "お兄ちゃんキャラ"],
  },
  {
    id: "twin-nago",
    name: "ツインナゴ",
    rarity: "rare",
    story: "ハート模様とツインテールで、華やかな姿勢タイムを盛り上げるピンアナゴ。",
    portraitSrc: "/characters/anago/twin-nago/portrait.png",
    characterColor: {
      primary: "#e85b8c",
      soft: "#fce3ed",
    },
    personalityTags: ["アイドル気質", "妹キャラ"],
  },
  {
    id: "nami-anago",
    name: "ナミアナゴ",
    rarity: "common",
    story: "波線がゆらゆら流れ、リズムのいい姿勢を一緒に刻むピンアナゴ。",
    portraitSrc: "/characters/anago/nami-anago/portrait.png",
    characterColor: {
      primary: "#38b4df",
      soft: "#dff3fb",
    },
    personalityTags: ["ノリがいい", "気分屋"],
  },
  {
    id: "futaba-nago",
    name: "フタバナゴ",
    rarity: "common",
    story: "双葉を乗せてすくすく伸びる、まっすぐな背筋が似合うピンアナゴ。",
    portraitSrc: "/characters/anago/futaba-nago/portrait.png",
    characterColor: {
      primary: "#64b746",
      soft: "#e5f4dc",
    },
    personalityTags: ["面倒見が良い", "真面目"],
  },
  {
    id: "pan-nago",
    name: "パンアナゴ",
    rarity: "common",
    story: "パンみたいな温かい質感で、長い集中もそっと支えるピンアナゴ。",
    portraitSrc: "/characters/anago/pan-nago/portrait.png",
    characterColor: {
      primary: "#9d734f",
      soft: "#efe5d8",
    },
    personalityTags: ["旅行好き", "英語が得意"],
  },
  {
    id: "yozora-nago",
    name: "ヨゾラナゴ",
    rarity: "epic",
    story: "星屑をまとった夜の色で、静かな集中のそばにいるピンアナゴ。",
    portraitSrc: "/characters/anago/yozora-nago/portrait.png",
    characterColor: {
      primary: "#1c2f55",
      soft: "#b9c8de",
    },
    personalityTags: ["夜行性", "物静か"],
  },
  {
    id: "koi-anago",
    name: "コイアナゴ",
    rarity: "rare",
    story: "うろこ模様をきらめかせながら、自分のペースで良い姿勢を目指すピンアナゴ。",
    portraitSrc: "/characters/anago/koi-anago/portrait.png",
    characterColor: {
      primary: "#c62828",
      soft: "#ffebef",
    },
    personalityTags: ["マイペース", "野心家"],
  },
  {
    id: "pain-nago",
    name: "パインナゴ",
    rarity: "rare",
    story: "パイナップル柄のリズムで、楽しい姿勢の時間を運んでくるピンアナゴ。",
    portraitSrc: "/characters/anago/pain-nago/portrait.png",
    characterColor: {
      primary: "#c9a012",
      soft: "#fff8dc",
    },
    personalityTags: ["陽気", "サバサバ系"],
  },
  {
    id: "wan-anago",
    name: "ワンアナゴ",
    rarity: "common",
    story: "耳をぴんと立てて、あなたのそばで甘えん坊なピンアナゴ。",
    portraitSrc: "/characters/anago/wan-anago/portrait.png",
    characterColor: {
      primary: "#e07018",
      soft: "#ffe8cc",
    },
    personalityTags: ["甘えん坊", "アウトドア"],
  },
  {
    id: "ryuu-anago",
    name: "リュウアナゴ",
    rarity: "rare",
    story: "水滴の模様が揺れるたび、集中の深さを静かに見守るピンアナゴ。",
    portraitSrc: "/characters/anago/ryuu-anago/portrait.png",
    characterColor: {
      primary: "#2978c4",
      soft: "#d9eefc",
    },
    personalityTags: ["ミステリアス", "プライドが高い"],
  },
];

/** スロット index（0 始まり）に対応するカタログ行。未実装のスロットは null。 */
export function getCatalogEntryAtSlotIndex(slotIndex: number): CharacterCatalogEntry | null {
  const entry = CHARACTER_CATALOG[slotIndex];
  return entry ?? null;
}

/** `characterId`（エイリアス含む）に一致するカタログ行。WS ペイロードに色が無いときのフォールバック用。 */
export function getCatalogEntryByCharacterId(characterId: string): CharacterCatalogEntry | null {
  const needle = normalizeCharacterId(characterId);
  return CHARACTER_CATALOG.find((e) => e.id === needle) ?? null;
}
