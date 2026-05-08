import type { ImageSourcePropType } from "react-native";
import { normalizeCharacterId } from "@/lib/normalizeCharacterId";

/** PC の public/characters と同じ id → バンドル済み portrait */
const CHARACTER_PORTRAITS: Record<string, ImageSourcePropType> = {
  "normal-nago": require("../assets/characters/normal-nago/portrait.png"),
  "dot-nago": require("../assets/characters/dot-nago/portrait.png"),
  "shin-anago": require("../assets/characters/shin-anago/portrait.png"),
  "moja-anago": require("../assets/characters/moja-anago/portrait.png"),
  "kuro-anyago": require("../assets/characters/kuro-anyago/portrait.png"),
  "oto-anago": require("../assets/characters/oto-anago/portrait.png"),
  "hat-anago": require("../assets/characters/hat-anago/portrait.png"),
};

const FALLBACK_PORTRAIT = require("../assets/characters/normal-nago/portrait.png");

/**
 * WebSocket の portraitSrc は Metro ではそのまま使えないため character主キーを優先する。
 */
export function resolveCharacterPortraitSource(characterId: string): ImageSourcePropType {
  return CHARACTER_PORTRAITS[normalizeCharacterId(characterId)] ?? FALLBACK_PORTRAIT;
}
