import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { deleteWorkout, deleteWorkoutExercise } from "@/lib/ai-api";

type WorkoutDetailExercise = {
  id?: string;
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

type TimelineMeta = {
  week: string;
  day: string;
};

type FallbackMetrics = {
  sets: string | null;
  reps: string | null;
  rest: string | null;
  repMode: "standard" | "failure";
};

function toUserNote(raw?: string | null) {
  const value = raw?.trim();
  if (!value) return "";

  const parts = value.split("||");
  if (parts.length > 1) {
    return parts[1]?.trim() ?? "";
  }

  if (value.startsWith("method=") || value.includes("timelineWeek=") || value.includes("timelineDate=")) {
    return "";
  }

  return value;
}

function inferMetricsFromNote(note: string) {
  const normalized = note.trim();
  if (!normalized) {
    return { sets: null, reps: null, rest: null, repMode: "standard" } satisfies FallbackMetrics;
  }

  const setRepMatch = normalized.match(/(\d+)\s*x\s*(\d+)/i);
  const setsMatch = normalized.match(/(\d+)\s*sets?\b/i);
  const repsMatch = normalized.match(/(\d+)\s*reps?\b/i);
  const restSecondsMatch = normalized.match(/(\d+)\s*(?:s|sec|secs|seconds?|secondes?)\b/i);
  const restMinutesMatch = normalized.match(/(\d+)\s*(?:min|mins|minutes?)\b/i);

  return {
    sets: setRepMatch?.[1] ?? setsMatch?.[1] ?? null,
    reps: setRepMatch?.[2] ?? repsMatch?.[1] ?? null,
    rest: restMinutesMatch
      ? `${restMinutesMatch[1]} min`
      : restSecondsMatch
        ? `${restSecondsMatch[1]}s`
        : null,
    repMode: /\b(repMode=failure|echec|échec|failure)\b/i.test(normalized) ? "failure" : "standard",
  } satisfies FallbackMetrics;
}

function formatRepRange(repMin?: number | null, repMax?: number | null) {
  if (typeof repMin === "number" && typeof repMax === "number") {
    return repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`;
  }
  if (typeof repMin === "number") return `${repMin}+`;
  if (typeof repMax === "number") return `${repMax}`;
  return null;
}

function formatExerciseDetail(exercise: WorkoutDetailExercise) {
  if (typeof exercise.sets === "number" && typeof exercise.reps === "number") {
    return `${exercise.sets} x ${exercise.reps}`;
  }

  const repRange = formatRepRange(exercise.repMin, exercise.repMax);
  if (typeof exercise.sets === "number" && repRange) {
    return `${exercise.sets} x ${repRange}`;
  }

  if (typeof exercise.sets === "number") {
    return `${exercise.sets} sets`;
  }

  const inferred = inferMetricsFromNote(toUserNote(exercise.notes));
  if (inferred.repMode === "failure" && inferred.sets) {
    return `${inferred.sets} x failure`;
  }
  if (inferred.sets && inferred.reps) {
    return `${inferred.sets} x ${inferred.reps}`;
  }
  if (inferred.sets) {
    return `${inferred.sets} sets`;
  }
  if (inferred.reps) {
    return `${inferred.reps} reps`;
  }

  return "Volume not specified";
}

function formatExerciseLoad(exercise: WorkoutDetailExercise) {
  if (typeof exercise.weight !== "number") return null;
  return `${exercise.weight}${exercise.unit ? ` ${exercise.unit}` : " kg"}`;
}

function formatExerciseRest(exercise: WorkoutDetailExercise) {
  if (typeof exercise.restSeconds !== "number") {
    return inferMetricsFromNote(toUserNote(exercise.notes)).rest;
  }
  return `${exercise.restSeconds}s rest`;
}

function parseExercisesParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return [] as WorkoutDetailExercise[];

  try {
    const parsed = JSON.parse(raw) as WorkoutDetailExercise[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseTimelineFromNotes(notes?: string | null): TimelineMeta | null {
  const raw = notes?.trim();
  if (!raw) return null;

  const weekMatch = raw.match(/timelineWeek=([^;|]+)/i);
  const dayMatch = raw.match(/timelineDate=([^;|]+)/i);
  if (!weekMatch && !dayMatch) return null;

  return {
    week: weekMatch?.[1]?.trim() || "Week 0",
    day: dayMatch?.[1]?.trim() || "Day",
  };
}

function parseTargetAreaFromNotes(notes?: string | null) {
  const raw = notes?.trim();
  if (!raw) return null;
  const match = raw.match(/targetArea=([^;|]+)/i);
  return match?.[1]?.trim() || null;
}

function parseWeekIndex(label: string) {
  const match = label.match(/(\d+)/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]);
}

function dayOrder(day: string) {
  const ordered = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const index = ordered.findIndex((item) => item.toLowerCase() === day.toLowerCase());
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function groupExercisesByWeekDay(exercises: WorkoutDetailExercise[]) {
  const weekMap = new Map<string, Map<string, WorkoutDetailExercise[]>>();

  for (const exercise of exercises) {
    const timeline = parseTimelineFromNotes(exercise.notes);
    const week = timeline?.week || "Unscheduled";
    const day = timeline?.day || "Unscheduled";
    const dayMap = weekMap.get(week) ?? new Map<string, WorkoutDetailExercise[]>();
    const current = dayMap.get(day) ?? [];
    dayMap.set(day, [...current, exercise]);
    weekMap.set(week, dayMap);
  }

  return Array.from(weekMap.entries())
    .sort((a, b) => parseWeekIndex(a[0]) - parseWeekIndex(b[0]))
    .map(([week, dayMap]) => ({
      week,
      days: Array.from(dayMap.entries())
        .sort((a, b) => dayOrder(a[0]) - dayOrder(b[0]))
        .map(([day, dayExercises]) => ({
          day,
          exercises: dayExercises.sort((a, b) => a.order - b.order),
        })),
    }));
}

function inferMuscleLabel(exercise: WorkoutDetailExercise) {
  const explicit = parseTargetAreaFromNotes(exercise.notes);
  if (explicit) return explicit;

  const raw = `${exercise.name} ${exercise.notes ?? ""}`.toLowerCase();
  if (/presse|leg press|squat|quad|glute|calf|ham|ischio|leg extension|extension|leg curl|curl jambes|hack|fente|lunge|mollet|adductor|abductor/.test(raw)) {
    return "Lower";
  }
  if (/bench|chest|fly|pec|military press|shoulder press|dip/.test(raw)) return "Push";
  if (/row|pull|lat|curl|back/.test(raw)) return "Pull";
  if (/shoulder|lateral|rear delt/.test(raw)) return "Shoulders";
  if (/triceps|biceps|arm/.test(raw)) return "Arms";
  if (/core|ab|plank/.test(raw)) return "Core";
  return "Exercise";
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    meta?: string;
    time?: string;
    day?: string;
    exercises?: string;
    workoutId?: string;
    fromSaved?: string;
  }>();

  const title = params.title ?? "Workout";
  const meta = params.meta ?? "Session overview";
  const time = params.time ?? "Saved";
  const day = params.day ?? "Workout";
  const workoutId = params.workoutId ?? "";
  const [exercises, setExercises] = useState(parseExercisesParam(params.exercises));
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);
  const [deletingWorkout, setDeletingWorkout] = useState(false);
  const planGroups = groupExercisesByWeekDay(exercises);
  const openedFromSave = params.fromSaved === "1";
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  function isWeekOpen(week: string, weekIndex: number) {
    if (Object.prototype.hasOwnProperty.call(openWeeks, week)) {
      return openWeeks[week];
    }
    return weekIndex === 0;
  }

  function isDayOpen(dayKey: string, dayIndex: number) {
    if (Object.prototype.hasOwnProperty.call(openDays, dayKey)) {
      return openDays[dayKey];
    }
    return dayIndex === 0;
  }

  async function handleDeleteExercise(exerciseId?: string) {
    if (!exerciseId || !workoutId) return;
    setDeletingExerciseId(exerciseId);
    try {
      await deleteWorkoutExercise(exerciseId);
      setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
    } finally {
      setDeletingExerciseId(null);
    }
  }

  function handleDeleteWorkout() {
    if (!workoutId) return;

    Alert.alert(
      "Delete program",
      "This will permanently delete the whole program and all its exercises.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingWorkout(true);
            try {
              await deleteWorkout(workoutId);
              router.replace("/home");
            } finally {
              setDeletingWorkout(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.backTap, pressed && styles.pressed]}
              onPress={() => {
                if (openedFromSave) {
                  router.replace("/home");
                  return;
                }
                router.back();
              }}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.title}>Workout detail</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>{day}</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroMeta}>{meta}</Text>
            <Text style={styles.heroTime}>Completed at {time}</Text>
            {workoutId ? (
              <Pressable
                style={({ pressed }) => [styles.deleteWorkoutButton, pressed && styles.pressed]}
                onPress={handleDeleteWorkout}
                disabled={deletingWorkout}
              >
                <Text style={styles.deleteWorkoutButtonText}>
                  {deletingWorkout ? "Deleting..." : "Delete program"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXERCISES</Text>
            <View style={styles.exerciseList}>
              {exercises.length ? (
                planGroups.map((weekGroup, weekIndex) => (
                  <View key={weekGroup.week} style={styles.weekBlock}>
                    <Pressable
                      style={({ pressed }) => [styles.groupHeaderRow, pressed && styles.pressed]}
                      onPress={() =>
                        setOpenWeeks((current) => ({
                          ...current,
                          [weekGroup.week]: !isWeekOpen(weekGroup.week, weekIndex),
                        }))
                      }
                    >
                      <Text style={styles.weekLabel}>{weekGroup.week}</Text>
                      <MaterialCommunityIcons
                        name={isWeekOpen(weekGroup.week, weekIndex) ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#8a9098"
                      />
                    </Pressable>

                    {isWeekOpen(weekGroup.week, weekIndex) ? (
                      <View style={styles.dayGroupList}>
                        {weekGroup.days.map((dayGroup, dayIndex) => {
                          const dayKey = `${weekGroup.week}-${dayGroup.day}`;
                          const dayOpen = isDayOpen(dayKey, dayIndex);

                          return (
                            <View key={dayKey} style={styles.dayGroupCard}>
                              <Pressable
                                style={({ pressed }) => [styles.groupHeaderRow, pressed && styles.pressed]}
                                onPress={() =>
                                  setOpenDays((current) => ({
                                    ...current,
                                    [dayKey]: !dayOpen,
                                  }))
                                }
                              >
                                <Text style={styles.dayGroupLabel}>{dayGroup.day}</Text>
                                <MaterialCommunityIcons
                                  name={dayOpen ? "chevron-up" : "chevron-down"}
                                  size={20}
                                  color="#8a9098"
                                />
                              </Pressable>

                              {dayOpen ? (
                                <View style={styles.dayExerciseList}>
                                  {dayGroup.exercises.map((exercise) => {
                                    const detail = formatExerciseDetail(exercise);
                                    const load = formatExerciseLoad(exercise);
                                    const rest = formatExerciseRest(exercise);
                                    const muscle = inferMuscleLabel(exercise);
                                    const note = toUserNote(exercise.notes);

                                    return (
                                      <Pressable
                                        key={`${weekGroup.week}-${dayGroup.day}-${exercise.order}-${exercise.name}`}
                                        style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
                                        onPress={() =>
                                          router.push({
                                            pathname: "/exercise-detail",
                                            params: {
                                              name: exercise.name,
                                              detail,
                                              load: load ?? "",
                                              rest: rest ?? "",
                                              muscle,
                                              note: exercise.notes ?? "",
                                            },
                                          })
                                        }
                                      >
                                        <View style={styles.exerciseMain}>
                                          <View style={styles.exerciseHeader}>
                                            <View style={styles.exerciseHeaderLeft}>
                                              <Text style={styles.exerciseName}>{exercise.name}</Text>
                                              <Text style={styles.exerciseDetail}>
                                                {[detail, load].filter(Boolean).join(" · ")}
                                              </Text>
                                            </View>
                                            <View style={styles.exerciseHeaderRight}>
                                              <View style={styles.exerciseTagRow}>
                                                <View style={styles.exerciseChip}>
                                                  <Text style={styles.exerciseChipText}>{muscle}</Text>
                                                </View>
                                              </View>
                                            </View>
                                          </View>

                                          {(rest || note) ? (
                                            <View style={styles.exerciseMetaRow}>
                                              {rest ? <Text style={styles.exerciseMetaText}>{rest}</Text> : null}
                                              {rest && note ? <Text style={styles.exerciseMetaDot}>•</Text> : null}
                                              {note ? <Text style={styles.exerciseMetaText}>{note}</Text> : null}
                                            </View>
                                          ) : null}
                                        </View>
                                        <View style={styles.exerciseActions}>
                                          {exercise.id ? (
                                            <Pressable
                                              style={({ pressed }) => [styles.exerciseDeleteTap, pressed && styles.pressed]}
                                              onPress={() => {
                                                void handleDeleteExercise(exercise.id);
                                              }}
                                              disabled={deletingExerciseId === exercise.id}
                                            >
                                              <MaterialCommunityIcons
                                                name="trash-can-outline"
                                                size={18}
                                                color="#b24a3d"
                                              />
                                            </Pressable>
                                          ) : null}
                                          <MaterialCommunityIcons name="chevron-right" size={22} color="#8a9098" />
                                        </View>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No exercise data was attached to this workout yet.</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      <FloatingNav active="stats" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  container: {
    margin: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headerRow: {
    position: "relative",
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 68,
  },
  backTap: {
    position: "absolute",
    left: 0,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9dbdf",
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#2a2d34",
    fontWeight: "600",
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    fontWeight: "700",
    color: "#12151b",
    textAlign: "center",
    maxWidth: "100%",
  },
  headerSpacer: {
    position: "absolute",
    right: 0,
    width: 68,
    height: 44,
  },
  heroCard: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#0b0d12",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  heroEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  heroMeta: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#c5c9cf",
  },
  heroTime: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8f96a0",
  },
  deleteWorkoutButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4a2020",
    backgroundColor: "#171012",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteWorkoutButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#f3c5bf",
    fontWeight: "700",
  },
  section: {
    marginTop: 18,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#acb0b6",
    letterSpacing: 1,
    fontWeight: "600",
  },
  exerciseList: {
    gap: 10,
  },
  weekBlock: {
    gap: 8,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weekLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#7f8690",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  dayGroupList: {
    gap: 8,
  },
  dayGroupCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dddfe3",
    backgroundColor: "#f2f3f5",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  dayGroupLabel: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#414854",
    fontWeight: "700",
  },
  dayExerciseList: {
    gap: 8,
  },
  exerciseRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseMain: {
    flex: 1,
    gap: 8,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  exerciseHeaderLeft: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 4,
  },
  exerciseHeaderRight: {
    flexShrink: 0,
    alignItems: "flex-end",
    paddingTop: 1,
  },
  exerciseTagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  exerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
    flexShrink: 1,
  },
  exerciseDetail: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7d838c",
  },
  exerciseChip: {
    borderRadius: 999,
    backgroundColor: "#ece8df",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exerciseChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#434952",
    fontWeight: "700",
  },
  exerciseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  exerciseMetaText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
  },
  exerciseMetaDot: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#c0c4ca",
  },
  exerciseActions: {
    alignItems: "center",
    gap: 10,
    paddingLeft: 8,
  },
  exerciseDeleteTap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1ef",
    borderWidth: 1,
    borderColor: "#f0d5d0",
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    padding: 14,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7d838c",
  },
  pressed: {
    opacity: 0.92,
  },
});
