import type { ImageSourcePropType } from "react-native";
import { normalizeCharacterId } from "@/lib/normalizeCharacterId";

/** PC の public/characters と同じ id → バンドル済み portrait */
const CHARACTER_PORTRAITS: Record<string, ImageSourcePropType> = {
  "normal-nago": require("../assets/characters/normal-nago/portrait.png"),
  "shin-anago": require("../assets/characters/shin-anago/portrait.png"),
  "kuro-anyago": require("../assets/characters/kuro-anyago/portrait.png"),
  "dot-nago": require("../assets/characters/dot-nago/portrait.png"),
  "moja-anago": require("../assets/characters/moja-anago/portrait.png"),
  "oto-anago": require("../assets/characters/oto-anago/portrait.png"),
  "hat-anago": require("../assets/characters/hat-anago/portrait.png"),
  "nasubi-nago": require("../assets/characters/nasubi-nago/portrait.png"),
  "twin-nago": require("../assets/characters/twin-nago/portrait.png"),
  "nami-anago": require("../assets/characters/nami-anago/portrait.png"),
  "futaba-nago": require("../assets/characters/futaba-nago/portrait.png"),
  "pan-nago": require("../assets/characters/pan-nago/portrait.png"),
  "yozora-nago": require("../assets/characters/yozora-nago/portrait.png"),
  "koi-anago": require("../assets/characters/koi-anago/portrait.png"),
  "pain-nago": require("../assets/characters/pain-nago/portrait.png"),
  "wan-anago": require("../assets/characters/wan-anago/portrait.png"),
  "ryuu-anago": require("../assets/characters/ryuu-anago/portrait.png"),
};

const FALLBACK_PORTRAIT = require("../assets/characters/normal-nago/portrait.png");

/**
 * WebSocket の portraitSrc は Metro ではそのまま使えないため character主キーを優先する。
 */
export function resolveCharacterPortraitSource(characterId: string): ImageSourcePropType {
  return CHARACTER_PORTRAITS[normalizeCharacterId(characterId)] ?? FALLBACK_PORTRAIT;
}
