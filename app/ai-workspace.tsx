import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import type {
  AiWorkspaceClarificationDecision,
  NextTrainingDayDraft,
  ParsedWorkout,
  ParsedWorkoutCollection,
  ParsedWorkoutExercise,
  TrainingPlanDraft,
} from "@/lib/ai-types";
import {
  analyzeAiWorkspace,
  appendTrainingPlanDay,
  type AiContextTrainingPlan,
  generateNextTrainingDay,
  generateTrainingPlan,
  getTrainingPlan,
  getAiContext,
  parseNoteDirect,
  parseWorkoutNote,
  saveParsedWorkout,
  toAiUserProfile,
  updateTrainingPlan,
} from "@/lib/ai-api";

type WorkspaceMode = "import_note" | "paste_workout" | "generate_from_scratch";
type ExerciseMethod =
  | "Standard"
  | "Superset"
  | "Drop set"
  | "Rest-pause"
  | "Myo-reps"
  | "Tempo"
  | "Custom";
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  kind?: "text" | "result";
};
type TimelineField = "day" | "week" | "month";

type MethodDraft = {
  method: ExerciseMethod;
  targetArea: string;
  repMode: "standard" | "failure";
  freeform: string;
  timelineDate: string;
  timelineWeek: string;
  timelineMonth: string;
  pairName: string;
  pairReps: string;
  pairWeight: string;
  dropWeights: string;
  restPauseSeconds: string;
  restPauseMiniSets: string;
  myoActivationReps: string;
  myoMiniReps: string;
  myoRounds: string;
  myoRestSeconds: string;
  tempoEccentric: string;
  tempoStretch: string;
  tempoConcentric: string;
  tempoTop: string;
  customName: string;
  customInstructions: string;
};

const exerciseMethods: ExerciseMethod[] = [
  "Standard",
  "Superset",
  "Drop set",
  "Rest-pause",
  "Myo-reps",
  "Tempo",
  "Custom",
];

export default function AiWorkspaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; trainingPlanId?: string; title?: string }>();
  const linkedTrainingPlanId = params.trainingPlanId ?? null;
  const [selectedMode, setSelectedMode] = useState<WorkspaceMode | null>(() =>
    normalizeMode(params.mode),
  );
  const scrollRef = useRef<ScrollView | null>(null);

  const [sourceText] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userProfile, setUserProfile] = useState<unknown>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<unknown[]>([]);
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [parsedCollection, setParsedCollection] = useState<ParsedWorkoutCollection | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanDraft | null>(null);
  const [trainingPlanId, setTrainingPlanId] = useState<string | null>(null);
  const [trainingPlanContext, setTrainingPlanContext] = useState<AiContextTrainingPlan | null>(null);
  const [nextTrainingDay, setNextTrainingDay] = useState<NextTrainingDayDraft | null>(null);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [timelinePicker, setTimelinePicker] = useState<{
    exerciseIndex: number;
    field: TimelineField;
  } | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null);
  const [selectedScheduleExerciseIndices, setSelectedScheduleExerciseIndices] = useState<number[]>([]);
  const [activePlanWeekIndex, setActivePlanWeekIndex] = useState<number | null>(null);
  const [activePlanDayIndex, setActivePlanDayIndex] = useState<number | null>(null);
  const [activePlanExerciseIndex, setActivePlanExerciseIndex] = useState<number | null>(null);
  const [showSaveTitlePrompt, setShowSaveTitlePrompt] = useState(false);
  const [saveTitleDraft, setSaveTitleDraft] = useState("");
  const [clarificationRound, setClarificationRound] = useState(0);
  const [loadingAction, setLoadingAction] = useState<"bootstrap" | "run" | "save" | null>("bootstrap");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const result = await getAiContext();
        if (cancelled) return;

        setUserProfile(toAiUserProfile(result.user));
        setRecentWorkouts(result.recentWorkouts);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoadingAction(null);
        }
      }
    }

    loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextMode = normalizeMode(params.mode);
    if (nextMode) {
      setSelectedMode(nextMode);
    }
  }, [params.mode]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrainingPlanContext() {
      if (!linkedTrainingPlanId) {
        setTrainingPlanContext(null);
        return;
      }

      try {
        const result = await getTrainingPlan(linkedTrainingPlanId);
        if (cancelled) return;
        setTrainingPlanContext(result.trainingPlan);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load program context");
        }
      }
    }

    void loadTrainingPlanContext();

    return () => {
      cancelled = true;
    };
  }, [linkedTrainingPlanId]);

  function resetGeneratedState() {
    setError(null);
    setParsedWorkout(null);
    setParsedCollection(null);
    setTrainingPlan(null);
    setTrainingPlanId(null);
    setNextTrainingDay(null);
    setSavedWorkoutId(null);
    setTimelinePicker(null);
    setActiveExerciseIndex(null);
    setSelectedScheduleExerciseIndices([]);
    setActivePlanWeekIndex(null);
    setActivePlanDayIndex(null);
    setActivePlanExerciseIndex(null);
    setClarificationRound(0);
  }

  useEffect(() => {
    if (!selectedMode) {
      setMessages([]);
      return;
    }

    setMessages([]);
  }, [selectedMode, trainingPlanContext]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  const conversationContext = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.text.trim())
        .filter(Boolean),
    [messages],
  );

  const effectiveSourceText = useMemo(() => {
    if (sourceText.trim()) {
      return sourceText.trim();
    }

    if (selectedMode === "generate_from_scratch") {
      return "";
    }

    return conversationContext[0] ?? "";
  }, [conversationContext, selectedMode, sourceText]);

  const effectiveExtraContext = useMemo(() => {
    if (sourceText.trim() || selectedMode === "generate_from_scratch") {
      return conversationContext;
    }

    return conversationContext.slice(1);
  }, [conversationContext, selectedMode, sourceText]);

  const combinedInput = useMemo(() => {
    const base = effectiveSourceText;
    const context = effectiveExtraContext.join("\n- ");

    if (!context) return base;
    if (!base) return `Additional context from the user:\n- ${context}`;

    return `${base}\n\nAdditional context from the user:\n- ${context}`;
  }, [effectiveExtraContext, effectiveSourceText]);

  async function handleRun() {
    if (!selectedMode) return;

    setError(null);
    setParsedWorkout(null);
    setParsedCollection(null);
    setNextTrainingDay(null);
    setSavedWorkoutId(null);
    setTimelinePicker(null);
    setActiveExerciseIndex(null);
    setSelectedScheduleExerciseIndices([]);
    setActivePlanWeekIndex(null);
    setActivePlanDayIndex(null);
    setActivePlanExerciseIndex(null);
    const draftContext = extraContext.trim();
    const nextMessages =
      draftContext.length > 0
        ? [
            ...messages,
            {
              id: `user-${Date.now()}`,
              role: "user" as const,
              text: draftContext,
            },
          ]
        : messages;
    const nextUserContext = nextMessages
      .filter((message) => message.role === "user")
      .map((message) => message.text.trim())
      .filter(Boolean);
    const nextSourceText =
      sourceText.trim() ||
      (selectedMode !== "generate_from_scratch" ? nextUserContext[0] ?? "" : "");
    const nextExtraContext =
      sourceText.trim() || selectedMode === "generate_from_scratch"
        ? nextUserContext
        : nextUserContext.slice(1);
    const nextCombinedInput = buildCombinedInput(nextSourceText, nextExtraContext);

    if (draftContext.length > 0) {
      setMessages(nextMessages);
    }
    setExtraContext("");
    setLoadingAction("run");

    try {
      let decision: AiWorkspaceClarificationDecision | null = null;
      try {
        const analysis = await analyzeAiWorkspace({
          mode: selectedMode,
          sourceText: nextSourceText,
          messages: nextMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
          userProfile,
          recentWorkouts,
          trainingPlan: trainingPlan ?? trainingPlanContext ?? undefined,
          clarificationRound,
        });
        decision = analysis.decision as AiWorkspaceClarificationDecision;
      } catch {
        decision = null;
      }

      if (decision?.type === "clarify") {
        const questionBlock = (decision.questions ?? []).length
          ? `\n\n${decision.questions!.map((question, index) => `${index + 1}. ${question}`).join("\n")}`
          : "";

        setMessages((current) => [
          ...current,
          {
            id: `assistant-clarify-${Date.now()}`,
            role: "assistant",
            text: `${decision.assistantMessage}${questionBlock}`,
          },
        ]);
        setClarificationRound((current) => current + 1);
        return;
      }

      if (selectedMode === "import_note") {
        if (!nextSourceText.trim()) {
          throw new Error("Paste the note you want me to organize first.");
        }

        const result = await parseNoteDirect(nextCombinedInput);
        setParsedCollection(result.parsedCollection);
        setMessages((current) => [
          ...current.filter((message) => message.kind !== "result"),
          {
            id: `assistant-result-${Date.now()}`,
            role: "assistant",
            text: "I organized the note into a cleaner structure. Review it below, then keep chatting if something still needs to change.",
          },
          {
            id: `result-${Date.now()}`,
            role: "assistant",
            text: "",
            kind: "result",
          },
        ]);
        setClarificationRound(0);
      } else if (selectedMode === "paste_workout") {
        if (!nextSourceText.trim()) {
          throw new Error("Paste the workout you want me to clean up first.");
        }

        const result = await parseWorkoutNote(nextCombinedInput);
        const parsed = result.parsedWorkout as ParsedWorkout;
        setParsedWorkout(parsed);
        setMessages((current) => [
          ...current.filter((message) => message.kind !== "result"),
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: "I updated the workout with your context. Review it below. If it looks right, validate it. Otherwise keep talking and I’ll refine it again.",
          },
          {
            id: `result-${Date.now()}`,
            role: "assistant",
            text: "",
            kind: "result",
          },
        ]);
        setClarificationRound(0);
      } else {
        if (trainingPlanContext) {
          const result = await generateNextTrainingDay({
            trainingPlan: trainingPlanContext,
            userProfile: {
              ...(typeof userProfile === "object" && userProfile ? userProfile : {}),
            },
            recentWorkouts,
            userMessage: nextUserContext.join("\n") || undefined,
          });
          setNextTrainingDay(result.nextDay);
          setMessages((current) => [
            ...current.filter((message) => message.kind !== "result"),
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: "I generated the next training day for this program. Review it below, then add it to the plan or keep refining it in the chat.",
            },
            {
              id: `result-${Date.now()}`,
              role: "assistant",
              text: "",
              kind: "result",
            },
          ]);
        } else {
          const result = await generateTrainingPlan({
            userProfile: {
              ...(typeof userProfile === "object" && userProfile ? userProfile : {}),
            },
            recentWorkouts,
            currentTrainingPlan: trainingPlan ?? undefined,
            currentTrainingPlanId: trainingPlanId ?? undefined,
            userMessage: nextUserContext.join("\n") || undefined,
          });
          setTrainingPlan(result.trainingPlan);
          setTrainingPlanId(result.trainingPlanId);
          setMessages((current) => [
            ...current.filter((message) => message.kind !== "result"),
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: "Your first plan is ready. Review it below, validate it if it looks good, or keep chatting if you want changes first.",
            },
            {
              id: `result-${Date.now()}`,
              role: "assistant",
              text: "",
              kind: "result",
            },
          ]);
        }
        setClarificationRound(0);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to run AI workspace");
    } finally {
      setLoadingAction(null);
    }
  }

  function handleValidateWorkout() {
    if (!parsedWorkout || savedWorkoutId) return;

    const scheduledCount = parsedWorkout.exercises.filter((exercise) =>
      hasCompleteTimeline(parseMethodDraft(exercise.notes)),
    ).length;
    if (scheduledCount !== parsedWorkout.exercises.length) {
      setError("Add day, week, and month to every exercise before validating.");
      return;
    }

    setSaveTitleDraft(parsedWorkout.title?.trim() || "My program");
    setShowSaveTitlePrompt(true);
  }

  async function handleConfirmSaveWorkout() {
    if (!parsedWorkout || savedWorkoutId) return;
    const title = saveTitleDraft.trim();
    if (!title) {
      setError("Add a title before saving.");
      return;
    }

    setError(null);
    setLoadingAction("save");
    try {
      const workoutToSave = {
        ...parsedWorkout,
        title,
      };
      const result = await saveParsedWorkout({
        rawText: combinedInput,
        parsedWorkout: workoutToSave,
      });
      setParsedWorkout(workoutToSave);
      setSavedWorkoutId(result.workoutId);
      setShowSaveTitlePrompt(false);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-save-${Date.now()}`,
          role: "assistant",
          text: "Workout saved. You can now find it in the app, or keep talking if you want me to adjust it again first.",
        },
      ]);
      router.push({
        pathname: "/workout-detail",
        params: {
          workoutId: result.workoutId,
          title: workoutToSave.title ?? "Workout",
          meta: formatSavedWorkoutMeta(workoutToSave),
          time: formatSavedWorkoutTime(workoutToSave.performedAt),
          day: formatSavedWorkoutDay(workoutToSave.performedAt),
          exercises: JSON.stringify(workoutToSave.exercises),
          fromSaved: "1",
        },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save workout");
    } finally {
      setLoadingAction(null);
    }
  }

  function updateParsedExercise(
    exerciseIndex: number,
    patch: Partial<ParsedWorkoutExercise>,
  ) {
    setParsedWorkout((current) => {
      if (!current) return current;
      return {
        ...current,
        exercises: current.exercises.map((exercise, index) =>
          index === exerciseIndex ? { ...exercise, ...patch } : exercise,
        ),
      };
    });
    setSavedWorkoutId(null);
  }

  function updateTrainingPlanExercise(
    weekIndex: number,
    dayIndex: number,
    exerciseIndex: number,
    patch: Partial<ParsedWorkoutExercise>,
  ) {
    setTrainingPlan((current) => {
      if (!current) return current;

      return {
        ...current,
        weeks: current.weeks.map((week, currentWeekIndex) => {
          if (currentWeekIndex !== weekIndex) return week;

          return {
            ...week,
            days: week.days.map((day, currentDayIndex) => {
              if (currentDayIndex !== dayIndex) return day;

              return {
                ...day,
                exercises: day.exercises.map((exercise, currentExerciseIndex) => {
                  if (currentExerciseIndex !== exerciseIndex) return exercise;

                  const next = fromParsedWorkoutExercise(exercise, patch);
                  return {
                    ...next,
                    order: currentExerciseIndex,
                  };
                }),
              };
            }),
          };
        }),
      };
    });
  }

  function removeParsedExercise(exerciseIndex: number) {
    setParsedWorkout((current) => {
      if (!current) return current;
      const nextExercises = current.exercises
        .filter((_, index) => index !== exerciseIndex)
        .map((exercise, index) => ({ ...exercise, order: index }));
      return {
        ...current,
        exercises: nextExercises,
      };
    });
    setSelectedScheduleExerciseIndices((current) =>
      current
        .filter((index) => index !== exerciseIndex)
        .map((index) => (index > exerciseIndex ? index - 1 : index)),
    );
    setActiveExerciseIndex((current) => {
      if (current === null) return current;
      if (current === exerciseIndex) return null;
      return current > exerciseIndex ? current - 1 : current;
    });
    setSavedWorkoutId(null);
  }

  function applyTimelineToExercise(
    exerciseIndex: number,
    field: TimelineField,
    value: string,
  ) {
    applyScheduleToExercises([exerciseIndex], {
      day: field === "day" ? value : undefined,
      week: field === "week" ? value : undefined,
      month: field === "month" ? value : undefined,
    });
  }

  function applyScheduleToExercises(
    exerciseIndices: number[],
    schedule: { day?: string; week?: string; month?: string },
  ) {
    const targetIndices = new Set(exerciseIndices);
    if (!targetIndices.size) return;
    setParsedWorkout((current) => {
      if (!current) return current;
      return {
        ...current,
        exercises: current.exercises.map((exercise, index) => {
          if (!targetIndices.has(index)) return exercise;
          const draft = parseMethodDraft(exercise.notes);
          const nextDraft = {
            ...draft,
            timelineDate: typeof schedule.day === "string" ? schedule.day : draft.timelineDate,
            timelineWeek: typeof schedule.week === "string" ? schedule.week : draft.timelineWeek,
            timelineMonth: typeof schedule.month === "string" ? schedule.month : draft.timelineMonth,
          };
          return { ...exercise, notes: buildMethodNote(nextDraft) };
        }),
      };
    });
    setSavedWorkoutId(null);
  }

  function toggleScheduleSelection(exerciseIndex: number) {
    setSelectedScheduleExerciseIndices((current) =>
      current.includes(exerciseIndex)
        ? current.filter((index) => index !== exerciseIndex)
        : [...current, exerciseIndex],
    );
  }

  function clearScheduleSelection() {
    setSelectedScheduleExerciseIndices([]);
  }

  function handleValidatePlan() {
    if (!trainingPlan) {
      setError("No plan to save yet.");
      return;
    }

    if (!trainingPlanId) {
      setError("This plan is missing its saved id. Generate it again before validating.");
      return;
    }

    setLoadingAction("save");
    setError(null);

    updateTrainingPlan({
      trainingPlanId,
      trainingPlan,
    })
      .then((result) => {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-plan-${Date.now()}`,
            role: "assistant",
            text: "Plan confirmed. I saved it as your working plan. You can revisit it from the app and keep refining it later.",
          },
        ]);
        router.push({
          pathname: "/program-detail",
          params: {
            trainingPlanId: result.trainingPlanId,
            title: trainingPlan.blockTitle ?? "Program",
          },
        });
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to save plan");
      })
      .finally(() => {
        setLoadingAction(null);
      });
  }

  async function handleValidateNextTrainingDay() {
    if (!linkedTrainingPlanId || !nextTrainingDay) return;

    setLoadingAction("save");
    setError(null);

    try {
      await appendTrainingPlanDay({
        trainingPlanId: linkedTrainingPlanId,
        nextDay: nextTrainingDay,
      });

      setMessages((current) => [
        ...current,
        {
          id: `assistant-next-day-${Date.now()}`,
          role: "assistant",
          text: "The next day is now part of your program. You can review it in the program detail screen.",
        },
      ]);

      router.replace({
        pathname: "/program-detail",
        params: {
          trainingPlanId: linkedTrainingPlanId,
          title: trainingPlanContext?.title ?? params.title ?? "Program",
        },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to add this day to the program");
    } finally {
      setLoadingAction(null);
    }
  }

  const isBusy = loadingAction !== null;
  const groupedExercises = useMemo(
    () => (parsedWorkout ? buildExerciseGroups(parsedWorkout.exercises) : []),
    [parsedWorkout],
  );
  const scheduledExercisesCount = useMemo(
    () =>
      parsedWorkout
        ? parsedWorkout.exercises.filter((exercise) =>
            hasCompleteTimeline(parseMethodDraft(exercise.notes)),
          ).length
        : 0,
    [parsedWorkout],
  );
  const scheduleIsComplete = parsedWorkout
    ? parsedWorkout.exercises.length > 0 &&
      scheduledExercisesCount === parsedWorkout.exercises.length
    : true;
  const showConversation = selectedMode !== null;
  const activePlanWeek =
    trainingPlan && activePlanWeekIndex !== null ? trainingPlan.weeks[activePlanWeekIndex] ?? null : null;
  const activePlanDay =
    activePlanWeek && activePlanDayIndex !== null ? activePlanWeek.days[activePlanDayIndex] ?? null : null;
  const activePlanDayExercises = useMemo(
    () => (activePlanDay ? activePlanDay.exercises.map((exercise) => toParsedWorkoutExercise(exercise)) : []),
    [activePlanDay],
  );
  const activePlanExerciseGroups = useMemo(
    () => buildExerciseGroups(activePlanDayExercises),
    [activePlanDayExercises],
  );
  const activePlanExercise =
    activePlanDay && activePlanExerciseIndex !== null
      ? activePlanDay.exercises[activePlanExerciseIndex] ?? null
      : null;
  const inlineResult = showConversation && (parsedCollection || parsedWorkout || trainingPlan || nextTrainingDay) ? (
    <>
      {parsedCollection ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>Organized plan</Text>
          <Text style={styles.resultTitle}>{parsedCollection.summary ?? "Structured sessions"}</Text>
          <View style={styles.resultList}>
            {parsedCollection.sessions.map((session, index) => (
              <View key={`${session.title ?? "session"}-${index}`} style={styles.resultItem}>
                <Text style={styles.resultItemTitle}>{session.title ?? `Session ${index + 1}`}</Text>
                <Text style={styles.resultItemMeta}>{session.exercises.length} exercises</Text>
              </View>
            ))}
          </View>
          <Text style={styles.resultHint}>If some relationships are still wrong, keep chatting and I’ll reorganize it again.</Text>
        </View>
      ) : null}

      {parsedWorkout ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>Clean workout</Text>
          <Text style={styles.resultTitle}>{parsedWorkout.title ?? "Parsed workout"}</Text>
          <View style={styles.resultList}>
            {groupedExercises.map((group, groupIndex) => (
              <View key={`group-${groupIndex}`} style={styles.exerciseGroupWrap}>
                {group.type === "single" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.resultItem,
                      activeExerciseIndex === group.exerciseIndex && styles.resultItemActive,
                      selectedScheduleExerciseIndices.includes(group.exerciseIndex) && styles.resultItemDragPending,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      setActiveExerciseIndex((current) =>
                        current === group.exerciseIndex ? null : group.exerciseIndex,
                      )
                    }
                  >
                    <ExerciseCardContent
                      exercise={group.exercise}
                      selected={selectedScheduleExerciseIndices.includes(group.exerciseIndex)}
                      onToggleSelect={() => toggleScheduleSelection(group.exerciseIndex)}
                      onOpenTimelinePicker={(field) =>
                        setTimelinePicker({
                          exerciseIndex: group.exerciseIndex,
                          field,
                        })
                      }
                    />
                    <Pressable
                      style={styles.exerciseDeleteInline}
                      onPress={() => removeParsedExercise(group.exerciseIndex)}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#b24a3d" />
                    </Pressable>
                    <Text style={styles.exerciseChevron}>›</Text>
                  </Pressable>
                ) : (
                  <View style={styles.linkedExerciseGroup}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.resultItem,
                        styles.linkedExerciseItem,
                        activeExerciseIndex === group.firstIndex && styles.resultItemActive,
                        selectedScheduleExerciseIndices.includes(group.firstIndex) && styles.resultItemDragPending,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setActiveExerciseIndex((current) =>
                          current === group.firstIndex ? null : group.firstIndex,
                        )
                      }
                    >
                      <ExerciseCardContent
                        exercise={group.first}
                        selected={selectedScheduleExerciseIndices.includes(group.firstIndex)}
                        onToggleSelect={() => toggleScheduleSelection(group.firstIndex)}
                        onOpenTimelinePicker={(field) =>
                          setTimelinePicker({
                            exerciseIndex: group.firstIndex,
                            field,
                          })
                        }
                      />
                      <Pressable
                        style={styles.exerciseDeleteInline}
                        onPress={() => removeParsedExercise(group.firstIndex)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#b24a3d" />
                      </Pressable>
                      <Text style={styles.exerciseChevron}>›</Text>
                    </Pressable>
                    <View style={styles.groupConnector}>
                      <View style={styles.groupConnectorLine} />
                      <View style={styles.groupMethodBadge}>
                        <Text style={styles.groupMethodBadgeText}>{group.label}</Text>
                      </View>
                      <View style={styles.groupConnectorLine} />
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.resultItem,
                        styles.linkedExerciseItem,
                        activeExerciseIndex === group.secondIndex && styles.resultItemActive,
                        selectedScheduleExerciseIndices.includes(group.secondIndex) && styles.resultItemDragPending,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setActiveExerciseIndex((current) =>
                          current === group.secondIndex ? null : group.secondIndex,
                        )
                      }
                    >
                      <ExerciseCardContent
                        exercise={group.second}
                        selected={selectedScheduleExerciseIndices.includes(group.secondIndex)}
                        onToggleSelect={() => toggleScheduleSelection(group.secondIndex)}
                        onOpenTimelinePicker={(field) =>
                          setTimelinePicker({
                            exerciseIndex: group.secondIndex,
                            field,
                          })
                        }
                      />
                      <Pressable
                        style={styles.exerciseDeleteInline}
                        onPress={() => removeParsedExercise(group.secondIndex)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#b24a3d" />
                      </Pressable>
                      <Text style={styles.exerciseChevron}>›</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
          <View style={styles.resultActions}>
            <Pressable
              style={({ pressed }) => [
                styles.resultPrimaryAction,
                (pressed || loadingAction === "save") && styles.pressed,
                savedWorkoutId && styles.resultPrimaryActionDone,
                !scheduleIsComplete && styles.resultPrimaryActionDisabled,
              ]}
              onPress={handleValidateWorkout}
              disabled={loadingAction === "save" || Boolean(savedWorkoutId) || !scheduleIsComplete}
            >
              {loadingAction === "save" ? (
                <ActivityIndicator color="#f5f7fa" />
              ) : (
                <Text style={styles.resultPrimaryActionText}>
                  {savedWorkoutId
                    ? "Saved to app"
                    : scheduleIsComplete
                      ? "Validate and add to app"
                      : "Complete exercise timeline first"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {trainingPlan ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>Generated plan</Text>
          <Text style={styles.resultTitle}>{trainingPlan.blockTitle}</Text>
          <Text style={styles.resultBody}>
            {trainingPlan.summary ?? "A structured first block based on your profile."}
          </Text>
          <View style={styles.resultList}>
            {activePlanWeek === null
              ? trainingPlan.weeks.map((week, weekIndex) => (
                  <Pressable
                    key={week.weekNumber}
                    style={({ pressed }) => [styles.resultItem, pressed && styles.pressed]}
                    onPress={() => {
                      setActivePlanWeekIndex(weekIndex);
                      setActivePlanDayIndex(null);
                    }}
                  >
                    <View style={styles.planPreviewCopy}>
                      <Text style={styles.resultItemTitle}>Week {week.weekNumber}</Text>
                      <Text style={styles.resultItemMeta}>{week.days.length} training days</Text>
                    </View>
                    <Text style={styles.exerciseChevron}>›</Text>
                  </Pressable>
                ))
              : activePlanDay === null
                ? (
                    <>
                      <Pressable
                        style={({ pressed }) => [styles.planPreviewBackRow, pressed && styles.pressed]}
                        onPress={() => setActivePlanWeekIndex(null)}
                      >
                        <Text style={styles.planPreviewBackText}>← Back to weeks</Text>
                      </Pressable>
                      <View style={styles.planPreviewHeaderCard}>
                        <Text style={styles.resultItemTitle}>Week {activePlanWeek.weekNumber}</Text>
                        <Text style={styles.resultItemMeta}>
                          {activePlanWeek.summary ?? `${activePlanWeek.days.length} training days`}
                        </Text>
                      </View>
                      {activePlanWeek.days.map((day, dayIndex) => (
                        <Pressable
                          key={`${activePlanWeek.weekNumber}-${day.dayLabel}-${dayIndex}`}
                          style={({ pressed }) => [styles.resultItem, pressed && styles.pressed]}
                          onPress={() => {
                            setActivePlanDayIndex(dayIndex);
                            setActivePlanExerciseIndex(null);
                          }}
                        >
                          <View style={styles.planPreviewCopy}>
                            <Text style={styles.planPreviewDayTitle}>
                              {day.dayLabel} · {day.title}
                            </Text>
                            <Text style={styles.resultItemMeta}>
                              {day.exercises.length} exercises
                              {typeof day.estimatedDurationMinutes === "number"
                                ? ` · ${day.estimatedDurationMinutes} min`
                                : ""}
                            </Text>
                          </View>
                          <Text style={styles.exerciseChevron}>›</Text>
                        </Pressable>
                      ))}
                    </>
                  )
                : (
                    <>
                      <Pressable
                        style={({ pressed }) => [styles.planPreviewBackRow, pressed && styles.pressed]}
                        onPress={() => setActivePlanDayIndex(null)}
                      >
                        <Text style={styles.planPreviewBackText}>← Back to days</Text>
                      </Pressable>
                      <View style={styles.planPreviewHeaderCard}>
                        <Text style={styles.planPreviewDayTitle}>
                          {activePlanDay.dayLabel} · {activePlanDay.title}
                        </Text>
                        <Text style={styles.resultItemMeta}>
                          {activePlanDay.summary ??
                            `${activePlanDay.exercises.length} exercises`}
                        </Text>
                      </View>
                      {activePlanExerciseGroups.map((group, groupIndex) => (
                        <View key={`plan-group-${groupIndex}`} style={styles.exerciseGroupWrap}>
                          {group.type === "single" ? (
                              <Pressable
                                style={({ pressed }) => [styles.planPreviewExerciseItem, pressed && styles.pressed]}
                                onPress={() => setActivePlanExerciseIndex(group.exerciseIndex)}
                              >
                                <View style={styles.planPreviewCopy}>
                                  <Text style={styles.planPreviewExerciseName}>{group.exercise.name}</Text>
                                  <Text style={styles.resultItemMeta}>
                                    {formatWorkoutVolume(group.exercise)}
                                    {typeof group.exercise.restSeconds === "number"
                                      ? ` · rest ${group.exercise.restSeconds}s`
                                      : ""}
                                  </Text>
                                  {buildMethodPreview(parseMethodDraft(group.exercise.notes)) ? (
                                    <Text style={styles.exerciseSupportText}>
                                      {buildMethodPreview(parseMethodDraft(group.exercise.notes))}
                                    </Text>
                                  ) : null}
                                </View>
                                <Text style={styles.exerciseChevron}>›</Text>
                              </Pressable>
                          ) : (
                            <View style={styles.linkedExerciseGroup}>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.planPreviewExerciseItem,
                                  styles.linkedExerciseItem,
                                  pressed && styles.pressed,
                                ]}
                                onPress={() => setActivePlanExerciseIndex(group.firstIndex)}
                              >
                                <View style={styles.planPreviewCopy}>
                                  <Text style={styles.planPreviewExerciseName}>{group.first.name}</Text>
                                  <Text style={styles.resultItemMeta}>
                                    {formatWorkoutVolume(group.first)}
                                    {typeof group.first.restSeconds === "number"
                                      ? ` · rest ${group.first.restSeconds}s`
                                      : ""}
                                  </Text>
                                  {buildMethodPreview(parseMethodDraft(group.first.notes)) ? (
                                    <Text style={styles.exerciseSupportText}>
                                      {buildMethodPreview(parseMethodDraft(group.first.notes))}
                                    </Text>
                                  ) : null}
                                </View>
                                <Text style={styles.exerciseChevron}>›</Text>
                              </Pressable>
                              <View style={styles.groupConnector}>
                                <View style={styles.groupConnectorLine} />
                                <View style={styles.groupMethodBadge}>
                                  <Text style={styles.groupMethodBadgeText}>{group.label}</Text>
                                </View>
                                <View style={styles.groupConnectorLine} />
                              </View>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.planPreviewExerciseItem,
                                  styles.linkedExerciseItem,
                                  pressed && styles.pressed,
                                ]}
                                onPress={() => setActivePlanExerciseIndex(group.secondIndex)}
                              >
                                <View style={styles.planPreviewCopy}>
                                  <Text style={styles.planPreviewExerciseName}>{group.second.name}</Text>
                                  <Text style={styles.resultItemMeta}>
                                    {formatWorkoutVolume(group.second)}
                                    {typeof group.second.restSeconds === "number"
                                      ? ` · rest ${group.second.restSeconds}s`
                                      : ""}
                                  </Text>
                                  {buildMethodPreview(parseMethodDraft(group.second.notes)) ? (
                                    <Text style={styles.exerciseSupportText}>
                                      {buildMethodPreview(parseMethodDraft(group.second.notes))}
                                    </Text>
                                  ) : null}
                                </View>
                                <Text style={styles.exerciseChevron}>›</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      ))}
                    </>
                  )}
          </View>
          <View style={styles.resultActions}>
            <Pressable
              style={({ pressed }) => [
                styles.resultPrimaryAction,
                (pressed || loadingAction === "save") && styles.pressed,
                !trainingPlanId && styles.resultPrimaryActionDisabled,
              ]}
              onPress={handleValidatePlan}
              disabled={!trainingPlanId || loadingAction === "save"}
            >
              {loadingAction === "save" ? (
                <ActivityIndicator color="#f5f7fa" />
              ) : (
                <Text style={styles.resultPrimaryActionText}>Validate this plan</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {nextTrainingDay ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>Next day</Text>
          <Text style={styles.resultTitle}>{nextTrainingDay.title}</Text>
          <Text style={styles.resultBody}>
            {nextTrainingDay.summary ??
              "A new training day generated from your current program context."}
          </Text>
          <View style={styles.resultList}>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemTitle}>{nextTrainingDay.dayLabel}</Text>
              <Text style={styles.resultItemMeta}>
                {nextTrainingDay.exercises.length} exercises
                {typeof nextTrainingDay.estimatedDurationMinutes === "number"
                  ? ` · ${nextTrainingDay.estimatedDurationMinutes} min`
                  : ""}
              </Text>
            </View>
            {nextTrainingDay.exercises.map((exercise) => (
              <View key={`${exercise.order}-${exercise.name}`} style={styles.resultItem}>
                <Text style={styles.resultItemTitle}>{exercise.name}</Text>
                <Text style={styles.resultItemMeta}>
                  {exercise.sets} x {formatRepRange(exercise.repMin, exercise.repMax)} · rest {exercise.restSeconds}s
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.resultActions}>
            <Pressable
              style={({ pressed }) => [
                styles.resultPrimaryAction,
                (pressed || loadingAction === "save") && styles.pressed,
                !linkedTrainingPlanId && styles.resultPrimaryActionDisabled,
              ]}
              onPress={handleValidateNextTrainingDay}
              disabled={!linkedTrainingPlanId || loadingAction === "save"}
            >
              {loadingAction === "save" ? (
                <ActivityIndicator color="#f5f7fa" />
              ) : (
                <Text style={styles.resultPrimaryActionText}>Add this day to the program</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.backTap, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={styles.assistantPill}>
            <View style={styles.assistantPillOrb} />
            <Text style={styles.assistantPillText}>ASK COACH</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroBlock}>
            <Text style={styles.heroGreeting}>
              {showConversation ? "Hey," : "Coach workspace"}
            </Text>
            <Text style={styles.heroQuestion}>
              {showConversation
                ? modeTitle(selectedMode)
                : "What do you want to build?"}
            </Text>
            <View style={styles.orbWrap}>
              <View style={styles.orbGlowOne} />
              <View style={styles.orbGlowTwo} />
              <View style={styles.orbCore} />
            </View>
          </View>

          {!showConversation ? (
            <View style={styles.choiceList}>
              <Text style={styles.sectionLabel}>CHOOSE A FLOW</Text>
              <ChoiceCard
                title="Paste a workout"
                body="Paste a program or single session, then refine it with AI before saving."
                onPress={() => setSelectedMode("paste_workout")}
              />
              <ChoiceCard
                title="Import from notes"
                body="Bring in a long note and let AI organize the sessions into a cleaner structure."
                onPress={() => setSelectedMode("import_note")}
              />
              <ChoiceCard
                title="Generate from scratch"
                body="Start from your profile and let AI build a first plan with you."
                onPress={() => setSelectedMode("generate_from_scratch")}
              />
              <ChoiceCard
                title="Build by myself"
                body="Skip the conversation and build the workout manually with the structured editor."
                onPress={() => router.push("/manual-workout")}
              />
            </View>
          ) : selectedMode !== "generate_from_scratch" ? (
            <View style={styles.sourcePreviewCard}>
              <View style={styles.sourcePreviewHeader}>
                <Text style={styles.sectionLabel}>
                  {selectedMode === "import_note" ? "SOURCE NOTE" : "SOURCE WORKOUT"}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.flowSwitchButton, pressed && styles.pressed]}
                  onPress={() => {
                    setSelectedMode(null);
                    setExtraContext("");
                    setMessages([]);
                    resetGeneratedState();
                  }}
                >
                  <Text style={styles.flowSwitchButtonText}>Change flow</Text>
                </Pressable>
              </View>
              <Text style={styles.sourcePreviewText}>
                {effectiveSourceText ||
                  "Your imported or pasted content will appear here once it is connected to this workspace."}
              </Text>
            </View>
          ) : (
            <View style={styles.sourcePreviewCard}>
              <View style={styles.sourcePreviewHeader}>
                <Text style={styles.sectionLabel}>PROFILE CONTEXT</Text>
                <Pressable
                  style={({ pressed }) => [styles.flowSwitchButton, pressed && styles.pressed]}
                  onPress={() => {
                    setSelectedMode(null);
                    setExtraContext("");
                    setMessages([]);
                    setError(null);
                    setParsedWorkout(null);
                    setParsedCollection(null);
                    setTrainingPlan(null);
                    setTrainingPlanId(null);
                    setSavedWorkoutId(null);
                    setTimelinePicker(null);
                    setActiveExerciseIndex(null);
                    setSelectedScheduleExerciseIndices([]);
                  }}
                >
                  <Text style={styles.flowSwitchButtonText}>Change flow</Text>
                </Pressable>
              </View>
              <Text style={styles.sourcePreviewText}>
                {trainingPlanContext
                  ? `I’ll use ${trainingPlanContext.title} as the working program so I can refine it or extend it with you.`
                  : "I’ll use your onboarding answers as the base context for the plan."}
              </Text>
            </View>
          )}

          {showConversation ? (
            <View style={styles.messageList}>
              {messages.map((message) => (
                <View key={message.id} style={styles.messageList}>
                  {message.kind === "result" ? (
                    inlineResult
                  ) : (
                    <View
                      style={[
                        styles.messageBubble,
                        message.role === "assistant" ? styles.assistantBubble : styles.userBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          message.role === "assistant" ? styles.assistantText : styles.userText,
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              {!messages.length ? inlineResult : null}
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

        </ScrollView>

        {showConversation ? (
          <View style={styles.composerShell}>
            {selectedScheduleExerciseIndices.length > 0 ? (
              <View style={styles.selectionModeBar}>
                <Pressable
                  style={({ pressed }) => [styles.selectionModeCancel, pressed && styles.pressed]}
                  onPress={clearScheduleSelection}
                >
                  <Text style={styles.selectionModeCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.selectionModeValidate, pressed && styles.pressed]}
                  onPress={clearScheduleSelection}
                >
                  <Text style={styles.selectionModeValidateText}>Validate</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.composerBar}>
                <View style={styles.composerAccessory}>
                  <Text style={styles.composerAccessoryText}>+</Text>
                </View>
                <TextInput
                  value={extraContext}
                  onChangeText={setExtraContext}
                  style={styles.composerInput}
                  placeholder="Add context if needed..."
                  placeholderTextColor="#9ea3ac"
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    void handleRun();
                  }}
                  editable={!isBusy}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.composerSendButton,
                    (pressed || loadingAction === "run") && styles.pressed,
                  ]}
                  onPress={() => {
                    void handleRun();
                  }}
                  disabled={isBusy}
                >
                  {loadingAction === "run" ? (
                    <ActivityIndicator color="#3d3350" />
                  ) : (
                    <Text style={styles.composerSendText}>↑</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {showConversation && activeExerciseIndex !== null && parsedWorkout?.exercises[activeExerciseIndex] ? (
          <View style={styles.exerciseDetailOverlay}>
            <View style={styles.exerciseDetailShell}>
              <View style={styles.exerciseDetailHeader}>
                <Pressable style={styles.exerciseDetailBack} onPress={() => setActiveExerciseIndex(null)}>
                  <Text style={styles.exerciseDetailBackText}>←</Text>
                </Pressable>
                <Text style={styles.exerciseDetailHeaderTitle}>Review exercise</Text>
                <View style={styles.exerciseDetailHeaderSpacer} />
              </View>

              <ScrollView
                contentContainerStyle={styles.exerciseDetailContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <ExerciseEditorCard
                  exercise={parsedWorkout.exercises[activeExerciseIndex]}
                  linkedExerciseName={resolveLinkedExerciseName(
                    groupedExercises,
                    activeExerciseIndex,
                  )}
                  onChange={(patch) => updateParsedExercise(activeExerciseIndex, patch)}
                />
              </ScrollView>
            </View>
          </View>
        ) : null}

        {showConversation && activePlanExercise && trainingPlan && activePlanWeekIndex !== null && activePlanDayIndex !== null ? (
          <View style={styles.exerciseDetailOverlay}>
            <View style={styles.exerciseDetailShell}>
              <View style={styles.exerciseDetailHeader}>
                <Pressable style={[styles.exerciseDetailBack, styles.planDetailBackStrong]} onPress={() => setActivePlanExerciseIndex(null)}>
                  <Text style={styles.exerciseDetailBackText}>←</Text>
                </Pressable>
                <Text style={styles.exerciseDetailHeaderTitle}>Review exercise</Text>
                <View style={styles.exerciseDetailHeaderSpacer} />
              </View>

              <ScrollView
                contentContainerStyle={styles.exerciseDetailContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <ExerciseEditorCard
                  exercise={toParsedWorkoutExercise(activePlanExercise)}
                  linkedExerciseName={resolveLinkedExerciseName(
                    activePlanExerciseGroups,
                    activePlanExerciseIndex!,
                  )}
                  onChange={(patch) =>
                    updateTrainingPlanExercise(
                      activePlanWeekIndex,
                      activePlanDayIndex,
                      activePlanExerciseIndex!,
                      patch,
                    )
                  }
                />
              </ScrollView>
            </View>
          </View>
        ) : null}

        {showConversation && timelinePicker && parsedWorkout?.exercises[timelinePicker.exerciseIndex] ? (
          <View style={styles.timelinePickerOverlay}>
            <Pressable
              style={styles.timelinePickerBackdrop}
              onPress={() => setTimelinePicker(null)}
            />
            <View style={styles.timelinePickerSheet}>
              <View style={styles.timelinePickerHeader}>
                <Text style={styles.timelinePickerTitle}>
                  {timelinePicker.field === "day"
                    ? "Select day tag"
                    : timelinePicker.field === "week"
                      ? "Select week tag"
                      : "Select month tag"}
                </Text>
                <Pressable onPress={() => setTimelinePicker(null)}>
                  <Text style={styles.timelinePickerClose}>Close</Text>
                </Pressable>
              </View>
              <View style={styles.timelinePickerOptions}>
                {getTimelineOptions(timelinePicker.field).map((option) => (
                  <Pressable
                    key={`${timelinePicker.field}-${option}`}
                    style={styles.timelinePickerOption}
                    onPress={() => {
                      const applyToSelection =
                        selectedScheduleExerciseIndices.length > 1 &&
                        selectedScheduleExerciseIndices.includes(timelinePicker.exerciseIndex);

                      if (applyToSelection) {
                        applyScheduleToExercises(
                          selectedScheduleExerciseIndices,
                          buildSchedulePatch(timelinePicker.field, option),
                        );
                      } else {
                        applyTimelineToExercise(
                          timelinePicker.exerciseIndex,
                          timelinePicker.field,
                          option,
                        );
                      }
                      setTimelinePicker(null);
                    }}
                  >
                    <Text style={styles.timelinePickerOptionText}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {showConversation && showSaveTitlePrompt ? (
          <View style={styles.savePromptOverlay}>
            <Pressable style={styles.savePromptBackdrop} onPress={() => setShowSaveTitlePrompt(false)} />
            <View style={styles.savePromptCard}>
              <Text style={styles.savePromptTitle}>Program title</Text>
              <Text style={styles.savePromptBody}>Choose the title before saving to app.</Text>
              <TextInput
                value={saveTitleDraft}
                onChangeText={setSaveTitleDraft}
                style={styles.savePromptInput}
                placeholder="My program"
                placeholderTextColor="#9ea3ac"
                editable={loadingAction !== "save"}
              />
              <View style={styles.savePromptActions}>
                <Pressable
                  style={styles.savePromptCancel}
                  onPress={() => setShowSaveTitlePrompt(false)}
                  disabled={loadingAction === "save"}
                >
                  <Text style={styles.savePromptCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.savePromptSave}
                  onPress={() => {
                    void handleConfirmSaveWorkout();
                  }}
                  disabled={loadingAction === "save"}
                >
                  {loadingAction === "save" ? (
                    <ActivityIndicator color="#f5f7fa" />
                  ) : (
                    <Text style={styles.savePromptSaveText}>Save to app</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function ChoiceCard({
  title,
  body,
  onPress,
}: {
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.choiceCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.choiceCardCopy}>
        <Text style={styles.choiceCardTitle}>{title}</Text>
        <Text style={styles.choiceCardBody}>{body}</Text>
      </View>
      <Text style={styles.choiceCardChevron}>›</Text>
    </Pressable>
  );
}

function ExerciseCardContent({
  exercise,
  selected,
  onToggleSelect,
  onOpenTimelinePicker,
}: {
  exercise: ParsedWorkoutExercise;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenTimelinePicker: (field: TimelineField) => void;
}) {
  const methodDraft = parseMethodDraft(exercise.notes);
  const method = methodDraft.method === "Standard" ? null : methodDraft.method;
  const volume = formatWorkoutVolume(exercise);
  const timeline = buildTimelinePreview(methodDraft);
  const dayTag = methodDraft.timelineDate.trim() || "Day";
  const weekTag = methodDraft.timelineWeek.trim() || "Week 0";
  const monthTag = methodDraft.timelineMonth.trim() || "Month";
  const detailParts = [
    typeof exercise.weight === "number"
      ? `${formatNumeric(exercise.weight)}${exercise.unit ? ` ${exercise.unit}` : " kg"}`
      : null,
    typeof exercise.restSeconds === "number" ? `${exercise.restSeconds}s rest` : null,
  ].filter(Boolean);

  return (
    <>
      <View style={styles.exerciseHeaderRow}>
        <View style={styles.exerciseHeaderLead}>
          <Pressable
            style={[styles.selectBullet, selected && styles.selectBulletActive]}
            onPress={onToggleSelect}
            hitSlop={8}
          >
            {selected ? <View style={styles.selectBulletDot} /> : null}
          </Pressable>
          <Text style={styles.resultItemTitle}>{exercise.name}</Text>
        </View>
        {method ? (
          <View style={styles.exerciseMethodChip}>
            <Text style={styles.exerciseMethodChipText}>{method}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.resultItemMeta}>{volume}</Text>
      {detailParts.length ? <Text style={styles.exerciseSupportText}>{detailParts.join(" · ")}</Text> : null}
      {buildMethodPreview(methodDraft) ? (
        <Text style={styles.exerciseSupportText}>{buildMethodPreview(methodDraft)}</Text>
      ) : null}
      {timeline ? <Text style={styles.exerciseSupportText}>{timeline}</Text> : null}
      <View style={styles.timelineChipRow}>
        <Pressable style={styles.timelineChip} onPress={() => onOpenTimelinePicker("day")}>
          <Text style={styles.timelineChipText}>{dayTag}</Text>
        </Pressable>
        <Pressable style={styles.timelineChip} onPress={() => onOpenTimelinePicker("week")}>
          <Text style={styles.timelineChipText}>{weekTag}</Text>
        </Pressable>
        <Pressable style={styles.timelineChip} onPress={() => onOpenTimelinePicker("month")}>
          <Text style={styles.timelineChipText}>{monthTag}</Text>
        </Pressable>
      </View>
      {methodDraft.freeform ? <Text style={styles.exerciseSupportText}>{methodDraft.freeform}</Text> : null}
      <Text style={styles.exerciseTapHint}>Tap to review and edit</Text>
    </>
  );
}

function ExerciseEditorCard({
  exercise,
  linkedExerciseName,
  onChange,
}: {
  exercise: ParsedWorkoutExercise;
  linkedExerciseName?: string;
  onChange: (patch: Partial<ParsedWorkoutExercise>) => void;
}) {
  const methodDraft = parseMethodDraft(exercise.notes);
  const resolvedPairName =
    methodDraft.pairName.trim() || (linkedExerciseName ?? "").trim();

  return (
    <View style={styles.editorCard}>
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>{exercise.name}</Text>
        {methodDraft.method !== "Standard" ? (
          <View style={styles.exerciseMethodChip}>
            <Text style={styles.exerciseMethodChipText}>{methodDraft.method}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.editorField}>
        <Text style={styles.editorLabel}>Name</Text>
        <TextInput
          value={exercise.name}
          onChangeText={(value) => onChange({ name: value })}
          style={styles.editorInput}
          placeholder="Exercise name"
          placeholderTextColor="#9ea3ac"
        />
      </View>
      <View style={styles.editorMetricGrid}>
        <MetricInput
          label="Sets"
          value={exercise.sets}
          onChange={(value) => onChange({ sets: value })}
        />
        {methodDraft.repMode === "failure" ? (
          <View style={styles.failureMetricCard}>
            <Text style={styles.editorLabel}>Reps</Text>
            <Text style={styles.failureMetricValue}>Failure</Text>
          </View>
        ) : (
          <MetricInput
            label="Reps"
            value={exercise.reps ?? exercise.repMin}
            onChange={(value) => onChange({ reps: value, repMin: value, repMax: value })}
          />
        )}
        <MetricInput
          label="Weight"
          value={exercise.weight}
          onChange={(value) => onChange({ weight: value })}
        />
        <MetricInput
          label="Rest"
          value={exercise.restSeconds}
          onChange={(value) => onChange({ restSeconds: value })}
        />
      </View>
      <View style={styles.editorField}>
        <Text style={styles.editorLabel}>Rep target</Text>
        <View style={styles.methodChipRow}>
          <Pressable
            style={[styles.methodChip, methodDraft.repMode === "standard" && styles.methodChipActive]}
            onPress={() =>
              onChange({
                reps: exercise.reps ?? exercise.repMin,
                repMin: exercise.repMin ?? exercise.reps,
                repMax: exercise.repMax ?? exercise.reps,
                notes: buildMethodNote({ ...methodDraft, repMode: "standard" }),
              })
            }
          >
            <Text style={[styles.methodChipText, methodDraft.repMode === "standard" && styles.methodChipTextActive]}>
              Fixed reps
            </Text>
          </Pressable>
          <Pressable
            style={[styles.methodChip, methodDraft.repMode === "failure" && styles.methodChipActive]}
            onPress={() =>
              onChange({
                reps: undefined,
                repMin: undefined,
                repMax: undefined,
                notes: buildMethodNote({ ...methodDraft, repMode: "failure" }),
              })
            }
          >
            <Text style={[styles.methodChipText, methodDraft.repMode === "failure" && styles.methodChipTextActive]}>
              Failure
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.editorField}>
        <Text style={styles.editorLabel}>Method</Text>
        <View style={styles.methodChipRow}>
          {exerciseMethods.map((method) => (
            <Pressable
              key={method}
              style={[styles.methodChip, methodDraft.method === method && styles.methodChipActive]}
              onPress={() =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    method,
                    pairName:
                      method === "Superset"
                        ? methodDraft.pairName.trim() || (linkedExerciseName ?? "")
                        : methodDraft.pairName,
                  }),
                })
              }
            >
              <Text style={[styles.methodChipText, methodDraft.method === method && styles.methodChipTextActive]}>
                {method}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {methodDraft.method === "Superset" ? (
        <View style={styles.methodDetailCard}>
          <Text style={styles.editorLabel}>Superset details</Text>
          <TextInput
            value={resolvedPairName}
            onChangeText={(value) =>
              onChange({ notes: buildMethodNote({ ...methodDraft, pairName: value }) })
            }
            style={styles.editorInput}
            placeholder="Paired exercise"
            placeholderTextColor="#9ea3ac"
          />
          <View style={styles.editorMetricGrid}>
            <MetricInput
              label="Pair reps"
              value={toOptionalNumber(methodDraft.pairReps)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    pairReps: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Pair weight"
              value={toOptionalNumber(methodDraft.pairWeight)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    pairWeight: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
          </View>
        </View>
      ) : null}

      {methodDraft.method === "Drop set" ? (
        <View style={styles.methodDetailCard}>
          <Text style={styles.editorLabel}>Drop weights</Text>
          <TextInput
            value={methodDraft.dropWeights}
            onChangeText={(value) =>
              onChange({ notes: buildMethodNote({ ...methodDraft, dropWeights: value }) })
            }
            style={styles.editorInput}
            placeholder="90, 70, 50"
            placeholderTextColor="#9ea3ac"
          />
          <Text style={styles.editorHint}>Enter each drop stage separated by commas.</Text>
        </View>
      ) : null}

      {methodDraft.method === "Rest-pause" ? (
        <View style={styles.methodDetailCard}>
          <Text style={styles.editorLabel}>Rest-pause setup</Text>
          <View style={styles.editorMetricGrid}>
            <MetricInput
              label="Pause seconds"
              value={toOptionalNumber(methodDraft.restPauseSeconds)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    restPauseSeconds: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Mini-sets"
              value={toOptionalNumber(methodDraft.restPauseMiniSets)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    restPauseMiniSets: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
          </View>
        </View>
      ) : null}

      {methodDraft.method === "Myo-reps" ? (
        <View style={styles.methodDetailCard}>
          <Text style={styles.editorLabel}>Myo-reps setup</Text>
          <View style={styles.editorMetricGrid}>
            <MetricInput
              label="Activation reps"
              value={toOptionalNumber(methodDraft.myoActivationReps)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    myoActivationReps: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Mini reps"
              value={toOptionalNumber(methodDraft.myoMiniReps)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    myoMiniReps: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Rounds"
              value={toOptionalNumber(methodDraft.myoRounds)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    myoRounds: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Rest seconds"
              value={toOptionalNumber(methodDraft.myoRestSeconds)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    myoRestSeconds: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
          </View>
        </View>
      ) : null}

      {methodDraft.method === "Tempo" ? (
        <View style={styles.methodDetailCard}>
          <Text style={styles.editorLabel}>Tempo</Text>
          <View style={styles.editorMetricGrid}>
            <MetricInput
              label="Eccentric"
              value={toOptionalNumber(methodDraft.tempoEccentric)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    tempoEccentric: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Stretch"
              value={toOptionalNumber(methodDraft.tempoStretch)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    tempoStretch: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Concentric"
              value={toOptionalNumber(methodDraft.tempoConcentric)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    tempoConcentric: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
            <MetricInput
              label="Top"
              value={toOptionalNumber(methodDraft.tempoTop)}
              onChange={(value) =>
                onChange({
                  notes: buildMethodNote({
                    ...methodDraft,
                    tempoTop: value === undefined ? "" : `${value}`,
                  }),
                })
              }
            />
          </View>
        </View>
      ) : null}

      {methodDraft.method === "Custom" ? (
        <View style={styles.methodDetailCard}>
          <Text style={styles.editorLabel}>Custom method</Text>
          <TextInput
            value={methodDraft.customName}
            onChangeText={(value) =>
              onChange({ notes: buildMethodNote({ ...methodDraft, customName: value }) })
            }
            style={styles.editorInput}
            placeholder="Method name"
            placeholderTextColor="#9ea3ac"
          />
          <TextInput
            multiline
            value={methodDraft.customInstructions}
            onChangeText={(value) =>
              onChange({ notes: buildMethodNote({ ...methodDraft, customInstructions: value }) })
            }
            style={[styles.editorInput, styles.editorTextarea]}
            placeholder="Explain how this method works"
            placeholderTextColor="#9ea3ac"
          />
        </View>
      ) : null}

      <View style={styles.editorField}>
        <Text style={styles.editorLabel}>
          {methodDraft.method === "Standard" ? "Notes" : "Extra note"}
        </Text>
        <TextInput
          multiline
          value={methodDraft.freeform}
          onChangeText={(value) =>
            onChange({ notes: buildMethodNote({ ...methodDraft, freeform: value }) })
          }
          style={[styles.editorInput, styles.editorTextarea]}
          placeholder="Extra context, fatigue, cues..."
          placeholderTextColor="#9ea3ac"
        />
      </View>
    </View>
  );
}

function MetricInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <View style={styles.metricInputCard}>
      <Text style={styles.editorLabel}>{label}</Text>
      <TextInput
        value={typeof value === "number" ? `${value}` : ""}
        onChangeText={(nextValue) => {
          const normalized = nextValue.replace(",", ".").trim();
          if (!normalized) {
            onChange(undefined);
            return;
          }
          const parsed = Number(normalized);
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

function normalizeMode(value: string | string[] | undefined): WorkspaceMode | null {
  const current = Array.isArray(value) ? value[0] : value;
  if (current === "import_note" || current === "paste_workout" || current === "generate_from_scratch") {
    return current;
  }
  return null;
}

function buildCombinedInput(sourceText: string, userContext: string[]) {
  const base = sourceText.trim();
  const context = userContext.filter(Boolean).join("\n- ");

  if (!context) return base;
  if (!base) return `Additional context from the user:\n- ${context}`;

  return `${base}\n\nAdditional context from the user:\n- ${context}`;
}

function formatSavedWorkoutMeta(workout: ParsedWorkout) {
  const totalSets = workout.exercises.reduce(
    (sum, exercise) => sum + (exercise.sets ?? 0),
    0,
  );
  return `${totalSets} sets · ${workout.exercises.length} exercises`;
}

function formatSavedWorkoutTime(value?: string | null) {
  if (!value) return "Saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSavedWorkoutDay(value?: string | null) {
  if (!value) return "Saved workout";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toParsedWorkoutExercise(exercise: TrainingPlanDraft["weeks"][number]["days"][number]["exercises"][number]): ParsedWorkoutExercise {
  return {
    name: exercise.name,
    normalizedName: exercise.normalizedName ?? undefined,
    sets: exercise.sets,
    reps: exercise.repMin === exercise.repMax ? exercise.repMin : undefined,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    restSeconds: exercise.restSeconds,
    notes: exercise.notes ?? undefined,
    order: exercise.order,
  };
}

function fromParsedWorkoutExercise(
  current: TrainingPlanDraft["weeks"][number]["days"][number]["exercises"][number],
  patch: Partial<ParsedWorkoutExercise>,
) {
  return {
    ...current,
    name: patch.name ?? current.name,
    normalizedName: patch.normalizedName ?? current.normalizedName,
    sets: patch.sets ?? current.sets,
    repMin: patch.repMin ?? patch.reps ?? current.repMin,
    repMax: patch.repMax ?? patch.reps ?? current.repMax,
    restSeconds: patch.restSeconds ?? current.restSeconds,
    notes: patch.notes ?? current.notes,
  };
}

function inferMethodLabel(notes?: string) {
  const method = parseMethodDraft(notes).method;
  return method === "Standard" ? null : method;
}

function buildExerciseGroups(exercises: ParsedWorkoutExercise[]) {
  const groups: (
    | { type: "single"; exercise: ParsedWorkoutExercise; exerciseIndex: number }
    | {
        type: "pair";
        label: string;
        first: ParsedWorkoutExercise;
        second: ParsedWorkoutExercise;
        firstIndex: number;
        secondIndex: number;
      }
  )[] = [];

  let index = 0;
  while (index < exercises.length) {
    const current = exercises[index];
    const next = exercises[index + 1];
    const currentMethod = inferMethodLabel(current.notes);
    const currentDraft = parseMethodDraft(current.notes);
    const nextName = next?.name?.trim().toLowerCase();
    const pairName = currentDraft.pairName.trim().toLowerCase();
    const hasExplicitPairMatch = Boolean(next && pairName && nextName && pairName === nextName);
    const hasSupersetOnCurrent = currentMethod === "Superset";
    const pairLabel =
      hasExplicitPairMatch || hasSupersetOnCurrent ? "Superset" : null;

    if (pairLabel && next) {
      groups.push({
        type: "pair",
        label: pairLabel,
        first: current,
        second: next,
        firstIndex: index,
        secondIndex: index + 1,
      });
      index += 2;
      continue;
    }

    groups.push({ type: "single", exercise: current, exerciseIndex: index });
    index += 1;
  }

  return groups;
}

function resolveLinkedExerciseName(
  groups: ReturnType<typeof buildExerciseGroups>,
  exerciseIndex: number,
) {
  for (const group of groups) {
    if (group.type !== "pair") continue;
    if (group.firstIndex === exerciseIndex) return group.second.name;
    if (group.secondIndex === exerciseIndex) return group.first.name;
  }

  return undefined;
}

function formatWorkoutVolume(exercise: ParsedWorkoutExercise) {
  const methodDraft = parseMethodDraft(exercise.notes);
  if (methodDraft.repMode === "failure" && typeof exercise.sets === "number") {
    return `${exercise.sets} x failure`;
  }
  if (typeof exercise.sets === "number" && typeof exercise.reps === "number") {
    return `${exercise.sets} x ${exercise.reps}`;
  }
  if (
    typeof exercise.sets === "number" &&
    (typeof exercise.repMin === "number" || typeof exercise.repMax === "number")
  ) {
    return `${exercise.sets} x ${formatRepRange(exercise.repMin, exercise.repMax)}`;
  }
  if (typeof exercise.sets === "number") {
    return `${exercise.sets} sets`;
  }
  return "Needs review";
}

function formatRepRange(repMin?: number, repMax?: number) {
  if (typeof repMin === "number" && typeof repMax === "number") {
    return repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`;
  }
  if (typeof repMin === "number") return `${repMin}+`;
  if (typeof repMax === "number") return `${repMax}`;
  return "TBD";
}

function formatNumeric(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function hasCompleteTimeline(draft: MethodDraft) {
  return Boolean(
    draft.timelineDate.trim() &&
      draft.timelineWeek.trim() &&
      draft.timelineMonth.trim(),
  );
}

function getTimelineOptions(field: TimelineField) {
  if (field === "day") {
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }
  if (field === "week") {
    return ["Week 0", "Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8"];
  }
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

function buildMethodPreview(draft: MethodDraft) {
  if (draft.method === "Superset") {
    const pairParts = [draft.pairName || null, draft.pairReps ? `${draft.pairReps} reps` : null].filter(Boolean);
    return pairParts.length ? `Superset with ${pairParts.join(" · ")}` : "Superset";
  }
  if (draft.method === "Drop set") {
    return draft.dropWeights.trim() ? `Drop set: ${draft.dropWeights}` : "Drop set";
  }
  if (draft.method === "Rest-pause") {
    const parts = [
      draft.restPauseSeconds ? `${draft.restPauseSeconds}s pauses` : null,
      draft.restPauseMiniSets ? `${draft.restPauseMiniSets} mini-sets` : null,
    ].filter(Boolean);
    return parts.length ? `Rest-pause: ${parts.join(" · ")}` : "Rest-pause";
  }
  if (draft.method === "Myo-reps") {
    const parts = [
      draft.myoActivationReps ? `activation ${draft.myoActivationReps}` : null,
      draft.myoMiniReps ? `mini reps ${draft.myoMiniReps}` : null,
      draft.myoRounds ? `${draft.myoRounds} rounds` : null,
    ].filter(Boolean);
    return parts.length ? `Myo-reps: ${parts.join(" · ")}` : "Myo-reps";
  }
  if (draft.method === "Tempo") {
    const tempo = [
      draft.tempoEccentric,
      draft.tempoStretch,
      draft.tempoConcentric,
      draft.tempoTop,
    ].filter(Boolean);
    return tempo.length ? `Tempo: ${tempo.join("-")}` : "Tempo";
  }
  if (draft.method === "Custom") {
    return draft.customName || "Custom method";
  }
  return null;
}

function buildTimelinePreview(draft: MethodDraft) {
  const parts = [
    draft.timelineDate ? draft.timelineDate : null,
    draft.timelineWeek ? draft.timelineWeek : null,
    draft.timelineMonth ? draft.timelineMonth : null,
  ].filter(Boolean);

  return parts.length ? `Timeline: ${parts.join(" · ")}` : null;
}

function parseMethodDraft(notes?: string): MethodDraft {
  const base: MethodDraft = {
    method: "Standard",
    targetArea: "",
    repMode: "standard",
    freeform: "",
    timelineDate: "",
    timelineWeek: "",
    timelineMonth: "",
    pairName: "",
    pairReps: "",
    pairWeight: "",
    dropWeights: "",
    restPauseSeconds: "",
    restPauseMiniSets: "",
    myoActivationReps: "",
    myoMiniReps: "",
    myoRounds: "",
    myoRestSeconds: "",
    tempoEccentric: "",
    tempoStretch: "",
    tempoConcentric: "",
    tempoTop: "",
    customName: "",
    customInstructions: "",
  };

  const raw = notes?.trim() ?? "";
  if (!raw) return base;

  if (raw.startsWith("method=")) {
    const [meta, freeform = ""] = raw.split("||");
    const pairs = meta
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const pair of pairs) {
      const [key, ...rest] = pair.split("=");
      const value = rest.join("=").trim();
      if (!key || !value) continue;
      if (key === "method" && exerciseMethods.includes(value as ExerciseMethod)) {
        base.method = value as ExerciseMethod;
      }
      if (key === "pairName") base.pairName = value;
      if (key === "pairReps") base.pairReps = value;
      if (key === "pairWeight") base.pairWeight = value;
      if (key === "targetArea") base.targetArea = value;
      if (key === "repMode" && (value === "standard" || value === "failure")) base.repMode = value;
      if (key === "timelineDate") base.timelineDate = value;
      if (key === "timelineWeek") base.timelineWeek = value;
      if (key === "timelineMonth") base.timelineMonth = value;
      if (key === "dropWeights") base.dropWeights = value.replaceAll("|", ", ");
      if (key === "restPauseSeconds") base.restPauseSeconds = value;
      if (key === "restPauseMiniSets") base.restPauseMiniSets = value;
      if (key === "myoActivationReps") base.myoActivationReps = value;
      if (key === "myoMiniReps") base.myoMiniReps = value;
      if (key === "myoRounds") base.myoRounds = value;
      if (key === "myoRestSeconds") base.myoRestSeconds = value;
      if (key === "tempoEccentric") base.tempoEccentric = value;
      if (key === "tempoStretch") base.tempoStretch = value;
      if (key === "tempoConcentric") base.tempoConcentric = value;
      if (key === "tempoTop") base.tempoTop = value;
      if (key === "customName") base.customName = value;
      if (key === "customInstructions") base.customInstructions = value;
    }

    base.freeform = freeform.trim();
    return base;
  }

  base.freeform = raw;
  const lower = raw.toLowerCase();
  if (/(super ?set|superset)/.test(lower)) base.method = "Superset";
  else if (/drop ?set|dropset/.test(lower)) base.method = "Drop set";
  else if (/rest[- ]?pause/.test(lower)) base.method = "Rest-pause";
  else if (/myo/.test(lower)) base.method = "Myo-reps";
  else if (/tempo/.test(lower)) base.method = "Tempo";
  else if (/custom|cluster|circuit|giant set|triset/.test(lower)) base.method = "Custom";
  if (/\b(echec|échec|failure)\b/.test(lower)) base.repMode = "failure";

  return base;
}

function buildMethodNote(draft: MethodDraft) {
  const hasMetadata =
    draft.timelineDate.trim() ||
    draft.timelineWeek.trim() ||
    draft.timelineMonth.trim() ||
    draft.targetArea.trim() ||
    draft.repMode === "failure";

  if (draft.method === "Standard" && !hasMetadata) {
    return draft.freeform.trim();
  }

  const parts = [`method=${draft.method}`];

  if (draft.timelineDate.trim()) parts.push(`timelineDate=${draft.timelineDate.trim()}`);
  if (draft.timelineWeek.trim()) parts.push(`timelineWeek=${draft.timelineWeek.trim()}`);
  if (draft.timelineMonth.trim()) parts.push(`timelineMonth=${draft.timelineMonth.trim()}`);
  if (draft.targetArea.trim()) parts.push(`targetArea=${draft.targetArea.trim()}`);
  if (draft.repMode === "failure") parts.push("repMode=failure");

  if (draft.method === "Superset") {
    if (draft.pairName.trim()) parts.push(`pairName=${draft.pairName.trim()}`);
    if (draft.pairReps.trim()) parts.push(`pairReps=${draft.pairReps.trim()}`);
    if (draft.pairWeight.trim()) parts.push(`pairWeight=${draft.pairWeight.trim()}`);
  }

  if (draft.method === "Drop set" && draft.dropWeights.trim()) {
    parts.push(`dropWeights=${draft.dropWeights.split(",").map((value) => value.trim()).filter(Boolean).join("|")}`);
  }

  if (draft.method === "Rest-pause") {
    if (draft.restPauseSeconds.trim()) parts.push(`restPauseSeconds=${draft.restPauseSeconds.trim()}`);
    if (draft.restPauseMiniSets.trim()) parts.push(`restPauseMiniSets=${draft.restPauseMiniSets.trim()}`);
  }

  if (draft.method === "Myo-reps") {
    if (draft.myoActivationReps.trim()) parts.push(`myoActivationReps=${draft.myoActivationReps.trim()}`);
    if (draft.myoMiniReps.trim()) parts.push(`myoMiniReps=${draft.myoMiniReps.trim()}`);
    if (draft.myoRounds.trim()) parts.push(`myoRounds=${draft.myoRounds.trim()}`);
    if (draft.myoRestSeconds.trim()) parts.push(`myoRestSeconds=${draft.myoRestSeconds.trim()}`);
  }

  if (draft.method === "Tempo") {
    if (draft.tempoEccentric.trim()) parts.push(`tempoEccentric=${draft.tempoEccentric.trim()}`);
    if (draft.tempoStretch.trim()) parts.push(`tempoStretch=${draft.tempoStretch.trim()}`);
    if (draft.tempoConcentric.trim()) parts.push(`tempoConcentric=${draft.tempoConcentric.trim()}`);
    if (draft.tempoTop.trim()) parts.push(`tempoTop=${draft.tempoTop.trim()}`);
  }

  if (draft.method === "Custom") {
    if (draft.customName.trim()) parts.push(`customName=${draft.customName.trim()}`);
    if (draft.customInstructions.trim()) {
      parts.push(`customInstructions=${draft.customInstructions.trim().replaceAll(";", ",")}`);
    }
  }

  return draft.freeform.trim()
    ? `${parts.join("; ")} || ${draft.freeform.trim()}`
    : parts.join("; ");
}

function toOptionalNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function modeTitle(mode: WorkspaceMode | null) {
  if (!mode) return "What do you want to build?";
  if (mode === "import_note") return "Paste your note, then add context if needed";
  if (mode === "paste_workout") return "Paste your workout, then tell me anything important";
  return "I can build the plan from your profile, plus any context you add";
}

function buildSchedulePatch(field: TimelineField, option: string) {
  if (field === "day") return { day: option };
  if (field === "week") return { week: option };
  return { month: option };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  container: {
    flex: 1,
    margin: 10,
    borderRadius: 26,
    backgroundColor: "#fcf8f7",
    borderWidth: 1,
    borderColor: "#eee4e3",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
  },
  chatScrollContent: {
    paddingBottom: 16,
    gap: 16,
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
  assistantPill: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#efe6e8",
    backgroundColor: "#fffaf9",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assistantPillOrb: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#9c7bff",
    shadowColor: "#ff7dc2",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  assistantPillText: {
    fontFamily: Fonts.serif,
    ...Typography.caption,
    color: "#352f3f",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  heroBlock: {
    alignItems: "center",
    paddingTop: 10,
    gap: 10,
  },
  heroGreeting: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#241f2d",
    fontWeight: "700",
  },
  heroQuestion: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#1f1a28",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 42,
  },
  orbWrap: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  orbGlowOne: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "#7f63ff",
    opacity: 0.45,
    transform: [{ translateX: -10 }, { translateY: 10 }],
  },
  orbGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "#ff92cb",
    opacity: 0.45,
    transform: [{ translateX: 14 }, { translateY: -12 }],
  },
  orbCore: {
    width: 138,
    height: 138,
    borderRadius: 999,
    backgroundColor: "#d4ecff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  sourcePreviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee3e4",
    backgroundColor: "#fffdfc",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  sourcePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  flowSwitchButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e3d9dc",
    backgroundColor: "#fff7f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  flowSwitchButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5a5360",
    fontWeight: "700",
  },
  sectionLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  choiceList: {
    gap: 10,
  },
  choiceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee3e4",
    backgroundColor: "#fffdfc",
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  choiceCardCopy: {
    flex: 1,
    gap: 4,
  },
  choiceCardTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#191620",
    fontWeight: "700",
  },
  choiceCardBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6a7079",
    lineHeight: 20,
  },
  choiceCardChevron: {
    fontFamily: Fonts.sans,
    fontSize: 28,
    lineHeight: 28,
    color: "#9ea3ac",
  },
  sourcePreviewText: {
    fontFamily: Fonts.mono,
    ...Typography.bodySmall,
    color: "#443f49",
    lineHeight: 21,
  },
  messageList: {
    gap: 10,
  },
  messageBubble: {
    maxWidth: "88%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#f6edee",
    borderTopLeftRadius: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#16131b",
    borderTopRightRadius: 8,
  },
  messageText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    lineHeight: 21,
  },
  assistantText: {
    color: "#20242b",
  },
  userText: {
    color: "#f5f7fa",
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee3e4",
    backgroundColor: "#fffdfc",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  resultEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  resultTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#151920",
    fontWeight: "700",
  },
  resultBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#69707a",
  },
  resultList: {
    gap: 8,
  },
  planPreviewCopy: {
    flex: 1,
    gap: 2,
  },
  planPreviewBackRow: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd3d5",
    backgroundColor: "#fff7f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planPreviewBackText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#252a33",
    fontWeight: "700",
  },
  planPreviewHeaderCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0ece5",
    backgroundColor: "#fffaf7",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  planPreviewDayTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  planPreviewExerciseItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0ece5",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  planPreviewExerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#161a22",
    fontWeight: "700",
  },
  exerciseGroupWrap: {
    gap: 8,
  },
  resultItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
    position: "relative",
  },
  resultItemActive: {
    borderColor: "#8fa9ff",
    backgroundColor: "#f8fbff",
  },
  resultItemDragPending: {
    borderColor: "#c4942f",
    backgroundColor: "#fff8ea",
  },
  linkedExerciseGroup: {
    gap: 2,
    alignItems: "center",
  },
  linkedExerciseItem: {
    width: "100%",
    borderStyle: "dashed",
  },
  groupConnector: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  groupConnectorLine: {
    width: 2,
    height: 18,
    backgroundColor: "#dad0e8",
  },
  groupMethodBadge: {
    borderRadius: 14,
    backgroundColor: "#d9efff",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupMethodBadgeText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#235b8d",
    fontWeight: "700",
  },
  exerciseHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  exerciseHeaderLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  selectBullet: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#c9ced6",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  selectBulletActive: {
    borderColor: "#1d2a44",
    backgroundColor: "#e9eef9",
  },
  selectBulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1d2a44",
  },
  exerciseMethodChip: {
    borderRadius: 999,
    backgroundColor: "#eef5ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exerciseMethodChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#4d6495",
    fontWeight: "700",
  },
  exerciseSupportText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#747b85",
  },
  timelineChipRow: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timelineChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9dbe0",
    backgroundColor: "#f7f8fa",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timelineChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#535a65",
    fontWeight: "700",
  },
  exerciseTapHint: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9ea3ac",
  },
  exerciseDeleteInline: {
    position: "absolute",
    right: 44,
    top: 12,
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1ef",
    borderWidth: 1,
    borderColor: "#f0d5d0",
  },
  exerciseChevron: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -12,
    fontFamily: Fonts.sans,
    fontSize: 30,
    lineHeight: 24,
    color: "#9ea3ac",
  },
  resultItemTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  resultItemMeta: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#747b85",
  },
  resultActions: {
    paddingTop: 4,
  },
  timelinePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  timelinePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 18, 0.35)",
  },
  timelinePickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#f9f7f7",
    borderTopWidth: 1,
    borderColor: "#e6e0e2",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 12,
  },
  timelinePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timelinePickerTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#171b22",
    fontWeight: "700",
  },
  timelinePickerClose: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#636a74",
    fontWeight: "700",
  },
  timelinePickerOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timelinePickerOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timelinePickerOptionText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#3f4550",
    fontWeight: "700",
  },
  savePromptOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  savePromptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 18, 0.38)",
  },
  savePromptCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6e0e2",
    backgroundColor: "#fcf8f7",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  savePromptTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#171b22",
    fontWeight: "700",
  },
  savePromptBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#717782",
  },
  savePromptInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd9df",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#232832",
  },
  savePromptActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savePromptCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4d8df",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  savePromptCancelText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#4e5562",
    fontWeight: "700",
  },
  savePromptSave: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#17141f",
    alignItems: "center",
    justifyContent: "center",
  },
  savePromptSaveText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  resultHint: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#747b85",
  },
  resultPrimaryAction: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#15121c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  resultPrimaryActionDone: {
    backgroundColor: "#2f6b44",
  },
  resultPrimaryActionDisabled: {
    opacity: 0.7,
  },
  resultPrimaryActionText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  editorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ece3e6",
    backgroundColor: "#fffaf9",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  editorTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#191620",
    fontWeight: "700",
  },
  editorField: {
    gap: 6,
  },
  editorLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  editorInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6dde1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#2d2736",
  },
  editorTextarea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  editorMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  failureMetricCard: {
    minWidth: 140,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1d8dd",
    backgroundColor: "#f8f4f5",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  failureMetricValue: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  methodChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  methodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd5df",
    backgroundColor: "#f7f4f7",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  methodChipActive: {
    backgroundColor: "#15121c",
    borderColor: "#15121c",
  },
  methodChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#585160",
    fontWeight: "700",
  },
  methodChipTextActive: {
    color: "#f5f7fa",
  },
  methodDetailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece3e6",
    backgroundColor: "#fffdfc",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  editorHint: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
  },
  metricInputCard: {
    minWidth: 132,
    flex: 1,
    gap: 6,
  },
  metricInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6dde1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#2d2736",
  },
  exerciseDetailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(252, 248, 247, 0.96)",
  },
  exerciseDetailShell: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  exerciseDetailHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseDetailBack: {
    minWidth: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9dbdf",
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  planDetailBackStrong: {
    borderColor: "#cfc5c8",
    backgroundColor: "#fffaf7",
  },
  exerciseDetailBackText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#2a2d34",
    fontWeight: "700",
  },
  exerciseDetailHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#151920",
    fontWeight: "700",
  },
  exerciseDetailHeaderSpacer: {
    width: 42,
    height: 42,
  },
  exerciseDetailContent: {
    paddingBottom: 24,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4b4ac",
    backgroundColor: "#fff4f1",
    padding: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#a23b2f",
  },
  composerShell: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe6e8",
  },
  composerBar: {
    minHeight: 62,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#efe3e5",
    backgroundColor: "#fffdfc",
    paddingLeft: 8,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectionModeBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectionModeCancel: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d3d6db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionModeCancelText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#404652",
    fontWeight: "700",
  },
  selectionModeValidate: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#17141f",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionModeValidateText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  composerAccessory: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#f5eef1",
    alignItems: "center",
    justifyContent: "center",
  },
  composerAccessoryText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#43384f",
    fontWeight: "700",
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
    paddingRight: 4,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#2d2736",
  },
  composerSendButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#f2eaff",
    borderWidth: 1,
    borderColor: "#eadffd",
    alignItems: "center",
    justifyContent: "center",
  },
  composerSendText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#43384f",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.9,
  },
});
