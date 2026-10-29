import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { getCatalogEntryByCharacterId } from "@/lib/characterCatalog";

const labels = ["", "ノーマル", "レア", "スーパーレア", "ウルトラレア", "ウルトラスーパーレア"];

export function CharacterStars({ characterId, size = 14 }: { characterId: string; size?: number }) {
  const stars = getCatalogEntryByCharacterId(characterId)?.stars;
  if (!stars) return null;
  return <View accessible accessibilityLabel={`${labels[stars]}、${stars} / 5つ星`} style={{ flexDirection: "row", gap: 2, paddingVertical: 2 }}>
    {[1, 2, 3, 4, 5].map(value => <Svg key={value} width={size} height={size} viewBox="0 0 20 20">
      <Path fill={value <= stars ? "#F78000" : "#EAEAEA"} d="M10 0L12.2451 6.90983H19.5106L13.6327 11.1803L15.8779 18.0902L10 13.8197L4.12215 18.0902L6.36729 11.1803L0.489435 6.90983H7.75486L10 0Z" />
    </Svg>)}
  </View>;
}
