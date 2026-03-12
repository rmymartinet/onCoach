import { useRouter } from "expo-router";
import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { FloatingNav } from "@/components/floating-nav";

const currentVolumeTrend = [38, 46, 44, 58, 55, 61, 52];
const previousVolumeTrend = [26, 34, 22, 28, 24, 31, 21];
const trendLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const workoutDays = [
  {
    id: "mon-23",
    dow: "Mon",
    date: "23",
    workouts: [
      { title: "Upper Body", meta: "11 sets · 46 min", time: "7:20 AM" },
    ],
  },
  {
    id: "tue-24",
    dow: "Tue",
    date: "24",
    workouts: [],
  },
  {
    id: "wed-25",
    dow: "Wed",
    date: "25",
    workouts: [
      { title: "Lower Body", meta: "12 sets · 51 min", time: "8:10 AM" },
      { title: "Core Finisher", meta: "4 sets · 12 min", time: "8:58 AM" },
    ],
  },
  {
    id: "thu-26",
    dow: "Thu",
    date: "26",
    workouts: [],
  },
  {
    id: "fri-27",
    dow: "Fri",
    date: "27",
    workouts: [{ title: "Pull Day", meta: "9 sets · 38 min", time: "6:42 PM" }],
  },
  {
    id: "sat-28",
    dow: "Sat",
    date: "28",
    workouts: [{ title: "Legs", meta: "10 sets · 43 min", time: "10:15 AM" }],
  },
  {
    id: "sun-22",
    dow: "Sun",
    date: "22",
    workouts: [],
  },
] as const;

function buildTrendTop(value: number) {
  return `${100 - value}%`;
}

function TrendSeries({
  points,
  color,
  activeIndex,
}: {
  points: number[];
  color: string;
  activeIndex?: number | null;
}) {
  return (
    <View style={styles.trendSeries}>
      {points.map((point, index) => {
        const next = points[index + 1];
        const delta = typeof next === "number" ? next - point : 0;

        return (
          <View key={`${color}-${index}`} style={styles.trendPointWrap}>
            <View
              style={[
                styles.trendPoint,
                index === activeIndex && styles.trendPointActive,
                {
                  backgroundColor: color,
                  top: buildTrendTop(point),
                },
              ]}
            />
            {typeof next === "number" ? (
              <View
                style={[
                  styles.trendSegment,
                  {
                    backgroundColor: color,
                    top: buildTrendTop(point + delta / 2),
                    transform: [{ rotate: `${delta * -1.15}deg` }],
                  },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function VolumeTrendCard({ onPress }: { onPress: () => void }) {
  const [activeIndex, setActiveIndex] = useState(4);
  const [plotWidth, setPlotWidth] = useState(0);

  const stepWidth = plotWidth > 0 ? plotWidth / (currentVolumeTrend.length - 1) : 0;
  const activeLeft = stepWidth * activeIndex;
  const tooltipLeft = Math.max(6, Math.min(activeLeft - 36, plotWidth - 88));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const nextIndex = resolveTrendIndex(event.nativeEvent.locationX, plotWidth);
      setActiveIndex(nextIndex);
    },
    onPanResponderMove: (event) => {
      const nextIndex = resolveTrendIndex(event.nativeEvent.locationX, plotWidth);
      setActiveIndex(nextIndex);
    },
  });

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsTopRow}>
        <View>
          <Text style={styles.statsLabel}>VOLUME TREND</Text>
          <View style={styles.statsValueRow}>
            <Text style={styles.statsValue}>+12%</Text>
            <Text style={styles.statsUnit}>vs last week</Text>
          </View>
        </View>

        <View style={styles.statsRight}>
          <Text style={styles.statsLabel}>THIS WEEK</Text>
          <Text style={styles.statsTrend}>28 sets</Text>
        </View>
      </View>

      <Text style={styles.trendInsight}>Lower body volume is leading this week.</Text>

      <View style={styles.trendChartCard}>
        <View style={styles.trendGuideTop}>
          <Text style={styles.trendGuideText}>100%</Text>
          <Text style={styles.trendGuideLegend}>
            {trendLabels[activeIndex]} focus
          </Text>
        </View>

        <View
          style={styles.trendPlot}
          onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
          {...panResponder.panHandlers}
        >
          <View style={styles.trendGridTop} />
          <View style={styles.trendGridMid} />
          <View style={styles.trendGridBottom} />
          <View
            style={[
              styles.trendCursor,
              plotWidth > 0 && { left: activeLeft },
            ]}
          />
          <View
            style={[
              styles.trendTooltip,
              plotWidth > 0 && { left: tooltipLeft },
            ]}
          >
            <Text style={styles.trendTooltipDay}>{trendLabels[activeIndex]}</Text>
            <View style={styles.trendTooltipRow}>
              <View style={[styles.trendTooltipDot, styles.trendTooltipDotCurrent]} />
              <Text style={styles.trendTooltipValue}>
                {currentVolumeTrend[activeIndex]}%
              </Text>
              <View style={[styles.trendTooltipDot, styles.trendTooltipDotPrevious]} />
              <Text style={styles.trendTooltipValueMuted}>
                {previousVolumeTrend[activeIndex]}%
              </Text>
            </View>
          </View>

          <TrendSeries
            points={currentVolumeTrend}
            color="#ef5a29"
            activeIndex={activeIndex}
          />
          <TrendSeries
            points={previousVolumeTrend}
            color="#2948ff"
            activeIndex={activeIndex}
          />
        </View>

        <View style={styles.trendAxis}>
          <Text style={styles.trendAxisText}>Mon</Text>
          <Text style={styles.trendAxisText}>Wed</Text>
          <Text style={styles.trendAxisText}>Fri</Text>
          <Text style={styles.trendAxisText}>Sun</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.statsDetailTap, pressed && styles.pressed]}
        onPress={onPress}
      >
        <Text style={styles.statsHint}>Tap to see all exercises →</Text>
      </Pressable>
    </View>
  );
}

function resolveTrendIndex(locationX: number, plotWidth: number) {
  if (!plotWidth || plotWidth <= 0) {
    return 0;
  }

  const rawIndex = Math.round(
    (Math.max(0, Math.min(locationX, plotWidth)) / plotWidth) *
      (currentVolumeTrend.length - 1),
  );

  return Math.max(0, Math.min(rawIndex, currentVolumeTrend.length - 1));
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDayId, setSelectedDayId] = useState("wed-25");
  const selectedDay =
    workoutDays.find((day) => day.id === selectedDayId) ?? workoutDays[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.dayText}>Wednesday</Text>
              <Text style={styles.greeting}>Morning, Alex 👋</Text>
            </View>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </View>
            </View>
          </View>

          <VolumeTrendCard onPress={() => router.push("/stats-detail")} />

          <View style={styles.dayPickerBlock}>
            <Text style={styles.dayPickerLabel}>THIS WEEK</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayPickerRow}
            >
              {workoutDays.map((day) => {
                const selected = day.id === selectedDayId;
                const hasWorkout = day.workouts.length > 0;

                return (
                  <Pressable
                    key={day.id}
                    style={({ pressed }) => [
                      styles.dayPill,
                      selected && styles.dayPillActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setSelectedDayId(day.id)}
                  >
                    <View style={styles.dayPillTop}>
                      <Text
                        style={[
                          styles.dayPillDow,
                          selected && styles.dayPillDowActive,
                        ]}
                      >
                        {day.dow}
                      </Text>
                      <View
                        style={[
                          styles.dayDot,
                          hasWorkout && styles.dayDotFilled,
                          selected && styles.dayDotActive,
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dayPillDate,
                        selected && styles.dayPillDateActive,
                      ]}
                    >
                      {day.date}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.dayDetailCard}>
              <View style={styles.dayDetailHeader}>
                <View>
                  <Text style={styles.dayDetailTitle}>
                    {selectedDay.workouts.length
                      ? selectedDay.workouts.length === 1
                        ? "1 workout completed"
                        : `${selectedDay.workouts.length} workouts completed`
                      : "No workout logged"}
                  </Text>
                  <Text style={styles.dayDetailSubtitle}>
                    {selectedDay.dow} {selectedDay.date}
                  </Text>
                </View>
                {selectedDay.workouts.length ? (
                  <Text style={styles.dayDetailBadge}>Active</Text>
                ) : (
                  <Text style={styles.dayDetailBadgeMuted}>Open</Text>
                )}
              </View>

              {selectedDay.workouts.length ? (
                <View style={styles.dayWorkoutList}>
                  {selectedDay.workouts.map((workout, index) => (
                    <Pressable
                      key={`${selectedDay.id}-${workout.title}-${index}`}
                      onPress={() =>
                        router.push({
                          pathname: "/workout-detail",
                          params: {
                            title: workout.title,
                            meta: workout.meta,
                            time: workout.time,
                            day: `${selectedDay.dow} ${selectedDay.date}`,
                          },
                        })
                      }
                      style={[
                        styles.dayWorkoutRow,
                        index < selectedDay.workouts.length - 1 &&
                          styles.dayWorkoutRowBorder,
                      ]}
                    >
                      <View style={styles.dayWorkoutMain}>
                        <View>
                          <Text style={styles.dayWorkoutName}>
                            {workout.title}
                          </Text>
                          <Text style={styles.dayWorkoutMeta}>
                            {workout.meta}
                          </Text>
                        </View>
                        <View style={styles.dayWorkoutAside}>
                          <Text style={styles.dayWorkoutTime}>{workout.time}</Text>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={22}
                            color="#8a9098"
                          />
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.dayEmptyText}>
                  Nothing saved for this day yet. You can add one workout
                  manually or paste a note.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.recoCard}>
            <View style={styles.recoHeader}>
              <View>
                <Text style={styles.recoLabel}>RECOMMENDED NEXT</Text>
                <Text style={styles.recoTitle}>Lower Body</Text>
              </View>
              <View style={styles.recoBadge}>
                <Text style={styles.recoBadgeText}>Ready</Text>
              </View>
            </View>

            <Text style={styles.recoBody}>
              4 days since your last leg session. Good recovery window for another lower day.
            </Text>

            <View style={styles.recoMetaRow}>
              <View style={styles.recoMetaChip}>
                <Text style={styles.recoMetaText}>Legs</Text>
              </View>
              <View style={[styles.recoMetaChip, styles.recoMetaChipSoft]}>
                <Text style={styles.recoMetaText}>45 min</Text>
              </View>
              <View style={[styles.recoMetaChip, styles.recoMetaChipSoft]}>
                <Text style={styles.recoMetaText}>Machine + free weights</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.recoActionRow, pressed && styles.pressed]}
              onPress={() => router.push("/add-workout")}
            >
              <View>
                <Text style={styles.recoActionTitle}>Start this workout</Text>
                <Text style={styles.recoActionBody}>Open the guided flow and build today&apos;s session.</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color="#8a9098"
              />
            </Pressable>
          </View>

        <View style={styles.sessionsBlock}>
          <Text style={styles.sessionsTitle}>RECENT SESSIONS</Text>

          <Pressable
            style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
            onPress={() => router.push("/stats-detail")}
          >
            <View style={styles.sessionMain}>
              <View>
                <Text style={styles.sessionName}>Push Day</Text>
                <Text style={styles.sessionMeta}>9 sets · 42 min</Text>
              </View>
              <Text style={styles.sessionDate}>Yesterday</Text>
            </View>
            <Text style={styles.sessionArrow}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
            onPress={() => router.push("/stats-detail")}
          >
            <View style={styles.sessionMain}>
              <View>
                <Text style={styles.sessionName}>Pull Day</Text>
                <Text style={styles.sessionMeta}>8 sets · 38 min</Text>
              </View>
              <Text style={styles.sessionDate}>Nov 12</Text>
            </View>
            <Text style={styles.sessionArrow}>›</Text>
          </Pressable>
        </View>

          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/add-workout")}
          >
            <Text style={styles.addButtonText}>+ Add workout</Text>
          </Pressable>
        </View>
      </ScrollView>
      <FloatingNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 120,
  },
  container: {
    borderRadius: 30,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 22,
  },
  headerRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayText: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#b1b4b9",
    marginBottom: 2,
  },
  greeting: {
    fontFamily: Fonts.sans,
    ...Typography.title,
    color: "#161a20",
    fontWeight: "700",
  },
  avatarWrap: {
    paddingLeft: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: "#0d1015",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  statsCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dedee2",
    backgroundColor: "#f5f5f6",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  statsTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statsLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#a0a5ad",
    letterSpacing: 0.8,
  },
  statsValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  statsValue: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#1c2027",
    fontWeight: "700",
  },
  statsUnit: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8f949c",
  },
  statsRight: {
    alignItems: "flex-end",
  },
  statsTrend: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#22944b",
    fontWeight: "700",
  },
  trendInsight: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6c727b",
  },
  trendChartCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e1e3e6",
    backgroundColor: "#f9f9fa",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  trendGuideTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendGuideText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#a6abb2",
  },
  trendGuideLegend: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#ef5a29",
    fontWeight: "700",
  },
  trendPlot: {
    position: "relative",
    height: 110,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  trendGridTop: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#e2e4e7",
  },
  trendGridMid: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#e2e4e7",
  },
  trendGridBottom: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#e2e4e7",
  },
  trendSeries: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendPointWrap: {
    width: 34,
    height: "100%",
    position: "relative",
  },
  trendPoint: {
    position: "absolute",
    left: 0,
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  trendPointActive: {
    width: 10,
    height: 10,
    marginLeft: -1.5,
    marginTop: -1.5,
    borderWidth: 2,
    borderColor: "#f5f5f6",
  },
  trendSegment: {
    position: "absolute",
    left: 5,
    width: 36,
    height: 2,
    borderRadius: 99,
  },
  trendCursor: {
    position: "absolute",
    top: 10,
    bottom: 12,
    width: 1,
    backgroundColor: "#c7cad0",
    zIndex: 2,
  },
  trendTooltip: {
    position: "absolute",
    top: 12,
    width: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(220, 222, 226, 0.7)",
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    zIndex: 3,
    shadowColor: "#101318",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  trendTooltipDay: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#7a8088",
    fontWeight: "700",
    textAlign: "center",
  },
  trendTooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  trendTooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  trendTooltipDotCurrent: {
    backgroundColor: "#ef5a29",
  },
  trendTooltipDotPrevious: {
    backgroundColor: "#2948ff",
  },
  trendTooltipValue: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#2a2f37",
    fontWeight: "700",
  },
  trendTooltipValueMuted: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5165d6",
    fontWeight: "700",
  },
  trendAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendAxisText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9ca1a8",
  },
  statsHint: {
    textAlign: "right",
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#b1b5bb",
  },
  statsDetailTap: {
    marginTop: -2,
  },
  dayPickerBlock: {
    marginTop: 16,
    gap: 8,
  },
  dayPickerLabel: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#acb0b6",
    letterSpacing: 1,
    fontWeight: "600",
  },
  dayPickerRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 4,
  },
  dayPill: {
    width: 58,
    minHeight: 84,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d9dbdf",
    backgroundColor: "#fbfbfc",
    paddingHorizontal: 5,
    paddingVertical: 8,
    justifyContent: "space-between",
  },
  dayPillActive: {
    borderColor: "#0b0d12",
    backgroundColor: "#0b0d12",
  },
  dayPillTop: {
    alignItems: "center",
    gap: 5,
  },
  dayPillDow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#7b8088",
    fontWeight: "600",
  },
  dayPillDowActive: {
    color: "#f5f7fa",
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "transparent",
  },
  dayDotFilled: {
    backgroundColor: "#111318",
  },
  dayDotActive: {
    backgroundColor: "#f5f7fa",
  },
  dayPillDate: {
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#191d24",
    fontWeight: "700",
  },
  dayPillDateActive: {
    color: "#f5f7fa",
  },
  dayDetailCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  dayDetailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  dayDetailTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  dayDetailSubtitle: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9ca1a8",
  },
  dayDetailBadge: {
    borderRadius: 999,
    backgroundColor: "#eaf6ee",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#24754a",
    fontWeight: "700",
  },
  dayDetailBadgeMuted: {
    borderRadius: 999,
    backgroundColor: "#efefef",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#7e848d",
    fontWeight: "700",
  },
  dayWorkoutList: {
    gap: 0,
  },
  dayWorkoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  dayWorkoutMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  dayWorkoutAside: {
    alignItems: "flex-end",
    gap: 6,
    paddingLeft: 8,
  },
  dayWorkoutRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#e3e4e7",
  },
  dayWorkoutName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  dayWorkoutMeta: {
    marginTop: 3,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8d9299",
  },
  dayWorkoutTime: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8f96a0",
  },
  dayEmptyText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6f757e",
    lineHeight: 20,
  },
  recoCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  recoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  recoLabel: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#9ca1a8",
    letterSpacing: 1,
  },
  recoTitle: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#171b22",
    fontWeight: "700",
  },
  recoBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6f757e",
    lineHeight: 22,
  },
  recoBadge: {
    borderRadius: 999,
    backgroundColor: "#eaf6ee",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recoBadgeText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#24754a",
    fontWeight: "700",
  },
  recoMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recoMetaChip: {
    borderRadius: 999,
    backgroundColor: "#ece8df",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recoMetaChipSoft: {
    backgroundColor: "#efefef",
  },
  recoMetaText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#434952",
    fontWeight: "700",
  },
  recoActionRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e3e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recoActionTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  recoActionBody: {
    marginTop: 3,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8d9299",
  },
  sessionsBlock: {
    marginTop: 18,
    gap: 12,
  },
  sessionsTitle: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#acb0b6",
    letterSpacing: 1,
    fontWeight: "600",
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  sessionMain: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sessionName: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#1a1e24",
    fontWeight: "700",
  },
  sessionMeta: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#a5aab1",
  },
  sessionDate: {
    marginTop: 6,
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#b0b4ba",
  },
  sessionArrow: {
    fontFamily: Fonts.sans,
    fontSize: 28,
    lineHeight: 28,
    color: "#a9aeb5",
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e1e4",
  },
  addButton: {
    marginTop: 22,
    alignSelf: "center",
    minWidth: 140,
    height: 44,
    borderRadius: 99,
    backgroundColor: "#080a0e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  addButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#f3f5f8",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.92,
  },
});
