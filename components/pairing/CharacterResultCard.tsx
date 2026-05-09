import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { PostureTimelineChartNative } from "@/components/pairing/PostureTimelineChartNative";
import {
  formatAcquiredAt,
  formatDuration,
  formatOptionalDuration,
  formatPercent,
} from "@/lib/formatMeasurement";
import { getCatalogEntryByCharacterId } from "@/lib/characterCatalog";
import type { AcquiredCharacterPayload } from "@/lib/pairing/types";
import { resolveCharacterPortraitSource } from "@/lib/resolveCharacterPortrait";

/**
 * 「カード詳細」内・代表色ブロックのキャラ画像。ここを編集して大きさ・位置を調整する。
 * `widthRatio` / `heightRatio` はブロックに対する割合。`offsetX` / `offsetY` は px（正で右・下）。
 */
export const DEFAULT_DETAIL_PORTRAIT_TUNING = {
  widthRatio: 0.55,
  heightRatio: 0.9,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
} as const;

/** Figma Frame 51 / Frame 27 基準寸法 */
const DETAIL_CARD_MAX_WIDTH = 310;
const DETAIL_CARD_MIN_HEIGHT = 570;
const DETAIL_PORTRAIT_FRAME = 262;

export type DetailPortraitTuning = {
  widthRatio: number;
  heightRatio: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type CharacterResultCardProps = {
  payload: AcquiredCharacterPayload;
  /**
   * Figma mobile「カード詳細」：Frame 51 白カード＋獲得 UI。共有は親ヘッダー（カード外）。
   */
  detailLayout?: boolean;
  /**
   * モーダル内など親に flex 高さが無いとき ScrollView が潰れないよう最大高さを指定する。
   */
  scrollMaxHeight?: number;
  /** 未指定時は DEFAULT_DETAIL_PORTRAIT_TUNING（詳細レイアウト時のみ反映） */
  detailPortraitTune?: Partial<DetailPortraitTuning>;
};

/**
 * PC の CharacterResultWhiteCard と同じ情報块（モバイル用レイアウト）。
 * detailLayout 時は Figma「カード詳細」フレームの余白・トーンに合わせる。
 */
export const CharacterResultCard = memo(function CharacterResultCard({
  payload,
  detailLayout = false,
  scrollMaxHeight,
  detailPortraitTune,
}: CharacterResultCardProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [detailCardInnerWidth, setDetailCardInnerWidth] = useState(0);

  /** 詳細：Frame 51 内の左右 padding 24 を除いた幅（キャラ枠 262 の上限に使う） */
  const detailInnerContentWidth = useMemo(() => {
    if (detailCardInnerWidth > 0) {
      return detailCardInnerWidth;
    }
    const maxFrame = Math.min(DETAIL_CARD_MAX_WIDTH, Math.min(windowWidth - 32, 408));
    return Math.max(100, maxFrame - 48);
  }, [detailCardInnerWidth, windowWidth]);

  const detailPortraitSquareSide = Math.min(DETAIL_PORTRAIT_FRAME, detailInnerContentWidth);

  const catalogColors = useMemo(
    () => getCatalogEntryByCharacterId(payload.characterId)?.characterColor,
    [payload.characterId],
  );
  const primary = payload.characterColor?.primary ?? catalogColors?.primary ?? "#f78000";
  const soft = payload.characterColor?.soft ?? catalogColors?.soft ?? "#ffe8cc";
  const portraitSource = useMemo(
    () => resolveCharacterPortraitSource(payload.characterId),
    [payload.characterId],
  );

  const detailTune = useMemo(
    () => ({
      ...DEFAULT_DETAIL_PORTRAIT_TUNING,
      ...detailPortraitTune,
    }),
    [detailPortraitTune],
  );

  const tags =
    payload.personalityTags && payload.personalityTags.length > 0
      ? payload.personalityTags.slice(0, 2)
      : (["？？？？？", "？？？？？"] as const);

  const timelineVariant = "success" as const;
  const timelineSegments = payload.postureTimeline ?? [];
  const timelineTotal = payload.activeMeasurementMs ?? 0;
  const hasTimelineData = timelineSegments.length > 0 && timelineTotal > 0;
  const strokeResolved = hasTimelineData ? primary : "#8a9399";

  const goodMs = payload.goodMs ?? 0;
  const goodRatio = payload.goodRatio ?? 0;

  async function handleShare() {
    const message = [
      payload.characterName,
      `良い姿勢時間: ${formatDuration(goodMs)}`,
      `良い姿勢率: ${formatPercent(goodRatio)}`,
      `獲得日: ${formatAcquiredAt(payload.acquiredAt)}`,
      `測定時間: ${formatOptionalDuration(payload.activeMeasurementMs)}`,
    ].join("\n");
    try {
      await Share.share({ message, title: "測定結果" });
    } catch {
      /* ユーザーがキャンセルした場合など */
    }
  }

  /** detailLayout でもキャラ色を使う（旧: オレンジ固定でピンクキャラが誤表示になっていた） */
  const portraitBg = `${soft}4D`;
  const tagPillBg = `${primary}24`;

  const scrollStyle = scrollMaxHeight != null ? { maxHeight: scrollMaxHeight } : styles.scroll;

  const pctInt = Math.round(Math.max(0, Math.min(1, goodRatio)) * 100);

  if (detailLayout) {
    return (
      <ScrollView
        style={scrollStyle}
        contentContainerStyle={[styles.scrollContentDetail, styles.detailScrollContent]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        <View
          style={styles.detailFrame51}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setDetailCardInnerWidth(Math.max(0, w - 48));
          }}>
          <View
            style={[
              styles.detailPortraitFrame,
              {
                width: detailPortraitSquareSide,
                height: detailPortraitSquareSide,
                backgroundColor: portraitBg,
              },
            ]}>
            <View style={styles.portraitAligner}>
              <Image
                source={portraitSource}
                style={{
                  width: `${detailTune.widthRatio * 100}%`,
                  height: `${detailTune.heightRatio * 100}%`,
                  transform: [
                    { scale: detailTune.scale },
                    { translateX: detailTune.offsetX },
                    { translateY: detailTune.offsetY },
                  ],
                }}
                contentFit="contain"
                contentPosition="center"
              />
            </View>
          </View>

          <Text style={styles.detailCharacterName}>{payload.characterName}</Text>

          <View style={styles.detailTagsRow}>
            {tags.map((tag, index) => (
              <View key={`${tag}-${index}`} style={[styles.detailTagPill, { backgroundColor: tagPillBg }]}>
                <Text
                  style={[styles.detailTagText, { color: primary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {tag}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.detailStatRow}>
            <View style={styles.detailStatColLeft}>
              <Text style={styles.detailStatLabel}>良い姿勢時間</Text>
              <Text style={[styles.detailStatValueNum, { color: primary }]}>{formatDuration(goodMs)}</Text>
            </View>
            <View style={styles.detailStatColRight}>
              <Text style={[styles.detailStatLabel, styles.detailStatLabelRight]}>良い姿勢率</Text>
              <View style={styles.detailPercentRow}>
                <Text style={[styles.detailStatValueNum, { color: primary }]}>{pctInt}</Text>
                <Text style={[styles.detailPercentSymbol, { color: primary }]}>%</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailMetaBlock}>
            <View style={styles.detailMetaRow}>
              <View style={styles.detailMetaLeft}>
                <Ionicons name="calendar-outline" size={16} color={primary} style={styles.detailMetaIcon} />
                <Text style={styles.detailMetaLabel}>獲得日</Text>
              </View>
              <Text style={styles.detailMetaValue}>{formatAcquiredAt(payload.acquiredAt)}</Text>
            </View>
            <View style={styles.detailMetaRow}>
              <View style={styles.detailMetaLeft}>
                <Ionicons name="time-outline" size={16} color={primary} style={styles.detailMetaIcon} />
                <Text style={styles.detailMetaLabel}>測定時間</Text>
              </View>
              <Text style={styles.detailMetaValue}>
                {formatOptionalDuration(payload.activeMeasurementMs)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  const chartWidth = Math.min(windowWidth - 48, 342);

  return (
    <ScrollView
      style={scrollStyle}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled>
      <View style={styles.card}>
        <View
          style={[
            styles.portraitWrapCommon,
            styles.portraitWrapGrid,
            { backgroundColor: portraitBg },
          ]}>
          <View style={styles.portraitAligner}>
            <Image source={portraitSource} style={styles.portrait} contentFit="contain" contentPosition="center" />
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.characterName}>{payload.characterName}</Text>
          <Pressable
            onPress={() => void handleShare()}
            accessibilityRole="button"
            accessibilityLabel="結果を共有"
            hitSlop={12}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}>
            <Ionicons name="share-outline" size={26} color={primary} />
          </Pressable>
        </View>

        <View style={styles.tagsRow}>
          {tags.map((tag, index) => (
            <View
              key={`${tag}-${index}`}
              style={[styles.tagPill, { backgroundColor: tagPillBg }]}>
              <Text
                style={[styles.tagText, { color: primary }]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {tag}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>良い姿勢時間</Text>
            <Text style={[styles.statValue, { color: primary }]}>{formatDuration(goodMs)}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>良い姿勢率</Text>
            <Text style={[styles.statValue, { color: primary }]}>{formatPercent(goodRatio)}</Text>
          </View>
        </View>

        <PostureTimelineChartNative
          segments={timelineSegments}
          totalMs={timelineTotal}
          variant={timelineVariant}
          resolvedGoodStroke={strokeResolved}
          width={chartWidth}
        />

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <Ionicons name="calendar-outline" size={20} color={primary} style={styles.metaIcon} />
              <Text style={styles.metaLabel}>獲得日</Text>
            </View>
            <Text style={styles.metaValue}>{formatAcquiredAt(payload.acquiredAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <Ionicons name="time-outline" size={20} color={primary} style={styles.metaIcon} />
              <Text style={styles.metaLabel}>測定時間</Text>
            </View>
            <Text style={styles.metaValue}>
              {formatOptionalDuration(payload.activeMeasurementMs)}
            </Text>
          </View>
        </View>

        {payload.story ? (
          <Text style={styles.storyNote} numberOfLines={4}>
            {payload.story}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  scrollContentDetail: {
    paddingBottom: 28,
  },
  /** モーダル body 上で Frame 51 を中央に置く */
  detailScrollContent: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  /** Figma Frame 51（獲得カード本体） */
  detailFrame51: {
    width: "100%",
    maxWidth: DETAIL_CARD_MAX_WIDTH,
    minWidth: 0,
    minHeight: DETAIL_CARD_MIN_HEIGHT,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 8.52,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  /** Figma Frame 27 */
  detailPortraitFrame: {
    borderRadius: 24,
    overflow: "hidden",
    alignSelf: "center",
  },
  detailCharacterName: {
    marginTop: 16,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    color: "#000000",
  },
  detailTagsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    marginTop: 16,
    width: "100%",
    minWidth: 0,
  },
  detailTagPill: {
    flex: 1,
    minWidth: 0,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTagText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
    width: "100%",
    textAlign: "center",
  },
  detailStatRow: {
    flexDirection: "row",
    marginTop: 24,
    alignItems: "flex-start",
  },
  detailStatColLeft: {
    flex: 1,
    minWidth: 0,
  },
  detailStatColRight: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  detailStatLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
    color: "#666666",
  },
  detailStatLabelRight: {
    width: "100%",
    textAlign: "left",
  },
  detailStatValueNum: {
    marginTop: 4,
    fontSize: 48,
    lineHeight: 57,
    fontWeight: "700",
  },
  detailPercentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  detailPercentSymbol: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    marginLeft: 2,
    paddingBottom: 4,
  },
  detailDivider: {
    marginTop: 28,
    height: 1,
    backgroundColor: "#DDDDDD",
  },
  detailMetaBlock: {
    marginTop: 16,
    gap: 16,
  },
  detailMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  detailMetaIcon: {
    marginRight: 8,
  },
  detailMetaLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
    color: "#666666",
  },
  detailMetaValue: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
    color: "#000000",
    textAlign: "right",
    flexShrink: 0,
    marginLeft: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    width: "100%",
    maxWidth: 400,
    minWidth: 0,
    alignSelf: "center",
  },
  portraitWrapCommon: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  /** 通常カード：グリッド用 stretch + aspect */
  portraitWrapGrid: {
    borderRadius: 28,
    aspectRatio: 1,
    maxHeight: 280,
    alignSelf: "stretch",
  },
  /** 代表色ブロック内でキャラを左右中央に置く（Y は従来どおり central のまま、offsetY で微調整可） */
  portraitAligner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  portrait: {
    width: "55%",
    height: "90%",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  characterName: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
    color: "#000000",
  },
  shareBtn: {
    padding: 4,
  },
  shareBtnPressed: {
    opacity: 0.65,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    marginTop: 12,
    width: "100%",
    minWidth: 0,
  },
  tagPill: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    fontSize: 13,
    fontWeight: "700",
    width: "100%",
    textAlign: "center",
  },
  statGrid: {
    flexDirection: "row",
    marginTop: 22,
    gap: 16,
  },
  statCell: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "700",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 38,
    fontWeight: "700",
    lineHeight: 46,
  },
  metaBlock: {
    marginTop: 24,
    gap: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  metaIcon: {
    marginRight: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 0,
    marginLeft: 12,
  },
  storyNote: {
    marginTop: 14,
    fontSize: 13,
    color: "#666666",
    lineHeight: 20,
  },
});
