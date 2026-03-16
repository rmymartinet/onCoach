import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import {
  deleteTrainingPlan,
  getTrainingPlan,
  saveTrainingDayCompletion,
  type AiContextTrainingPlan,
  updateTrainingPlan,
} from "@/lib/ai-api";
import type { ExerciseExecutionStatus, TrainingPlanDraft } from "@/lib/ai-types";

type EditableMethod =
  | "Standard"
  | "Superset"
  | "Drop set"
  | "Rest-pause"
  | "Myo-reps"
  | "Tempo"
  | "Custom";

type ExerciseEditorState = {
  weekId: string;
  dayId: string;
  exerciseId: string;
};

type HeroEditorState = {
  title: string;
  split: string;
  summary: string;
};

const methodOptions: EditableMethod[] = [
  "Standard",
  "Superset",
  "Drop set",
  "Rest-pause",
  "Myo-reps",
  "Tempo",
  "Custom",
];

const targetAreas = ["Lower", "Push", "Pull", "Shoulders", "Arms", "Core", "Exercise"];

function formatRepRange(repMin?: number, repMax?: number) {
  if (typeof repMin === "number" && typeof repMax === "number") {
    return repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`;
  }
  if (typeof repMin === "number") return `${repMin}+`;
  if (typeof repMax === "number") return `${repMax}`;
  return "TBD";
}

function parseTargetArea(notes?: string | null) {
  const raw = notes?.trim();
  if (!raw) return null;
  const match = raw.match(/targetArea=([^;|]+)/i);
  return match?.[1]?.trim() || null;
}

function parseMethod(notes?: string | null) {
  const raw = notes?.trim();
  if (!raw) return "Standard";
  const match = raw.match(/method=([^;|]+)/i);
  return (match?.[1]?.trim() as EditableMethod) || "Standard";
}

function parseFreeformNotes(notes?: string | null) {
  const raw = notes?.trim();
  if (!raw) return "";
  if (!raw.includes("||")) return raw.replace(/(?:^|;\s*)method=[^;|]+/i, "").trim();
  return raw.split("||")[1]?.trim() ?? "";
}

function buildExerciseNotes({
  currentNotes,
  method,
  targetArea,
  freeform,
}: {
  currentNotes?: string | null;
  method: EditableMethod;
  targetArea: string;
  freeform: string;
}) {
  const raw = currentNotes?.trim() ?? "";
  const [metaPart] = raw.includes("||") ? raw.split("||") : [raw];
  const existingPairs = metaPart
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.split("=")[0]?.trim();
      return key && key !== "method" && key !== "targetArea";
    });

  const nextMeta = [`method=${method}`, `targetArea=${targetArea}`, ...existingPairs].join("; ");
  const nextFreeform = freeform.trim();
  return nextFreeform ? `${nextMeta} || ${nextFreeform}` : nextMeta;
}

function toTrainingPlanDraft(trainingPlan: AiContextTrainingPlan): TrainingPlanDraft {
  return {
    blockTitle: trainingPlan.title,
    goal: trainingPlan.goal ?? undefined,
    summary: trainingPlan.summary ?? undefined,
    split: trainingPlan.split ?? undefined,
    progressionNotes: trainingPlan.progressionNotes,
    weeks: trainingPlan.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      title: week.title,
      summary: week.summary ?? undefined,
      days: week.days.map((day) => ({
        dayLabel: day.dayLabel,
        title: day.title,
        summary: day.summary ?? undefined,
        estimatedDurationMinutes: day.estimatedDurationMinutes ?? undefined,
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          normalizedName: exercise.normalizedName ?? undefined,
          order: exercise.order,
          sets: exercise.sets,
          repMin: exercise.repMin,
          repMax: exercise.repMax,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes ?? undefined,
          warmup: exercise.warmup,
          exerciseType: exercise.exerciseType ?? undefined,
          muscleGroups: exercise.muscleGroups,
          equipment: exercise.equipment,
          substitutions: exercise.substitutions,
        })),
      })),
    })),
  };
}

function getProgramFocusAreas(trainingPlan: AiContextTrainingPlan | null) {
  if (!trainingPlan) return [];

  const counts = new Map<string, number>();
  for (const week of trainingPlan.weeks) {
    for (const day of week.days) {
      for (const exercise of day.exercises) {
        const area = parseTargetArea(exercise.notes) ?? "Exercise";
        counts.set(area, (counts.get(area) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area)
    .filter((area) => area !== "Exercise")
    .slice(0, 3);
}

function formatProgramGoal(goal?: string | null) {
  if (!goal) return "Custom";

  const normalized = goal.trim().toLowerCase();
  if (normalized === "muscle_gain") return "Build muscle";
  if (normalized === "strength") return "Get stronger";
  if (normalized === "fat_loss") return "Lose fat";
  if (normalized === "athleticism") return "Stay athletic";

  return normalized
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildExerciseStatusMap(trainingPlan: AiContextTrainingPlan | null) {
  if (!trainingPlan) return {};

  const nextMap: Record<string, ExerciseExecutionStatus | "PLANNED"> = {};
  for (const week of trainingPlan.weeks) {
    for (const day of week.days) {
      for (const exercise of day.exercises) {
        nextMap[exercise.id] = exercise.completionStatus ?? "PLANNED";
      }
    }
  }

  return nextMap;
}

function getExecutionSummary(status: ExerciseExecutionStatus | "PLANNED") {
  if (status === "DONE") {
    return {
      title: "Validated as planned",
      body: "This exercise is marked complete exactly as planned.",
    };
  }
  if (status === "ADJUSTED") {
    return {
      title: "Completed with changes",
      body: "Use this when you did the exercise but adjusted reps, sets, or rest.",
    };
  }
  if (status === "SKIPPED") {
    return {
      title: "Skipped for this session",
      body: "Use this when you intentionally skipped the exercise today.",
    };
  }
  return {
    title: "Not validated yet",
    body: "Choose whether you completed it as planned, adjusted it, or skipped it.",
  };
}

function findFocusedSession(trainingPlan: AiContextTrainingPlan | null, focusWeekId: string, focusDayId: string) {
  if (!trainingPlan || !focusWeekId || !focusDayId) return null;
  const week = trainingPlan.weeks.find((item) => item.id === focusWeekId);
  const day = week?.days.find((item) => item.id === focusDayId);
  if (!week || !day) return null;

  return {
    week,
    day,
    completedCount: day.exercises.filter((exercise) => {
      const status = exercise.completionStatus ?? "PLANNED";
      return status === "DONE" || status === "ADJUSTED";
    }).length,
  };
}

export default function ProgramDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trainingPlanId?: string; title?: string; focusWeekId?: string; focusDayId?: string }>();
  const trainingPlanId = params.trainingPlanId ?? "";
  const focusWeekId = params.focusWeekId ?? "";
  const focusDayId = params.focusDayId ?? "";
  const [trainingPlan, setTrainingPlan] = useState<AiContextTrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [activeEditor, setActiveEditor] = useState<ExerciseEditorState | null>(null);
  const [heroEditorOpen, setHeroEditorOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exerciseStatuses, setExerciseStatuses] = useState<Record<string, ExerciseExecutionStatus | "PLANNED">>({});
  const [heroEditorDraft, setHeroEditorDraft] = useState<HeroEditorState>({
    title: "",
    split: "",
    summary: "",
  });
  const completionAnimations = useRef<Record<string, Animated.Value>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProgram() {
        if (!trainingPlanId) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          const result = await getTrainingPlan(trainingPlanId);
          if (cancelled) return;
          setTrainingPlan(result.trainingPlan);
          setExerciseStatuses(buildExerciseStatusMap(result.trainingPlan));
          if (focusWeekId) {
            setOpenWeeks({ [focusWeekId]: true });
          }
          if (focusWeekId && focusDayId) {
            setOpenDays({ [`${focusWeekId}-${focusDayId}`]: true });
          }
          setError(null);
        } catch (nextError) {
          if (!cancelled) {
            setError(nextError instanceof Error ? nextError.message : "Failed to load program");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      void loadProgram();

      return () => {
        cancelled = true;
      };
    }, [trainingPlanId]),
  );

  const heroTitle = trainingPlan?.title ?? params.title ?? "Program";
  const heroSummary = trainingPlan?.summary ?? "Structured plan built with AI.";
  const heroMeta = useMemo(() => {
    if (!trainingPlan) return "Program";
    const weekCount = trainingPlan.weeks.length;
    const dayCount = trainingPlan.weeks.reduce((sum, week) => sum + week.days.length, 0);
    return `${weekCount} weeks · ${dayCount} days`;
  }, [trainingPlan]);
  const activeExercise = useMemo(() => {
    if (!trainingPlan || !activeEditor) return null;
    const week = trainingPlan.weeks.find((item) => item.id === activeEditor.weekId);
    const day = week?.days.find((item) => item.id === activeEditor.dayId);
    const exercise = day?.exercises.find((item) => item.id === activeEditor.exerciseId);
    return exercise ?? null;
  }, [activeEditor, trainingPlan]);
  const snapshotItems = useMemo(() => {
    if (!trainingPlan) return [];
    const focusAreas = getProgramFocusAreas(trainingPlan);
    const daysPerWeek = Math.max(...trainingPlan.weeks.map((week) => week.days.length));

    return [
      { label: "Goal", value: formatProgramGoal(trainingPlan.goal) },
      { label: "Split", value: trainingPlan.split ?? "Flexible" },
      { label: "Length", value: `${trainingPlan.weeks.length} ${trainingPlan.weeks.length === 1 ? "week" : "weeks"}` },
      { label: "Rhythm", value: `${daysPerWeek} ${daysPerWeek === 1 ? "day" : "days"} / week` },
      { label: "Focus", value: focusAreas.length ? focusAreas.join(" / ") : "Balanced" },
      { label: "Status", value: "Active" },
    ];
  }, [trainingPlan]);
  const focusedSession = useMemo(
    () => findFocusedSession(trainingPlan, focusWeekId, focusDayId),
    [trainingPlan, focusWeekId, focusDayId],
  );

  function patchExercise(
    ids: ExerciseEditorState,
    patch: Partial<AiContextTrainingPlan["weeks"][number]["days"][number]["exercises"][number]>,
  ) {
    setTrainingPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        weeks: current.weeks.map((week) =>
          week.id !== ids.weekId
            ? week
            : {
                ...week,
                days: week.days.map((day) =>
                  day.id !== ids.dayId
                    ? day
                    : {
                        ...day,
                        exercises: day.exercises.map((exercise) =>
                          exercise.id !== ids.exerciseId ? exercise : { ...exercise, ...patch },
                        ),
                      },
                ),
              },
        ),
      };
    });
  }

  async function handleSavePlanEdits() {
    if (!trainingPlan) return;
    setSaving(true);
    setError(null);
    try {
      await updateTrainingPlan({
        trainingPlanId,
        trainingPlan: toTrainingPlanDraft(trainingPlan),
      });
      setActiveEditor(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveHeroEdits() {
    if (!trainingPlan) return;
    setSaving(true);
    setError(null);
    try {
      const nextPlan: AiContextTrainingPlan = {
        ...trainingPlan,
        title: heroEditorDraft.title.trim() || trainingPlan.title,
        split: heroEditorDraft.split.trim() || null,
        summary: heroEditorDraft.summary.trim() || null,
      };

      await updateTrainingPlan({
        trainingPlanId,
        trainingPlan: toTrainingPlanDraft(nextPlan),
      });

      setTrainingPlan(nextPlan);
      setHeroEditorOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save program");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProgram() {
    if (!trainingPlanId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTrainingPlan(trainingPlanId);
      setDeleteConfirmOpen(false);
      router.replace("/home");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete program");
    } finally {
      setSaving(false);
    }
  }

  function getCompletionScale(exerciseId: string) {
    if (!completionAnimations.current[exerciseId]) {
      completionAnimations.current[exerciseId] = new Animated.Value(1);
    }

    return completionAnimations.current[exerciseId];
  }

  function animateExerciseStatus(exerciseId: string, nextStatus: ExerciseExecutionStatus | "PLANNED") {
    const scale = getCompletionScale(exerciseId);

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.82,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 18,
        bounciness: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function getExerciseStatus(exerciseId: string, fallback?: ExerciseExecutionStatus | null) {
    return exerciseStatuses[exerciseId] ?? fallback ?? "PLANNED";
  }

  function getBadgeLabel(status: ExerciseExecutionStatus | "PLANNED") {
    if (status === "DONE") return "Done";
    if (status === "ADJUSTED") return "Adjusted";
    if (status === "SKIPPED") return "Skipped";
    return "To validate";
  }

  function getDayCompletionStatus(statuses: Array<ExerciseExecutionStatus | "PLANNED">) {
    if (statuses.every((status) => status === "PLANNED")) return "PLANNED" as const;
    if (statuses.every((status) => status === "SKIPPED")) return "SKIPPED" as const;
    if (statuses.some((status) => status === "PLANNED")) return "IN_PROGRESS" as const;
    if (statuses.some((status) => status === "ADJUSTED" || status === "SKIPPED")) return "ADJUSTED" as const;
    return "COMPLETED" as const;
  }

  async function handleSetExerciseStatus(nextStatus: ExerciseExecutionStatus | "PLANNED") {
    if (!trainingPlan || !activeEditor || !activeExercise) return;

    const week = trainingPlan.weeks.find((item) => item.id === activeEditor.weekId);
    const day = week?.days.find((item) => item.id === activeEditor.dayId);
    if (!day) return;

    const previousStatus = getExerciseStatus(activeExercise.id, activeExercise.completionStatus);
    const nextStatusMap = {
      ...exerciseStatuses,
      [activeExercise.id]: nextStatus,
    };

    setExerciseStatuses(nextStatusMap);
    animateExerciseStatus(activeExercise.id, nextStatus);
    setSaving(true);
    setError(null);

    try {
      const statuses = day.exercises.map((exercise) => {
        const status = nextStatusMap[exercise.id] ?? exercise.completionStatus ?? "PLANNED";
        const includesPerformedData = status === "DONE" || status === "ADJUSTED";
        return {
          plannedExerciseId: exercise.id,
          order: exercise.order,
          name: exercise.name,
          status,
          completedSets: includesPerformedData ? exercise.sets : undefined,
          completedRepMin: includesPerformedData ? exercise.repMin : undefined,
          completedRepMax: includesPerformedData ? exercise.repMax : undefined,
          completedRestSeconds: includesPerformedData ? exercise.restSeconds : undefined,
          notes: exercise.completionNotes ?? undefined,
        };
      });

      const nextDayStatus = getDayCompletionStatus(statuses.map((exercise) => exercise.status));

      await saveTrainingDayCompletion({
        trainingPlanId,
        completion: {
          planId: trainingPlanId,
          dayId: day.id,
          status: nextDayStatus,
          completedAt: new Date().toISOString(),
          exercises: statuses,
        },
      });

      setTrainingPlan((current) => {
        if (!current) return current;
        return {
          ...current,
          weeks: current.weeks.map((currentWeek) =>
            currentWeek.id !== week?.id
              ? currentWeek
              : {
                  ...currentWeek,
                  days: currentWeek.days.map((currentDay) =>
                    currentDay.id !== day.id
                      ? currentDay
                      : {
                          ...currentDay,
                          completionStatus: nextDayStatus,
                          completedAt: new Date().toISOString(),
                          exercises: currentDay.exercises.map((exercise) => {
                            const status = nextStatusMap[exercise.id] ?? exercise.completionStatus ?? "PLANNED";
                            const includesPerformedData = status === "DONE" || status === "ADJUSTED";
                            return {
                              ...exercise,
                              completionStatus: status === "PLANNED" ? null : status,
                              completedSets: includesPerformedData ? exercise.sets : null,
                              completedRepMin: includesPerformedData ? exercise.repMin : null,
                              completedRepMax: includesPerformedData ? exercise.repMax : null,
                              completedRestSeconds: includesPerformedData ? exercise.restSeconds : null,
                            };
                          }),
                        },
                  ),
                },
          ),
        };
      });
    } catch (nextError) {
      setExerciseStatuses((current) => ({
        ...current,
        [activeExercise.id]: previousStatus,
      }));
      setError(nextError instanceof Error ? nextError.message : "Failed to save validation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable style={({ pressed }) => [styles.backTap, pressed && styles.pressed]} onPress={() => router.back()}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.title}>Program detail</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>{trainingPlan?.split ?? "Program"}</Text>
              {trainingPlan ? (
                <View style={styles.heroActions}>
                  <Pressable
                    style={({ pressed }) => [styles.heroDeleteButton, pressed && styles.pressed]}
                    onPress={() => setDeleteConfirmOpen(true)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ffb6b6" />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.heroEditButton, pressed && styles.pressed]}
                    onPress={() => {
                      setHeroEditorDraft({
                        title: trainingPlan.title ?? "",
                        split: trainingPlan.split ?? "",
                        summary: trainingPlan.summary ?? "",
                      });
                      setHeroEditorOpen(true);
                    }}
                  >
                    <Text style={styles.heroEditButtonText}>Edit</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSummary}>{heroSummary}</Text>
            <Text style={styles.heroMeta}>{heroMeta}</Text>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() =>
                router.push({
                  pathname: "/ai-workspace",
                  params: {
                    mode: "generate_from_scratch",
                    trainingPlanId,
                    title: heroTitle,
                  },
                })
              }
            >
              <Text style={styles.primaryButtonText}>Talk to coach</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.inlineErrorCard}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          {focusedSession ? (
            <View style={styles.sessionFocusCard}>
              <View style={styles.sessionFocusTop}>
                <View>
                  <Text style={styles.sessionFocusEyebrow}>CURRENT SESSION</Text>
                  <Text style={styles.sessionFocusTitle}>
                    {focusedSession.day.dayLabel} · {focusedSession.day.title}
                  </Text>
                  <Text style={styles.sessionFocusMeta}>
                    {focusedSession.week.title} · {focusedSession.completedCount}/{focusedSession.day.exercises.length} exercises validated
                  </Text>
                </View>
                <View style={styles.sessionFocusBadge}>
                  <Text style={styles.sessionFocusBadgeText}>
                    {focusedSession.day.completionStatus === "IN_PROGRESS" ? "In progress" : "Ready"}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {trainingPlan ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PROGRAM SNAPSHOT</Text>
                <View style={styles.snapshotCard}>
                  <View style={styles.snapshotGrid}>
                    {snapshotItems.map((item) => (
                      <View key={item.label} style={styles.snapshotItem}>
                        <Text style={styles.snapshotLabel}>{item.label}</Text>
                        <Text style={styles.snapshotValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

            </>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WEEKS</Text>
            {loading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color="#1b1f26" />
              </View>
            ) : trainingPlan ? (
              <View style={styles.weekList}>
                {trainingPlan.weeks.map((week, weekIndex) => {
                  const weekOpen =
                    Object.prototype.hasOwnProperty.call(openWeeks, week.id) ? openWeeks[week.id] : weekIndex === 0;

                  return (
                    <View key={week.id} style={styles.weekCard}>
                      <Pressable
                        style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
                        onPress={() =>
                          setOpenWeeks((current) => ({
                            ...current,
                            [week.id]: !weekOpen,
                          }))
                        }
                      >
                        <View style={styles.groupCopy}>
                          <Text style={styles.groupTitle}>Week {week.weekNumber}</Text>
                          <Text style={styles.groupBody}>{week.summary ?? week.title}</Text>
                        </View>
                        <MaterialCommunityIcons
                          name={weekOpen ? "chevron-up" : "chevron-down"}
                          size={20}
                          color="#8a9098"
                        />
                      </Pressable>

                      {weekOpen ? (
                        <View style={styles.dayList}>
                          {week.days.map((day, dayIndex) => {
                            const dayKey = `${week.id}-${day.id}`;
                            const dayOpen =
                              Object.prototype.hasOwnProperty.call(openDays, dayKey)
                                ? openDays[dayKey]
                                : dayIndex === 0;

                            return (
                              <View
                                key={day.id}
                                style={[styles.dayCard, focusWeekId === week.id && focusDayId === day.id && styles.dayCardFocused]}
                              >
                                <Pressable
                                  style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
                                  onPress={() =>
                                    setOpenDays((current) => ({
                                      ...current,
                                      [dayKey]: !dayOpen,
                                    }))
                                  }
                                >
                                  <View style={styles.groupCopy}>
                                    <Text style={styles.dayTitle}>
                                      {day.dayLabel} · {day.title}
                                    </Text>
                                    <Text style={styles.groupBody}>
                                      {day.summary ?? `${day.exercises.length} exercises`}
                                    </Text>
                                  </View>
                                  <MaterialCommunityIcons
                                    name={dayOpen ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#8a9098"
                                  />
                                </Pressable>

                                {dayOpen ? (
                                  <View style={styles.exerciseList}>
                                    {day.exercises.map((exercise) => {
                                      const exerciseStatus = getExerciseStatus(exercise.id, exercise.completionStatus);
                                      return (
                                        <Pressable
                                          key={exercise.id}
                                          style={({ pressed }) => [styles.exerciseCard, pressed && styles.pressed]}
                                          onPress={() =>
                                            setActiveEditor({
                                              weekId: week.id,
                                              dayId: day.id,
                                              exerciseId: exercise.id,
                                            })
                                          }
                                        >
                                          <View style={styles.exerciseHeader}>
                                            <View style={styles.exerciseCopy}>
                                              <Text style={styles.exerciseName}>{exercise.name}</Text>
                                              <Text style={styles.exerciseMeta}>
                                                {exercise.sets} x {formatRepRange(exercise.repMin, exercise.repMax)} · rest {exercise.restSeconds}s
                                              </Text>
                                            </View>
                                            <View style={styles.exerciseSide}>
                                              {parseTargetArea(exercise.notes) ? (
                                                <View style={styles.exerciseChip}>
                                                  <Text style={styles.exerciseChipText}>{parseTargetArea(exercise.notes)}</Text>
                                                </View>
                                              ) : null}
                                              <View
                                                style={[
                                                  styles.statusBadge,
                                                  exerciseStatus === "DONE"
                                                    ? styles.statusBadgeDone
                                                    : exerciseStatus === "ADJUSTED"
                                                      ? styles.statusBadgeAdjusted
                                                      : exerciseStatus === "SKIPPED"
                                                        ? styles.statusBadgeSkipped
                                                        : styles.statusBadgePending,
                                                ]}
                                              >
                                                <Text
                                                  style={[
                                                    styles.statusBadgeText,
                                                    exerciseStatus === "DONE"
                                                      ? styles.statusBadgeTextDone
                                                      : exerciseStatus === "ADJUSTED"
                                                        ? styles.statusBadgeTextAdjusted
                                                        : exerciseStatus === "SKIPPED"
                                                          ? styles.statusBadgeTextSkipped
                                                          : styles.statusBadgeTextPending,
                                                  ]}
                                                >
                                                  {getBadgeLabel(exerciseStatus)}
                                                </Text>
                                              </View>
                                            </View>
                                          </View>
                                          <Text style={styles.exerciseTapHint}>
                                            {exerciseStatus === "PLANNED" ? "Tap to edit" : "Validated · tap to review"}
                                          </Text>
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
                  );
                })}
              </View>
            ) : (
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>{error ?? "No program found."}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {trainingPlan && activeExercise && activeEditor ? (
        <View style={styles.editorOverlay}>
          <View style={styles.editorShell}>
            <View style={styles.editorHeader}>
              <Pressable style={styles.editorBack} onPress={() => setActiveEditor(null)}>
                <Text style={styles.editorBackText}>←</Text>
              </Pressable>
              <Text style={styles.editorHeaderTitle}>Edit exercise</Text>
              <Pressable
                style={[styles.editorSave, saving && styles.editorSaveDisabled]}
                onPress={() => void handleSavePlanEdits()}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#f6f7f9" /> : <Text style={styles.editorSaveText}>Save</Text>}
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Name</Text>
                <TextInput
                  value={activeExercise.name}
                  onChangeText={(value) => patchExercise(activeEditor, { name: value })}
                  style={styles.editorInput}
                  placeholder="Exercise name"
                  placeholderTextColor="#9ea3ac"
                />
              </View>

              <View style={styles.metricGrid}>
                <EditorMetric
                  label="Sets"
                  value={activeExercise.sets}
                  onChange={(value) => patchExercise(activeEditor, { sets: value ?? 0 })}
                />
                <EditorMetric
                  label="Reps"
                  value={activeExercise.repMin}
                  onChange={(value) =>
                    patchExercise(activeEditor, {
                      repMin: value ?? 0,
                      repMax: value ?? 0,
                    })
                  }
                />
                <EditorMetric
                  label="Rest"
                  value={activeExercise.restSeconds}
                  onChange={(value) => patchExercise(activeEditor, { restSeconds: value ?? 0 })}
                />
              </View>

              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Method</Text>
                <View style={styles.chipRow}>
                  {methodOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.chip, parseMethod(activeExercise.notes) === option && styles.chipActive]}
                      onPress={() =>
                        patchExercise(activeEditor, {
                          notes: buildExerciseNotes({
                            currentNotes: activeExercise.notes,
                            method: option,
                            targetArea: parseTargetArea(activeExercise.notes) ?? "Exercise",
                            freeform: parseFreeformNotes(activeExercise.notes),
                          }),
                        })
                      }
                    >
                      <Text style={[styles.chipText, parseMethod(activeExercise.notes) === option && styles.chipTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Target area</Text>
                <View style={styles.chipRow}>
                  {targetAreas.map((area) => (
                    <Pressable
                      key={area}
                      style={[styles.chip, (parseTargetArea(activeExercise.notes) ?? "Exercise") === area && styles.chipActive]}
                      onPress={() =>
                        patchExercise(activeEditor, {
                          notes: buildExerciseNotes({
                            currentNotes: activeExercise.notes,
                            method: parseMethod(activeExercise.notes),
                            targetArea: area,
                            freeform: parseFreeformNotes(activeExercise.notes),
                          }),
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          (parseTargetArea(activeExercise.notes) ?? "Exercise") === area && styles.chipTextActive,
                        ]}
                      >
                        {area}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Notes</Text>
                <TextInput
                  multiline
                  value={parseFreeformNotes(activeExercise.notes)}
                  onChangeText={(value) =>
                    patchExercise(activeEditor, {
                      notes: buildExerciseNotes({
                        currentNotes: activeExercise.notes,
                        method: parseMethod(activeExercise.notes),
                        targetArea: parseTargetArea(activeExercise.notes) ?? "Exercise",
                        freeform: value,
                      }),
                    })
                  }
                  style={[styles.editorInput, styles.editorTextarea]}
                  placeholder="Extra cues or notes"
                  placeholderTextColor="#9ea3ac"
                />
              </View>

              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Validation</Text>
                {(() => {
                  const activeStatus = getExerciseStatus(activeExercise.id, activeExercise.completionStatus);
                  const executionSummary = getExecutionSummary(activeStatus);
                  return (
                    <>
                      <View style={styles.validationOptions}>
                        {[
                          { status: "DONE" as const, label: "Done", icon: "check" as const },
                          { status: "ADJUSTED" as const, label: "Adjusted", icon: "tune-variant" as const },
                          { status: "SKIPPED" as const, label: "Skipped", icon: "skip-next" as const },
                        ].map((option) => (
                          <Pressable
                            key={option.status}
                            style={[
                              styles.validationOption,
                              activeStatus === option.status && styles.validationOptionActive,
                            ]}
                            onPress={() => void handleSetExerciseStatus(option.status)}
                          >
                            <Animated.View
                              style={[
                                styles.validationIconWrap,
                                activeStatus === option.status && styles.validationIconWrapActive,
                                { transform: [{ scale: getCompletionScale(activeExercise.id) }] },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name={option.icon}
                                size={17}
                                color={activeStatus === option.status ? "#ffffff" : "#a1a8b1"}
                              />
                            </Animated.View>
                            <Text
                              style={[
                                styles.validationOptionText,
                                activeStatus === option.status && styles.validationOptionTextActive,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={[styles.validationAction, activeStatus !== "PLANNED" && styles.validationActionActive]}>
                        <View style={styles.validationCopy}>
                          <Text style={styles.validationTitle}>{executionSummary.title}</Text>
                          <Text style={styles.validationBody}>{executionSummary.body}</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
      {trainingPlan && heroEditorOpen ? (
        <View style={styles.editorOverlay}>
          <View style={styles.editorShell}>
            <View style={styles.editorHeader}>
              <Pressable style={styles.editorBack} onPress={() => setHeroEditorOpen(false)}>
                <Text style={styles.editorBackText}>←</Text>
              </Pressable>
              <Text style={styles.editorHeaderTitle}>Edit program</Text>
              <Pressable
                style={[styles.editorSave, saving && styles.editorSaveDisabled]}
                onPress={() => void handleSaveHeroEdits()}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#f6f7f9" /> : <Text style={styles.editorSaveText}>Save</Text>}
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Title</Text>
                <TextInput
                  value={heroEditorDraft.title}
                  onChangeText={(value) => setHeroEditorDraft((current) => ({ ...current, title: value }))}
                  style={styles.editorInput}
                  placeholder="Program title"
                  placeholderTextColor="#9ea3ac"
                />
              </View>

              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Split</Text>
                <TextInput
                  value={heroEditorDraft.split}
                  onChangeText={(value) => setHeroEditorDraft((current) => ({ ...current, split: value }))}
                  style={styles.editorInput}
                  placeholder="Upper / Lower"
                  placeholderTextColor="#9ea3ac"
                />
              </View>

              <View style={styles.editorField}>
                <Text style={styles.editorLabel}>Summary</Text>
                <TextInput
                  multiline
                  value={heroEditorDraft.summary}
                  onChangeText={(value) => setHeroEditorDraft((current) => ({ ...current, summary: value }))}
                  style={[styles.editorInput, styles.editorTextarea]}
                  placeholder="Short program summary"
                  placeholderTextColor="#9ea3ac"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
      {trainingPlan && deleteConfirmOpen ? (
        <View style={styles.editorOverlay}>
          <View style={styles.confirmShell}>
            <Text style={styles.confirmTitle}>Delete this program?</Text>
            <Text style={styles.confirmBody}>
              This removes the full program with all its weeks, days, and exercises.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={({ pressed }) => [styles.confirmSecondaryButton, pressed && styles.pressed]}
                onPress={() => setDeleteConfirmOpen(false)}
                disabled={saving}
              >
                <Text style={styles.confirmSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmDangerButton,
                  pressed && styles.pressed,
                  saving && styles.editorSaveDisabled,
                ]}
                onPress={() => void handleDeleteProgram()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff6f6" />
                ) : (
                  <Text style={styles.confirmDangerText}>Delete program</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      <FloatingNav active="home" />
    </SafeAreaView>
  );
}

function EditorMetric({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number | null;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.editorLabel}>{label}</Text>
      <TextInput
        value={typeof value === "number" ? `${value}` : ""}
        onChangeText={(nextValue) => {
          const parsed = Number(nextValue.replace(",", ".").trim());
          if (!nextValue.trim()) {
            onChange(undefined);
            return;
          }
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
        keyboardType="decimal-pad"
        style={styles.metricInput}
        placeholder="0"
        placeholderTextColor="#9ea3ac"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 120,
  },
  container: {
    borderRadius: 24,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 18,
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
  },
  headerSpacer: {
    position: "absolute",
    right: 0,
    width: 68,
    height: 44,
  },
  heroCard: {
    borderRadius: 20,
    backgroundColor: "#0b0d12",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  heroSummary: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#c9ced6",
  },
  heroMeta: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#9ea3ac",
  },
  heroEditButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a313d",
    backgroundColor: "#181d25",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroDeleteButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#46252b",
    backgroundColor: "#251419",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEditButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#edf2f8",
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#f5f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#12151b",
    fontWeight: "700",
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9aa0a8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  noteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e2e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  inlineErrorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#efc2c2",
    backgroundColor: "#fff5f5",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineErrorText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#b24646",
    fontWeight: "700",
  },
  sessionFocusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d6d9df",
    backgroundColor: "#13171f",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  sessionFocusTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionFocusEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#98a0aa",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sessionFocusTitle: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.title,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  sessionFocusMeta: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#aeb5be",
  },
  sessionFocusBadge: {
    borderRadius: 999,
    backgroundColor: "#eef4ff",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sessionFocusBadgeText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#315fc5",
    fontWeight: "700",
  },
  snapshotCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e2e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  snapshotItem: {
    minWidth: 140,
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#1a2029",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  snapshotLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8fa1bd",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  snapshotValue: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#edf2f8",
    fontWeight: "700",
  },
  phaseRow: {
    gap: 8,
  },
  noteText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#5f6670",
    lineHeight: 20,
  },
  loadingCard: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e2e6",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  weekList: {
    gap: 10,
  },
  weekCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e2e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  groupCopy: {
    flex: 1,
    gap: 3,
  },
  groupTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  groupBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7a8088",
  },
  dayList: {
    gap: 10,
  },
  dayCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fcfbf7",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  dayCardFocused: {
    borderColor: "#c7d5ff",
    backgroundColor: "#f6f8ff",
  },
  dayTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  exerciseList: {
    gap: 8,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  exerciseTapHint: {
    marginTop: 8,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9aa0a8",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseSide: {
    alignItems: "flex-end",
    gap: 8,
  },
  exerciseCopy: {
    flex: 1,
    gap: 3,
  },
  exerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  exerciseMeta: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6b717a",
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
    color: "#3d434c",
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgePending: {
    backgroundColor: "#f1f2f4",
  },
  statusBadgeDone: {
    backgroundColor: "#eaf7ee",
  },
  statusBadgeAdjusted: {
    backgroundColor: "#eef3ff",
  },
  statusBadgeSkipped: {
    backgroundColor: "#fff1ec",
  },
  statusBadgeText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    fontWeight: "700",
  },
  statusBadgeTextPending: {
    color: "#6f7680",
  },
  statusBadgeTextDone: {
    color: "#2f8c57",
  },
  statusBadgeTextAdjusted: {
    color: "#476cc7",
  },
  statusBadgeTextSkipped: {
    color: "#c26a3a",
  },
  editorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 16, 0.24)",
    justifyContent: "flex-end",
    zIndex: 200,
    elevation: 20,
  },
  editorShell: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#f8f8f6",
    borderWidth: 1,
    borderColor: "#e6e3db",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    zIndex: 201,
    elevation: 21,
  },
  confirmShell: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#f8f8f6",
    borderWidth: 1,
    borderColor: "#e6e3db",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
    zIndex: 201,
    elevation: 21,
  },
  confirmTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#141821",
    fontWeight: "700",
  },
  confirmBody: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#6c727b",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddfe4",
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSecondaryText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#20242b",
    fontWeight: "700",
  },
  confirmDangerButton: {
    flex: 1.25,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#ca4b4b",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDangerText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#fff7f7",
    fontWeight: "700",
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  editorBack: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8dbe0",
    backgroundColor: "#f2f3f5",
    alignItems: "center",
    justifyContent: "center",
  },
  editorBackText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#20242b",
    fontWeight: "700",
  },
  editorHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#11141a",
    fontWeight: "700",
  },
  editorSave: {
    minWidth: 68,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#12151b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  editorSaveDisabled: {
    opacity: 0.7,
  },
  editorSaveText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#f7f8fa",
    fontWeight: "700",
  },
  editorContent: {
    gap: 14,
    paddingTop: 16,
  },
  editorField: {
    gap: 8,
  },
  editorLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8a9098",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
  },
  editorInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dedad1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#1a1e25",
  },
  editorTextarea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    minWidth: 120,
    flex: 1,
    gap: 8,
  },
  metricInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dedad1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#1a1e25",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d4cb",
    backgroundColor: "#f7f5f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: "#12151b",
    backgroundColor: "#12151b",
  },
  chipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#666d76",
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#f7f8fa",
  },
  validationAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dedad1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  validationActionActive: {
    borderColor: "#9ed7b3",
    backgroundColor: "#f1faf4",
  },
  validationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  validationOption: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9ddd4",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validationOptionActive: {
    borderColor: "#12151b",
    backgroundColor: "#12151b",
  },
  validationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#d4d9df",
    backgroundColor: "#f3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  validationIconWrapActive: {
    borderColor: "#33a163",
    backgroundColor: "#33a163",
  },
  validationOptionText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5c646d",
    fontWeight: "700",
  },
  validationOptionTextActive: {
    color: "#f6f7fa",
  },
  validationCopy: {
    flex: 1,
    gap: 3,
  },
  validationTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#141821",
    fontWeight: "700",
  },
  validationBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6f7680",
  },
  pressed: {
    opacity: 0.9,
  },
});
