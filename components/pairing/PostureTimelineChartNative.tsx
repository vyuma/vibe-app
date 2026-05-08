import type { ReactNode } from "react";
import { Line, Rect, Svg, Text as SvgText } from "react-native-svg";
import { StyleSheet, Text, View } from "react-native";

import type { PostureTimelineSegmentPayload } from "@/lib/pairing/types";

export type PostureTimelineChartNativeProps = {
  segments: PostureTimelineSegmentPayload[];
  totalMs: number;
  variant?: "success" | "fail";
  resolvedGoodStroke?: string;
  resolvedBadStroke?: string;
  width?: number;
};

const VIEWBOX_W = 360;
const VIEWBOX_H = 92;
const TRACK_X = 12;
const TRACK_Y = 18;
const TRACK_W = VIEWBOX_W - TRACK_X * 2;
const TRACK_H = 52;

function msToX(ms: number, totalMs: number): number {
  const denom = Math.max(totalMs, 1);
  return TRACK_X + Math.max(0, Math.min(TRACK_W, (ms / denom) * TRACK_W));
}

/** PC 版 PostureTimelineChart と同じ幾何（react-native-svg） */
export function PostureTimelineChartNative({
  segments,
  totalMs,
  variant = "success",
  resolvedGoodStroke,
  resolvedBadStroke,
  width = VIEWBOX_W,
}: PostureTimelineChartNativeProps) {
  const safeTotal = Number.isFinite(totalMs) ? Math.max(0, totalMs) : 0;
  const hasData = segments.length > 0 && safeTotal > 0;
  const yOne = TRACK_Y + 12;
  const yZero = TRACK_Y + TRACK_H - 12;
  const strokeW = 3.2;
  const goodStroke =
    resolvedGoodStroke !== undefined
      ? resolvedGoodStroke
      : variant === "success"
        ? "#fd8c3e"
        : "#13a2d7";
  const badStroke = resolvedBadStroke ?? "#9aa7b5";
  const connectorStroke = "rgba(72, 86, 98, 0.35)";

  const steps: ReactNode[] = [];

  if (hasData) {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      let xStart = msToX(segment.startMs, safeTotal);
      const xEnd = msToX(segment.endMs, safeTotal);
      if (xEnd - xStart < 1.5) {
        xStart = Math.max(TRACK_X, xEnd - 1.8);
      }
      const y = segment.isGood ? yOne : yZero;
      const strokeColor = segment.isGood ? goodStroke : badStroke;

      steps.push(
        <Line
          key={`h-${segment.startMs}-${segment.endMs}-${String(segment.isGood)}`}
          x1={xStart}
          y1={y}
          x2={xEnd}
          y2={y}
          strokeWidth={strokeW}
          strokeLinecap="round"
          stroke={strokeColor}
        />,
      );

      const prevSeg = segments[i - 1];
      if (
        prevSeg !== undefined &&
        prevSeg.isGood !== segment.isGood &&
        Math.abs(segment.startMs - prevSeg.endMs) <= 2
      ) {
        const xv = msToX(segment.startMs, safeTotal);
        const yFrom = prevSeg.isGood ? yOne : yZero;
        steps.push(
          <Line
            key={`v-${segment.startMs}-${i}`}
            x1={xv}
            y1={yFrom}
            x2={xv}
            y2={segment.isGood ? yOne : yZero}
            strokeWidth={strokeW * 0.55}
            stroke={connectorStroke}
          />,
        );
      }
    }
  }

  const summaryLabel =
    segments.length > 0 && safeTotal > 0
      ? `区間${segments.length}本・累計${Math.round(safeTotal / 1000)}秒`
      : "データなし";

  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`姿勢タイムライン。${summaryLabel}`}>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>1 · 良い</Text>
        <Text style={styles.axisLabel}>0 · 悪い</Text>
      </View>
      <Svg width={width} height={(width * VIEWBOX_H) / VIEWBOX_W} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
        <Rect
          x={TRACK_X}
          y={TRACK_Y}
          width={TRACK_W}
          height={TRACK_H}
          rx={10}
          fill="#f6f7f9"
          stroke="rgba(0,0,0,0.06)"
        />
        <Line
          x1={TRACK_X + 2}
          y1={(yOne + yZero) / 2}
          x2={TRACK_X + TRACK_W - 2}
          y2={(yOne + yZero) / 2}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />
        {hasData ? steps : null}
        {!hasData ? (
          <SvgText
            x={TRACK_X + TRACK_W / 2}
            y={TRACK_Y + TRACK_H / 2}
            fill="#989898"
            fontSize={13}
            textAnchor="middle"
            alignmentBaseline="middle">
            データなし
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  axisLabel: {
    fontSize: 11,
    color: "#666666",
    fontWeight: "700",
  },
});
