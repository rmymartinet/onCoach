import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { getAiContext } from "@/lib/ai-api";

type HomeWorkoutExercise = {
  id: string;
  name: string;
  normalizedName?: string | null;
  sets?: number | null;
  reps?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  weight?: number | null;
  unit?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
  order: number;
};

type HomeWorkout = {
  id: string;
  title: string;
  rawText: string;
  cleanedSummary: string | null;
  sessionType: string | null;
  fatigueNote: string | null;
  performedAt: string | null;
  createdAt: string;
  exercises: HomeWorkoutExercise[];
};

type HomeRecommendation = {
  id: string;
  title: string;
  goal?: string | null;
  coachSummary?: string | null;
  explanation?: string | null;
  estimatedDurationMinutes?: number | null;
  exercises: {
    name: string;
    muscleGroups?: string[];
    equipment?: string[];
  }[];
} | null;

type DayWorkout = {
  workoutId: string;
  id: string;
  title: string;
  meta: string;
  time: string;
  dayLabel: string;
  exercises: HomeWorkoutExercise[];
};

type HomeProgramRow = {
  key: string;
  title: string;
  focusLabel: string;
  sessionsCount: number;
  totalSets: number;
  lastPerformedLabel: string;
  latestWorkout: HomeWorkout;
};

function buildTrendTop(value: number) {
  return `${100 - value}%`;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWorkoutDate(workout: HomeWorkout) {
  const raw = workout.performedAt ?? workout.createdAt;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatTimeLabel(value: string | null | undefined) {
  if (!value) return "Saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(value: string | null | undefined) {
  if (!value) return "Saved workout";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWorkoutMeta(workout: HomeWorkout) {
  const totalSets = workout.exercises.reduce(
    (sum, exercise) => sum + (exercise.sets ?? 0),
    0,
  );
  const uniqueExercises = workout.exercises.length;
  return `${totalSets} sets · ${uniqueExercises} exercises`;
}

function toTitleWords(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getProgramFocus(workout: HomeWorkout) {
  const raw = (workout.sessionType ?? "").trim();
  if (!raw) return "Custom";
  const cleaned = raw.replaceAll("_", " ").replaceAll("-", " ");
  return toTitleWords(cleaned);
}

function getProgramTitle(workout: HomeWorkout) {
  const raw = (workout.title ?? workout.cleanedSummary ?? "").trim();
  if (raw) return raw;
  return getProgramFocus(workout);
}

function buildProgramRows(workouts: HomeWorkout[]): HomeProgramRow[] {
  const buckets = new Map<
    string,
    { latestWorkout: HomeWorkout; sessionsCount: number; totalSets: number; focusLabel: string; title: string }
  >();

  for (const workout of workouts) {
    const focusLabel = getProgramFocus(workout);
    const title = getProgramTitle(workout);
    const key = title.toLowerCase();
    const sets = workout.exercises.reduce((sum, exercise) => sum + (exercise.sets ?? 0), 0);
    const current = buckets.get(key);

    if (!current) {
      buckets.set(key, {
        title,
        focusLabel,
        latestWorkout: workout,
        sessionsCount: 1,
        totalSets: sets,
      });
      continue;
    }

    current.sessionsCount += 1;
    current.totalSets += sets;
  }

  return Array.from(buckets.entries())
    .map(([key, value]) => ({
      key,
      title: value.title,
      focusLabel: value.focusLabel,
      sessionsCount: value.sessionsCount,
      totalSets: value.totalSets,
      lastPerformedLabel: formatDayLabel(value.latestWorkout.performedAt ?? value.latestWorkout.createdAt),
      latestWorkout: value.latestWorkout,
    }))
    .sort((a, b) => {
      const aDate = getWorkoutDate(a.latestWorkout).getTime();
      const bDate = getWorkoutDate(b.latestWorkout).getTime();
      return bDate - aDate;
    });
}

function buildWeekDays(workouts: HomeWorkout[]) {
  const weekStart = startOfWeek(new Date());
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return dayLabels.map((dow, index) => {
    const date = addDays(weekStart, index);
    const isoDate = formatIsoDate(date);
    const workoutsForDay = workouts
      .filter((workout) => formatIsoDate(getWorkoutDate(workout)) === isoDate)
      .map<DayWorkout>((workout) => ({
        workoutId: workout.id,
        id: workout.id,
        title: workout.title || workout.sessionType || "Workout",
        meta: formatWorkoutMeta(workout),
        time: formatTimeLabel(workout.performedAt ?? workout.createdAt),
        dayLabel: formatDayLabel(workout.performedAt ?? workout.createdAt),
        exercises: workout.exercises,
      }));

    return {
      id: isoDate,
      dow,
      date: `${date.getDate()}`,
      isoDate,
      workouts: workoutsForDay,
    };
  });
}

function buildTrendSeries(workouts: HomeWorkout[]) {
  const weekStart = startOfWeek(new Date());
  const previousWeekStart = addDays(weekStart, -7);

  const sumSetsForDay = (target: Date) =>
    workouts
      .filter((workout) => formatIsoDate(getWorkoutDate(workout)) === formatIsoDate(target))
      .reduce(
        (sum, workout) =>
          sum + workout.exercises.reduce((inner, exercise) => inner + (exercise.sets ?? 0), 0),
        0,
      );

  const currentRaw = Array.from({ length: 7 }, (_, index) =>
    sumSetsForDay(addDays(weekStart, index)),
  );
  const previousRaw = Array.from({ length: 7 }, (_, index) =>
    sumSetsForDay(addDays(previousWeekStart, index)),
  );

  const hasData = [...currentRaw, ...previousRaw].some((value) => value > 0);

  if (!hasData) {
    return {
      hasData,
      currentRaw,
      previousRaw,
      currentNormalized: Array.from({ length: 7 }, () => 0),
      previousNormalized: Array.from({ length: 7 }, () => 0),
    };
  }

  const maxValue = Math.max(1, ...currentRaw, ...previousRaw);
  const normalize = (value: number) => Math.round((value / maxValue) * 70) + 18;

  return {
    hasData,
    currentRaw,
    previousRaw,
    currentNormalized: currentRaw.map(normalize),
    previousNormalized: previousRaw.map(normalize),
  };
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

function resolveTrendIndex(locationX: number, plotWidth: number, pointCount: number) {
  if (!plotWidth || plotWidth <= 0 || pointCount <= 1) {
    return 0;
  }

  const rawIndex = Math.round(
    (Math.max(0, Math.min(locationX, plotWidth)) / plotWidth) * (pointCount - 1),
  );

  return Math.max(0, Math.min(rawIndex, pointCount - 1));
}

function VolumeTrendCard({
  hasData,
  currentNormalized,
  previousNormalized,
  currentRaw,
  previousRaw,
  onPress,
}: {
  hasData: boolean;
  currentNormalized: number[];
  previousNormalized: number[];
  currentRaw: number[];
  previousRaw: number[];
  onPress: () => void;
}) {
  const trendLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [activeIndex, setActiveIndex] = useState(0);
  const [plotWidth, setPlotWidth] = useState(0);

  useEffect(() => {
    setActiveIndex(currentRaw.findLastIndex((value) => value > 0));
  }, [currentRaw]);

  const safeIndex = activeIndex < 0 ? 0 : activeIndex;
  const stepWidth = plotWidth > 0 ? plotWidth / (currentNormalized.length - 1 || 1) : 0;
  const activeLeft = stepWidth * safeIndex;
  const tooltipLeft = Math.max(6, Math.min(activeLeft - 36, plotWidth - 88));

  const totalCurrent = currentRaw.reduce((sum, value) => sum + value, 0);
  const totalPrevious = previousRaw.reduce((sum, value) => sum + value, 0);
  const deltaPercent = totalPrevious > 0 ? Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100) : 0;
  const leadIndex = currentRaw.findIndex((value) => value === Math.max(...currentRaw));
  const insight =
    hasData
      ? `${trendLabels[Math.max(0, leadIndex)]} is your highest-volume day this week.`
      : "Log your first workout to unlock volume insights.";

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const nextIndex = resolveTrendIndex(event.nativeEvent.locationX, plotWidth, currentNormalized.length);
      setActiveIndex(nextIndex);
    },
    onPanResponderMove: (event) => {
      const nextIndex = resolveTrendIndex(event.nativeEvent.locationX, plotWidth, currentNormalized.length);
      setActiveIndex(nextIndex);
    },
  });

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsTopRow}>
        <View>
          <Text style={styles.statsLabel}>VOLUME TREND</Text>
          <View style={styles.statsValueRow}>
          <Text style={styles.statsValue}>
              {hasData ? (deltaPercent > 0 ? `+${deltaPercent}%` : `${deltaPercent}%`) : "0%"}
            </Text>
            <Text style={styles.statsUnit}>vs last week</Text>
          </View>
        </View>

        <View style={styles.statsRight}>
          <Text style={styles.statsLabel}>THIS WEEK</Text>
          <Text style={styles.statsTrend}>{totalCurrent} sets</Text>
        </View>
      </View>

      <Text style={styles.trendInsight}>{insight}</Text>

      <View style={styles.trendChartCard}>
        <View style={styles.trendGuideTop}>
          <Text style={styles.trendGuideText}>100%</Text>
          <Text style={styles.trendGuideLegend}>{trendLabels[safeIndex]} focus</Text>
        </View>

        <View
          style={styles.trendPlot}
          onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
          {...panResponder.panHandlers}
        >
          <View style={styles.trendGridTop} />
          <View style={styles.trendGridMid} />
          <View style={styles.trendGridBottom} />
          <View style={[styles.trendCursor, plotWidth > 0 && { left: activeLeft }]} />
          {hasData ? (
            <>
              <View style={[styles.trendTooltip, plotWidth > 0 && { left: tooltipLeft }]}>
                <Text style={styles.trendTooltipDay}>{trendLabels[safeIndex]}</Text>
                <View style={styles.trendTooltipRow}>
                  <View style={[styles.trendTooltipDot, styles.trendTooltipDotCurrent]} />
                  <Text style={styles.trendTooltipValue}>{currentRaw[safeIndex] ?? 0} sets</Text>
                </View>
                <View style={styles.trendTooltipRow}>
                  <View style={[styles.trendTooltipDot, styles.trendTooltipDotPrevious]} />
                  <Text style={styles.trendTooltipValueMuted}>{previousRaw[safeIndex] ?? 0} sets</Text>
                </View>
              </View>

              <TrendSeries points={currentNormalized} color="#ef5a29" activeIndex={safeIndex} />
              <TrendSeries points={previousNormalized} color="#2948ff" activeIndex={safeIndex} />
            </>
          ) : (
            <View style={styles.trendEmptyState}>
              <Text style={styles.trendEmptyText}>No volume data yet</Text>
            </View>
          )}
        </View>

        <View style={styles.trendAxis}>
          <Text style={styles.trendAxisText}>Mon</Text>
          <Text style={styles.trendAxisText}>Wed</Text>
          <Text style={styles.trendAxisText}>Fri</Text>
          <Text style={styles.trendAxisText}>Sun</Text>
        </View>
      </View>

      <Pressable style={({ pressed }) => [styles.statsDetailTap, pressed && styles.pressed]} onPress={onPress}>
        <Text style={styles.statsHint}>Tap to see all exercises →</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDayId, setSelectedDayId] = useState(formatIsoDate(new Date()));
  const [userName, setUserName] = useState("Athlete");
  const [splitPreference, setSplitPreference] = useState<string | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<HomeWorkout[]>([]);
  const [latestRecommendation, setLatestRecommendation] = useState<HomeRecommendation>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadHome() {
        try {
          setLoading(true);
          const result = await getAiContext();
          if (cancelled) return;

          setUserName(result.user?.name?.trim() || "Athlete");
          setSplitPreference(result.user?.splitPreference ?? null);
          setRecentWorkouts(result.recentWorkouts as HomeWorkout[]);
          setLatestRecommendation((result.latestRecommendation as HomeRecommendation) ?? null);
          setError(null);
        } catch (nextError) {
          if (!cancelled) {
            setError(nextError instanceof Error ? nextError.message : "Failed to load home");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      void loadHome();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const weekDays = useMemo(() => buildWeekDays(recentWorkouts), [recentWorkouts]);
  const selectedDay = weekDays.find((day) => day.id === selectedDayId) ?? weekDays[0] ?? null;
  const trendData = useMemo(() => buildTrendSeries(recentWorkouts), [recentWorkouts]);
  const programRows = useMemo(() => buildProgramRows(recentWorkouts), [recentWorkouts]);
  const recentSessionRows = recentWorkouts.slice(0, 2);
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.dayText}>{todayName}</Text>
              <Text style={styles.greeting}>Morning, {userName} 👋</Text>
            </View>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#1c2027" />
            </View>
          ) : (
            <>
              <VolumeTrendCard
                hasData={trendData.hasData}
                currentNormalized={trendData.currentNormalized}
                previousNormalized={trendData.previousNormalized}
                currentRaw={trendData.currentRaw}
                previousRaw={trendData.previousRaw}
                onPress={() => router.push("/stats-detail")}
              />

              <View style={styles.dayPickerBlock}>
                <Text style={styles.dayPickerLabel}>THIS WEEK</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayPickerRow}
                >
                  {weekDays.map((day) => {
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
                          <Text style={[styles.dayPillDow, selected && styles.dayPillDowActive]}>{day.dow}</Text>
                          <View
                            style={[
                              styles.dayDot,
                              hasWorkout && styles.dayDotFilled,
                              selected && styles.dayDotActive,
                            ]}
                          />
                        </View>
                        <Text style={[styles.dayPillDate, selected && styles.dayPillDateActive]}>{day.date}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.dayDetailCard}>
                  <View style={styles.dayDetailHeader}>
                    <View>
                      <Text style={styles.dayDetailTitle}>
                        {selectedDay?.workouts.length
                          ? selectedDay.workouts.length === 1
                            ? "1 workout completed"
                            : `${selectedDay.workouts.length} workouts completed`
                          : "No workout logged"}
                      </Text>
                      <Text style={styles.dayDetailSubtitle}>
                        {selectedDay ? `${selectedDay.dow} ${selectedDay.date}` : "This week"}
                      </Text>
                    </View>
                    {selectedDay?.workouts.length ? (
                      <Text style={styles.dayDetailBadge}>Active</Text>
                    ) : (
                      <Text style={styles.dayDetailBadgeMuted}>Open</Text>
                    )}
                  </View>

                  {selectedDay?.workouts.length ? (
                    <View style={styles.dayWorkoutList}>
                      {selectedDay.workouts.map((workout, index) => (
                        <Pressable
                          key={workout.id}
                          onPress={() =>
                            router.push({
                              pathname: "/workout-detail",
                              params: {
                                workoutId: workout.workoutId,
                                title: workout.title,
                                meta: workout.meta,
                                time: workout.time,
                                day: workout.dayLabel,
                                exercises: JSON.stringify(workout.exercises),
                              },
                            })
                          }
                          style={[
                            styles.dayWorkoutRow,
                            index < selectedDay.workouts.length - 1 && styles.dayWorkoutRowBorder,
                          ]}
                        >
                          <View style={styles.dayWorkoutMain}>
                            <View>
                              <Text style={styles.dayWorkoutName}>{workout.title}</Text>
                              <Text style={styles.dayWorkoutMeta}>{workout.meta}</Text>
                            </View>
                            <View style={styles.dayWorkoutAside}>
                              <Text style={styles.dayWorkoutTime}>{workout.time}</Text>
                              <MaterialCommunityIcons name="chevron-right" size={22} color="#8a9098" />
                            </View>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.dayEmptyText}>
                      Nothing saved for this day yet. Add a workout and this week view will update automatically.
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.recoCard}>
                <View style={styles.recoHeader}>
                  <View>
                    <Text style={styles.recoLabel}>RECOMMENDED NEXT</Text>
                    <Text style={styles.recoTitle}>{latestRecommendation?.title ?? "No recommendation yet"}</Text>
                  </View>
                  <View style={styles.recoBadge}>
                    <Text style={styles.recoBadgeText}>{latestRecommendation ? "Ready" : "Waiting"}</Text>
                  </View>
                </View>

                <Text style={styles.recoBody}>
                  {latestRecommendation?.coachSummary ??
                    latestRecommendation?.explanation ??
                    "Generate or save a workout to unlock your next recommendation."}
                </Text>

                <View style={styles.recoMetaRow}>
                  {latestRecommendation?.goal ? (
                    <View style={styles.recoMetaChip}>
                      <Text style={styles.recoMetaText}>{latestRecommendation.goal.replaceAll("_", " ")}</Text>
                    </View>
                  ) : null}
                  {latestRecommendation?.estimatedDurationMinutes ? (
                    <View style={[styles.recoMetaChip, styles.recoMetaChipSoft]}>
                      <Text style={styles.recoMetaText}>{latestRecommendation.estimatedDurationMinutes} min</Text>
                    </View>
                  ) : null}
                  {latestRecommendation?.exercises[0]?.equipment?.length ? (
                    <View style={[styles.recoMetaChip, styles.recoMetaChipSoft]}>
                      <Text style={styles.recoMetaText}>
                        {latestRecommendation.exercises[0].equipment.slice(0, 2).join(" + ")}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  style={({ pressed }) => [styles.recoActionRow, pressed && styles.pressed]}
                  onPress={() => router.push("/ai-workspace")}
                >
                  <View style={styles.recoActionMain}>
                    <Text style={styles.recoActionTitle}>
                      {latestRecommendation ? "Open this recommendation" : "Generate your first recommendation"}
                    </Text>
                    <Text style={styles.recoActionBody}>
                      {latestRecommendation
                        ? "Open the guided flow and refine today’s session."
                        : "Go to the workout flow and build a first recommendation with AI."}
                    </Text>
                  </View>
                  <View style={styles.recoActionAside}>
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#8a9098" />
                  </View>
                </Pressable>
              </View>

              <View style={styles.programsBlock}>
                <View style={styles.programsHeader}>
                  <Text style={styles.programsTitle}>MY PROGRAMS</Text>
                  {splitPreference ? (
                    <View style={styles.programsChip}>
                      <Text style={styles.programsChipText}>{splitPreference.replaceAll("_", " ")}</Text>
                    </View>
                  ) : null}
                </View>

                {programRows.length ? (
                  <View style={styles.programsList}>
                    {programRows.slice(0, 6).map((program) => (
                      <Pressable
                        key={program.key}
                        style={({ pressed }) => [styles.programRow, pressed && styles.pressed]}
                        onPress={() =>
                          router.push({
                              pathname: "/workout-detail",
                              params: {
                                workoutId: program.latestWorkout.id,
                                title: program.latestWorkout.title,
                              meta: formatWorkoutMeta(program.latestWorkout),
                              time: formatTimeLabel(program.latestWorkout.performedAt ?? program.latestWorkout.createdAt),
                              day: formatDayLabel(program.latestWorkout.performedAt ?? program.latestWorkout.createdAt),
                              exercises: JSON.stringify(program.latestWorkout.exercises),
                            },
                          })
                        }
                      >
                        <View style={styles.programRowMain}>
                          <Text style={styles.programRowTitle}>{program.title}</Text>
                          <Text style={styles.programRowMeta}>
                            {program.focusLabel} · {program.sessionsCount} sessions · {program.totalSets} sets
                          </Text>
                        </View>
                        <View style={styles.programRowAside}>
                          <Text style={styles.programRowDate}>{program.lastPerformedLabel}</Text>
                          <MaterialCommunityIcons name="chevron-right" size={20} color="#8a9098" />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.dayEmptyText}>No programs yet. Save workouts to build your program list.</Text>
                )}
              </View>

              <View style={styles.sessionsBlock}>
                <Text style={styles.sessionsTitle}>RECENT SESSIONS</Text>

                {recentSessionRows.length ? (
                  recentSessionRows.map((workout, index) => (
                    <View key={workout.id}>
                      <Pressable
                        style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
                        onPress={() =>
                          router.push({
                            pathname: "/workout-detail",
                            params: {
                              workoutId: workout.id,
                              title: workout.title,
                              meta: formatWorkoutMeta(workout),
                              time: formatTimeLabel(workout.performedAt ?? workout.createdAt),
                              day: formatDayLabel(workout.performedAt ?? workout.createdAt),
                              exercises: JSON.stringify(workout.exercises),
                            },
                          })
                        }
                      >
                        <View style={styles.sessionMain}>
                          <View>
                            <Text style={styles.sessionName}>{workout.title}</Text>
                            <Text style={styles.sessionMeta}>{formatWorkoutMeta(workout)}</Text>
                          </View>
                          <Text style={styles.sessionDate}>
                            {formatDayLabel(workout.performedAt ?? workout.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.sessionArrow}>›</Text>
                      </Pressable>

                      {index < recentSessionRows.length - 1 ? <View style={styles.divider} /> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.dayEmptyText}>No saved sessions yet.</Text>
                )}
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </>
          )}
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
  loadingCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e1e3e6",
    backgroundColor: "#f7f6f4",
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  errorCard: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e7b1ac",
    backgroundColor: "#fff3f1",
    padding: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#a3342a",
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
  trendEmptyState: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  trendEmptyText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#a0a5ad",
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
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7e848d",
  },
  dayWorkoutTime: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#9aa0a8",
  },
  dayEmptyText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8b9097",
  },
  recoCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d8d9dd",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  recoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  recoLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#98a0aa",
    letterSpacing: 0.8,
  },
  recoTitle: {
    marginTop: 4,
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#171a21",
    fontWeight: "700",
  },
  recoBadge: {
    borderRadius: 999,
    backgroundColor: "#eef8ef",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recoBadgeText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#257448",
    fontWeight: "700",
  },
  recoBody: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#69707a",
    lineHeight: 22,
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
    color: "#3f454e",
    fontWeight: "600",
  },
  recoActionRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dddedf",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recoActionMain: {
    flex: 1,
    gap: 4,
  },
  recoActionTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  recoActionBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8b9097",
  },
  recoActionAside: {
    paddingLeft: 6,
  },
  programsBlock: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  programsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  programsTitle: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#acb0b6",
    letterSpacing: 1,
    fontWeight: "600",
  },
  programsChip: {
    borderRadius: 999,
    backgroundColor: "#ece8df",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  programsChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#3f454e",
    fontWeight: "700",
  },
  programsList: {
    gap: 0,
  },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e1d9",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  programRowMain: {
    flex: 1,
    gap: 2,
  },
  programRowTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  programRowMeta: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7e848d",
  },
  programRowAside: {
    alignItems: "flex-end",
    gap: 4,
  },
  programRowDate: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9ba1a9",
  },
  sessionsBlock: {
    marginTop: 16,
  },
  sessionsTitle: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#acb0b6",
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: 10,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  sessionMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  sessionMeta: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7e848d",
  },
  sessionDate: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9ba1a9",
  },
  sessionArrow: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    lineHeight: 24,
    color: "#8a9098",
  },
  divider: {
    height: 1,
    backgroundColor: "#e3e4e7",
  },
  pressed: {
    opacity: 0.92,
  },
});
