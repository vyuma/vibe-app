import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useMemo, useState } from "react";
import {
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
   * Figma mobile「カード詳細」モーダル内用：シート直下に載せ、二重の白カード枠を付けない。
   */
  detailLayout?: boolean;
  /**
   * モーダル内など親に flex 高さが無いとき ScrollView が潰れないよう最大高さを指定する。
   */
  scrollMaxHeight?: number;
  /** 未指定時は DEFAULT_DETAIL_PORTRAIT_TUNING（詳細レイアウト時のみ反映） */
  detailPortraitTune?: Partial<DetailPortraitTuning>;
  /**
   * カード詳細モーダルから渡す：画像キャプチャ（ヘッダー除外）共有。未指定時はテキスト共有。
   * キャプチャは親の body 範囲。スクロール全量が長い場合、端末により画像がviewport相当に留まることがある（CharacterInfoModal 参照）。
   */
  onShareImage?: () => void | Promise<void>;
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
  onShareImage,
}: CharacterResultCardProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [detailCardInnerWidth, setDetailCardInnerWidth] = useState(0);

  /** 詳細カード：paddingHorizontal 20×2 を除いた内側幅（onLayout 前のフォールバック付き） */
  const detailInnerContentWidth = useMemo(() => {
    const fromLayout = detailCardInnerWidth;
    if (fromLayout > 0) {
      return fromLayout;
    }
    const sheetW = Math.min(windowWidth - 32, 400);
    return Math.max(120, sheetW - 40);
  }, [detailCardInnerWidth, windowWidth]);

  const detailPortraitMaxSide = 300;
  const detailPortraitSquareSide = Math.min(detailInnerContentWidth, detailPortraitMaxSide);

  const chartWidth = Math.min(windowWidth - (detailLayout ? 72 : 48), 342);

  const primary = payload.characterColor?.primary ?? "#f78000";
  const soft = payload.characterColor?.soft ?? "#ffe8cc";
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
    if (detailLayout && onShareImage) {
      try {
        await onShareImage();
      } catch {
        /* キャンセル・キャプチャ失敗など */
      }
      return;
    }
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

  const cardStyle = detailLayout ? styles.cardDetailSheet : styles.card;
  const portraitBg = detailLayout ? soft : `${soft}4D`;
  const tagPillBg = `${primary}24`;

  const scrollStyle = scrollMaxHeight != null ? { maxHeight: scrollMaxHeight } : styles.scroll;

  return (
    <ScrollView
      style={scrollStyle}
      contentContainerStyle={[styles.scrollContent, detailLayout && styles.scrollContentDetail]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled>
      <View
        style={cardStyle}
        onLayout={
          detailLayout
            ? (e) => {
                const outer = e.nativeEvent.layout.width;
                setDetailCardInnerWidth(Math.max(0, outer - 40));
              }
            : undefined
        }>
        <View
          style={[
            styles.portraitWrapCommon,
            !detailLayout && styles.portraitWrapGrid,
            detailLayout && styles.portraitWrapDetail,
            detailLayout && {
              width: detailPortraitSquareSide,
              height: detailPortraitSquareSide,
              alignSelf: "center",
            },
            { backgroundColor: portraitBg },
          ]}>
          <View style={styles.portraitAligner}>
            <Image
              source={portraitSource}
              style={
                detailLayout
                  ? {
                      width: `${detailTune.widthRatio * 100}%`,
                      height: `${detailTune.heightRatio * 100}%`,
                      transform: [
                        { scale: detailTune.scale },
                        { translateX: detailTune.offsetX },
                        { translateY: detailTune.offsetY },
                      ],
                    }
                  : styles.portrait
              }
              contentFit="contain"
              contentPosition="center"
            />
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
              <Text style={[styles.tagText, { color: primary }]}>{tag}</Text>
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  /** Figma「カード詳細」：モーダルシートと一体になるフラットなブロック */
  cardDetailSheet: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    alignSelf: "stretch",
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
  /** 詳細：角丸のみ（一辺は onLayout で中央配置） */
  portraitWrapDetail: {
    borderRadius: 32,
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
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tagPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "700",
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
