const CHARACTER_ID_ALIASES: Record<string, string> = {
  "kuro-anago": "kuro-anyago",
};

export function normalizeCharacterId(characterId: string): string {
  const normalized = characterId.trim().toLowerCase();
  return CHARACTER_ID_ALIASES[normalized] ?? normalized;
}
