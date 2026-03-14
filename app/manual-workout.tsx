import { useEffect, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import type { ParsedWorkout, ParsedWorkoutExercise, RecommendationDraft } from "@/lib/ai-types";
import { generateNextWorkout, getAiContext, saveParsedWorkout, toAiUserProfile } from "@/lib/ai-api";

const sessionTypePresets = [
  "Upper",
  "Lower",
  "Push",
  "Pull",
  "Legs",
  "Back",
  "Chest",
  "Arms",
  "Shoulders",
  "Custom",
] as const;

const exerciseMethods = ["Standard", "Superset", "Drop set", "Rest-pause", "Myo-reps", "Tempo", "Custom"] as const;

type SessionTypePreset = (typeof sessionTypePresets)[number];
type ExerciseMethod = (typeof exerciseMethods)[number];

type ManualExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  restSeconds: number;
  method: ExerciseMethod;
  methodDetails: string;
  dropSetWeights: number[];
  restPauseSeconds: number;
  restPauseMiniSets: number;
  myoActivationReps: number;
  myoMiniReps: number;
  myoRounds: number;
  myoRestSeconds: number;
  tempoEccentric: number;
  tempoStretch: number;
  tempoConcentric: number;
  tempoTop: number;
  customMethodName: string;
  customTargetReps: number;
  customRestSeconds: number;
  customInstructions: string;
  pairedExerciseName: string;
  pairedReps: number;
  pairedWeight: number;
};

const starterExercises: ManualExercise[] = [
  {
    id: "exercise-1",
    name: "",
    sets: 3,
    reps: 8,
    weight: 0,
    restSeconds: 90,
    method: "Standard",
    methodDetails: "",
    dropSetWeights: [],
    restPauseSeconds: 20,
    restPauseMiniSets: 3,
    myoActivationReps: 15,
    myoMiniReps: 4,
    myoRounds: 3,
    myoRestSeconds: 15,
    tempoEccentric: 3,
    tempoStretch: 1,
    tempoConcentric: 1,
    tempoTop: 0,
    customMethodName: "",
    customTargetReps: 8,
    customRestSeconds: 30,
    customInstructions: "",
    pairedExerciseName: "",
    pairedReps: 10,
    pairedWeight: 0,
  },
];

export default function ManualWorkoutScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sessionTypePreset, setSessionTypePreset] = useState<SessionTypePreset>("Upper");
  const [customSessionType, setCustomSessionType] = useState("");
  const [title, setTitle] = useState("Upper");
  const [weekLabel, setWeekLabel] = useState("Week 1");
  const [performedAt, setPerformedAt] = useState("");
  const [exercises, setExercises] = useState<ManualExercise[]>(starterExercises);
  const [latestWorkoutId, setLatestWorkoutId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationDraft | null>(null);
  const [userProfile, setUserProfile] = useState<unknown>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<unknown[]>([]);
  const [loadingAction, setLoadingAction] = useState<"bootstrap" | "save" | "generate" | null>("bootstrap");
  const [error, setError] = useState<string | null>(null);

  const effectiveSessionType =
    sessionTypePreset === "Custom" ? customSessionType.trim() || "Custom" : sessionTypePreset;

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const result = await getAiContext();
        if (cancelled) return;

        setUserProfile(toAiUserProfile(result.user));
        setRecentWorkouts(result.recentWorkouts);
        setLatestWorkoutId(result.latestWorkoutId);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load context");
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

  const parsedWorkout = useMemo<ParsedWorkout>(
    () => ({
      title,
      sessionType: effectiveSessionType.toLowerCase(),
      performedAt: performedAt || undefined,
      cleanedSummary: `${effectiveSessionType} session added manually.`,
      exercises: exercises
        .filter((exercise) => exercise.name.trim())
        .map<ParsedWorkoutExercise>((exercise, index) => ({
          name: exercise.name.trim(),
          order: index,
          sets: exercise.sets,
          reps: exercise.reps,
          repMin: exercise.reps,
          repMax: exercise.reps,
          weight: exercise.weight || undefined,
          restSeconds: exercise.restSeconds,
          unit: exercise.weight ? "kg" : undefined,
          notes: buildExerciseMethodNote(exercise),
          rawLine: buildExerciseRawLine(exercise),
        })),
    }),
    [effectiveSessionType, exercises, performedAt, title],
  );

  function updateExercise(exerciseId: string, patch: Partial<ManualExercise>) {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    );
  }

  function addExercise() {
    setExercises((current) => [
      ...current,
      {
        id: `exercise-${current.length + 1}`,
        name: "",
        sets: 3,
        reps: 10,
        weight: 0,
        restSeconds: 90,
        method: "Standard",
        methodDetails: "",
        dropSetWeights: [],
        restPauseSeconds: 20,
        restPauseMiniSets: 3,
        myoActivationReps: 15,
        myoMiniReps: 4,
        myoRounds: 3,
        myoRestSeconds: 15,
        tempoEccentric: 3,
        tempoStretch: 1,
        tempoConcentric: 1,
        tempoTop: 0,
        customMethodName: "",
        customTargetReps: 8,
        customRestSeconds: 30,
        customInstructions: "",
        pairedExerciseName: "",
        pairedReps: 10,
        pairedWeight: 0,
      },
    ]);
  }

  function updateDropSetWeight(exerciseId: string, weightIndex: number, nextWeight: number) {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        return {
          ...exercise,
          dropSetWeights: exercise.dropSetWeights.map((weight, index) =>
            index === weightIndex ? nextWeight : weight,
          ),
        };
      }),
    );
  }

  function addDropSetWeight(exerciseId: string) {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const seedWeight = exercise.dropSetWeights[exercise.dropSetWeights.length - 1] ?? exercise.weight ?? 0;
        return {
          ...exercise,
          dropSetWeights: [...exercise.dropSetWeights, seedWeight],
        };
      }),
    );
  }

  function removeDropSetWeight(exerciseId: string, weightIndex: number) {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        return {
          ...exercise,
          dropSetWeights: exercise.dropSetWeights.filter((_, index) => index !== weightIndex),
        };
      }),
    );
  }

  async function handleSaveWorkout() {
    if (!parsedWorkout.exercises.length) {
      setError("Add at least one exercise before saving this session.");
      return;
    }

    setError(null);
    setLoadingAction("save");
    try {
      const result = await saveParsedWorkout({
        rawText: [weekLabel, effectiveSessionType, ...parsedWorkout.exercises.map((exercise) => exercise.rawLine ?? exercise.name)].join("\n"),
        parsedWorkout,
      });
      setLatestWorkoutId(result.workoutId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save workout");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGenerateWorkout() {
    if (!latestWorkoutId && !parsedWorkout.exercises.length) {
      setError("Finish the workout first before generating the next one.");
      return;
    }

    setError(null);
    setLoadingAction("generate");
    try {
      const result = await generateNextWorkout({
        userProfile,
        recentWorkouts,
        latestWorkout: parsedWorkout,
        constraints: { availableMinutes: 45 },
        basedOnWorkoutId: latestWorkoutId ?? undefined,
      });
      setRecommendation(result.recommendation);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to generate next workout");
    } finally {
      setLoadingAction(null);
    }
  }

  function handleSelectSessionType(nextType: SessionTypePreset) {
    const previousType = effectiveSessionType;
    setSessionTypePreset(nextType);
    if (nextType !== "Custom") {
      setCustomSessionType("");
    }
    if (!title.trim() || title === previousType) {
      setTitle(nextType === "Custom" ? "" : nextType);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.backTap, pressed && styles.pressed]}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.title}>Manual workout</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.stepTitle}>Step {step + 1} of 3</Text>
          <Text style={styles.stepBody}>
            {step === 0 && "Choose the session type and basic context."}
            {step === 1 &&
              "Add the exercises. Sets and reps stay on steppers, but load and rest are typed directly for faster editing."}
            {step === 2 && "Review the workout, save it, then generate the next one."}
          </Text>

          {step === 0 ? (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Session type</Text>
              <View style={styles.chipRow}>
                {sessionTypePresets.map((tag) => (
                  <Pressable
                    key={tag}
                    style={[styles.chip, sessionTypePreset === tag && styles.chipActive]}
                    onPress={() => handleSelectSessionType(tag)}
                  >
                    <Text style={[styles.chipText, sessionTypePreset === tag && styles.chipTextActive]}>{tag}</Text>
                  </Pressable>
                ))}
              </View>

              {sessionTypePreset === "Custom" ? (
                <>
                  <Text style={styles.fieldLabel}>Custom type</Text>
                  <TextInput
                    value={customSessionType}
                    onChangeText={setCustomSessionType}
                    style={styles.input}
                    placeholder="Full body, Arms + delts..."
                    placeholderTextColor="#9ea3ac"
                  />
                </>
              ) : null}

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                placeholder="Upper A"
                placeholderTextColor="#9ea3ac"
              />

              <Text style={styles.fieldHint}>
                Use a base split above, then rename the title freely if you want something more specific.
              </Text>

              <Text style={styles.fieldLabel}>Week</Text>
              <TextInput
                value={weekLabel}
                onChangeText={setWeekLabel}
                style={styles.input}
                placeholder="Week 1"
                placeholderTextColor="#9ea3ac"
              />

              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                value={performedAt}
                onChangeText={setPerformedAt}
                style={styles.input}
                placeholder="2026-03-12"
                placeholderTextColor="#9ea3ac"
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.card}>
              <View style={styles.exerciseList}>
                {exercises.map((exercise, index) => (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseIndex}>Exercise {index + 1}</Text>
                    <TextInput
                      value={exercise.name}
                      onChangeText={(name) => updateExercise(exercise.id, { name })}
                      style={styles.input}
                      placeholder="Hack squat"
                      placeholderTextColor="#9ea3ac"
                    />
                    {exercise.method === "Superset" ? (
                      <View style={styles.exerciseList}>
                        <View style={styles.sharedSetsCard}>
                          <Stepper
                            label="Shared sets"
                            value={exercise.sets}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { sets: value })}
                          />
                          <Text style={styles.metricHint}>Applied to both exercises in the superset.</Text>
                        </View>
                        <Stepper
                          label="Main reps"
                          value={exercise.reps}
                          step={1}
                          onChange={(value) => updateExercise(exercise.id, { reps: value })}
                        />
                      </View>
                    ) : (
                      <View style={styles.metricGrid}>
                        <Stepper
                          label="Sets"
                          value={exercise.sets}
                          step={1}
                          onChange={(value) => updateExercise(exercise.id, { sets: value })}
                        />
                        <Stepper
                          label="Reps"
                          value={exercise.reps}
                          step={1}
                          onChange={(value) => updateExercise(exercise.id, { reps: value })}
                        />
                      </View>
                    )}

                    <View style={styles.metricGrid}>
                      <View style={styles.textMetricCard}>
                        <Text style={styles.fieldLabel}>Weight</Text>
                        <TextInput
                          value={exercise.weight ? formatNumeric(exercise.weight) : ""}
                          onChangeText={(value) => updateExercise(exercise.id, { weight: parseDecimalInput(value) })}
                          style={styles.metricInput}
                          placeholder="42.50"
                          placeholderTextColor="#9ea3ac"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View
                        style={[
                          styles.textMetricCard,
                          exercise.method === "Superset" && styles.sharedRestCard,
                        ]}
                      >
                        <Text style={styles.fieldLabel}>
                          {exercise.method === "Superset" ? "Shared rest" : "Rest"}
                        </Text>
                        <TextInput
                          value={exercise.restSeconds ? `${exercise.restSeconds}` : ""}
                          onChangeText={(value) =>
                            updateExercise(exercise.id, { restSeconds: parseIntegerInput(value) })
                          }
                          style={styles.metricInput}
                          placeholder="90"
                          placeholderTextColor="#9ea3ac"
                          keyboardType="number-pad"
                        />
                        {exercise.method === "Superset" ? (
                          <Text style={styles.metricHint}>This rest time is used for both exercises.</Text>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.fieldLabel}>Method</Text>
                    <View style={styles.chipRow}>
                      {exerciseMethods.map((method) => (
                        <Pressable
                          key={`${exercise.id}-${method}`}
                          style={[styles.chip, exercise.method === method && styles.chipActive]}
                          onPress={() => updateExercise(exercise.id, { method })}
                        >
                          <Text style={[styles.chipText, exercise.method === method && styles.chipTextActive]}>
                            {method}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {exercise.method === "Superset" ? (
                      <View style={styles.supersetCard}>
                        <Text style={styles.supersetTitle}>Paired exercise</Text>
                        <TextInput
                          value={exercise.pairedExerciseName}
                          onChangeText={(pairedExerciseName) =>
                            updateExercise(exercise.id, { pairedExerciseName })
                          }
                          style={styles.input}
                          placeholder="Cable fly"
                          placeholderTextColor="#9ea3ac"
                        />
                        <View style={styles.metricGrid}>
                          <Stepper
                            label="Pair reps"
                            value={exercise.pairedReps}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { pairedReps: value })}
                          />
                        </View>
                        <View style={styles.textMetricCard}>
                          <Text style={styles.fieldLabel}>Pair weight</Text>
                          <TextInput
                            value={exercise.pairedWeight ? formatNumeric(exercise.pairedWeight) : ""}
                            onChangeText={(value) =>
                              updateExercise(exercise.id, { pairedWeight: parseDecimalInput(value) })
                            }
                            style={styles.metricInput}
                            placeholder="20.00"
                            placeholderTextColor="#9ea3ac"
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <Text style={styles.metricHint}>
                          Sets and rest are shared across both exercises. Reps and load can differ.
                        </Text>
                      </View>
                    ) : null}

                    {exercise.method === "Drop set" ? (
                      <View style={styles.dropSetCard}>
                        <Text style={styles.supersetTitle}>Drop weights</Text>
                        <Text style={styles.metricHint}>
                          Keep the main weight above as the first effort, then add each drop stage below.
                        </Text>
                        <View style={styles.exerciseList}>
                          {exercise.dropSetWeights.map((weight, weightIndex) => (
                            <View key={`${exercise.id}-drop-${weightIndex}`} style={styles.dropSetRow}>
                              <Text style={styles.dropSetLabel}>Drop {weightIndex + 1}</Text>
                              <View style={styles.dropSetControls}>
                                <Pressable
                                  style={styles.iconButton}
                                  onPress={() =>
                                    updateDropSetWeight(
                                      exercise.id,
                                      weightIndex,
                                      Math.max(0, roundStep(weight - 2.5)),
                                    )
                                  }
                                >
                                  <Text style={styles.iconButtonText}>-</Text>
                                </Pressable>
                                <TextInput
                                  value={weight ? formatNumeric(weight) : ""}
                                  onChangeText={(value) =>
                                    updateDropSetWeight(exercise.id, weightIndex, parseDecimalInput(value))
                                  }
                                  style={styles.dropSetInput}
                                  placeholder="20.00"
                                  placeholderTextColor="#9ea3ac"
                                  keyboardType="decimal-pad"
                                />
                                <Pressable
                                  style={styles.iconButton}
                                  onPress={() =>
                                    updateDropSetWeight(exercise.id, weightIndex, roundStep(weight + 2.5))
                                  }
                                >
                                  <Text style={styles.iconButtonText}>+</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.trashButton}
                                  onPress={() => removeDropSetWeight(exercise.id, weightIndex)}
                                >
                                  <Text style={styles.trashButtonText}>×</Text>
                                </Pressable>
                              </View>
                            </View>
                          ))}
                        </View>
                        <Pressable style={styles.secondaryButton} onPress={() => addDropSetWeight(exercise.id)}>
                          <Text style={styles.secondaryButtonText}>Add drop weight</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {exercise.method === "Rest-pause" ? (
                      <View style={styles.methodCard}>
                        <Text style={styles.supersetTitle}>Rest-pause setup</Text>
                        <View style={styles.metricGrid}>
                          <View style={styles.textMetricCard}>
                            <Text style={styles.fieldLabel}>Pause seconds</Text>
                            <TextInput
                              value={`${exercise.restPauseSeconds}`}
                              onChangeText={(value) =>
                                updateExercise(exercise.id, { restPauseSeconds: parseIntegerInput(value) })
                              }
                              style={styles.metricInput}
                              placeholder="20"
                              placeholderTextColor="#9ea3ac"
                              keyboardType="number-pad"
                            />
                          </View>
                          <Stepper
                            label="Mini-sets"
                            value={exercise.restPauseMiniSets}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { restPauseMiniSets: value })}
                          />
                        </View>
                      </View>
                    ) : null}

                    {exercise.method === "Myo-reps" ? (
                      <View style={styles.methodCard}>
                        <Text style={styles.supersetTitle}>Myo-reps setup</Text>
                        <View style={styles.metricGrid}>
                          <Stepper
                            label="Activation reps"
                            value={exercise.myoActivationReps}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { myoActivationReps: value })}
                          />
                          <Stepper
                            label="Mini reps"
                            value={exercise.myoMiniReps}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { myoMiniReps: value })}
                          />
                        </View>
                        <View style={styles.metricGrid}>
                          <Stepper
                            label="Rounds"
                            value={exercise.myoRounds}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { myoRounds: value })}
                          />
                          <View style={styles.textMetricCard}>
                            <Text style={styles.fieldLabel}>Rest seconds</Text>
                            <TextInput
                              value={`${exercise.myoRestSeconds}`}
                              onChangeText={(value) =>
                                updateExercise(exercise.id, { myoRestSeconds: parseIntegerInput(value) })
                              }
                              style={styles.metricInput}
                              placeholder="15"
                              placeholderTextColor="#9ea3ac"
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {exercise.method === "Tempo" ? (
                      <View style={styles.methodCard}>
                        <Text style={styles.supersetTitle}>Tempo</Text>
                        <View style={styles.metricGrid}>
                          <Stepper
                            label="Eccentric"
                            value={exercise.tempoEccentric}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { tempoEccentric: value })}
                          />
                          <Stepper
                            label="Stretch"
                            value={exercise.tempoStretch}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { tempoStretch: value })}
                          />
                        </View>
                        <View style={styles.metricGrid}>
                          <Stepper
                            label="Concentric"
                            value={exercise.tempoConcentric}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { tempoConcentric: value })}
                          />
                          <Stepper
                            label="Top hold"
                            value={exercise.tempoTop}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { tempoTop: value })}
                          />
                        </View>
                      </View>
                    ) : null}

                    {exercise.method === "Custom" ? (
                      <View style={styles.methodCard}>
                        <Text style={styles.supersetTitle}>Advanced custom method</Text>
                        <View style={styles.inlineInputRow}>
                          <TextInput
                            value={exercise.customMethodName}
                            onChangeText={(customMethodName) =>
                              updateExercise(exercise.id, { customMethodName })
                            }
                            style={[styles.input, styles.inlineInput]}
                            placeholder="Cluster set"
                            placeholderTextColor="#9ea3ac"
                          />
                          {exercise.customMethodName ? (
                            <Pressable
                              style={styles.trashButton}
                              onPress={() => updateExercise(exercise.id, { customMethodName: "" })}
                            >
                              <Text style={styles.trashButtonText}>×</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        <View style={styles.metricGrid}>
                          <Stepper
                            label="Sets"
                            value={exercise.sets}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { sets: value })}
                          />
                          <Stepper
                            label="Target reps"
                            value={exercise.customTargetReps}
                            step={1}
                            onChange={(value) => updateExercise(exercise.id, { customTargetReps: value })}
                          />
                        </View>
                        <View style={styles.inlineInputRow}>
                          <View style={[styles.textMetricCard, styles.inlineMetricCard]}>
                            <Text style={styles.fieldLabel}>Rest seconds</Text>
                            <TextInput
                              value={exercise.customRestSeconds ? `${exercise.customRestSeconds}` : ""}
                              onChangeText={(value) =>
                                updateExercise(exercise.id, { customRestSeconds: parseIntegerInput(value) })
                              }
                              style={styles.metricInput}
                              placeholder="30"
                              placeholderTextColor="#9ea3ac"
                              keyboardType="number-pad"
                            />
                          </View>
                          {exercise.customRestSeconds > 0 ? (
                            <Pressable
                              style={styles.trashButton}
                              onPress={() => updateExercise(exercise.id, { customRestSeconds: 0 })}
                            >
                              <Text style={styles.trashButtonText}>×</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        <View style={styles.inlineInputRow}>
                          <TextInput
                            value={exercise.customInstructions}
                            onChangeText={(customInstructions) =>
                              updateExercise(exercise.id, { customInstructions })
                            }
                            style={[styles.input, styles.textAreaInput, styles.inlineInput]}
                            placeholder="Describe how the method works"
                            placeholderTextColor="#9ea3ac"
                            multiline
                            textAlignVertical="top"
                          />
                          {exercise.customInstructions ? (
                            <Pressable
                              style={styles.trashButton}
                              onPress={() => updateExercise(exercise.id, { customInstructions: "" })}
                            >
                              <Text style={styles.trashButtonText}>×</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    {exercise.method !== "Standard" &&
                    exercise.method !== "Superset" &&
                    exercise.method !== "Drop set" &&
                    exercise.method !== "Rest-pause" &&
                    exercise.method !== "Myo-reps" &&
                    exercise.method !== "Tempo" &&
                    exercise.method !== "Custom" ? (
                      <>
                        <Text style={styles.fieldLabel}>{getMethodDetailsLabel(exercise.method)}</Text>
                        <TextInput
                          value={exercise.methodDetails}
                          onChangeText={(methodDetails) => updateExercise(exercise.id, { methodDetails })}
                          style={styles.input}
                          placeholder={getMethodDetailsPlaceholder(exercise.method)}
                          placeholderTextColor="#9ea3ac"
                        />
                      </>
                    ) : null}
                  </View>
                ))}
              </View>

              <Pressable style={styles.secondaryButton} onPress={addExercise}>
                <Text style={styles.secondaryButtonText}>Add another exercise</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 2 ? (
            <>
              <View style={styles.card}>
                <Text style={styles.reviewTitle}>{parsedWorkout.title}</Text>
                <Text style={styles.reviewBody}>
                  {weekLabel} · {effectiveSessionType}
                  {performedAt ? ` · ${performedAt}` : ""}
                </Text>
                <View style={styles.exerciseList}>
                  {parsedWorkout.exercises.map((exercise) => (
                    <View key={`${exercise.order}-${exercise.name}`} style={styles.reviewRow}>
                      <Text style={styles.reviewName}>{exercise.name}</Text>
                      <Text style={styles.reviewMeta}>
                        {exercise.sets} x {exercise.reps}
                        {exercise.weight ? ` @ ${exercise.weight} kg` : ""}
                        {exercise.restSeconds ? ` · rest ${exercise.restSeconds}s` : ""}
                      </Text>
                      {exercise.notes ? <Text style={styles.reviewMethod}>{exercise.notes}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.actionStack}>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, (pressed || loadingAction === "save") && styles.pressed]}
                  onPress={handleSaveWorkout}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "save" ? (
                    <ActivityIndicator color="#f4f6f9" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save this workout</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    (pressed || loadingAction === "generate") && styles.pressed,
                  ]}
                  onPress={handleGenerateWorkout}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "generate" ? (
                    <ActivityIndicator color="#171a20" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Generate next workout</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : null}

          {recommendation ? (
            <View style={styles.card}>
              <Text style={styles.reviewTitle}>{recommendation.title}</Text>
              <Text style={styles.reviewBody}>
                {recommendation.coachSummary ??
                  recommendation.explanation ??
                  "A structured next session based on your recent training."}
              </Text>
              <View style={styles.exerciseList}>
                {recommendation.exercises.map((exercise) => (
                  <View key={`${exercise.order}-${exercise.name}`} style={styles.reviewRow}>
                    <Text style={styles.reviewName}>{exercise.name}</Text>
                    <Text style={styles.reviewMeta}>
                      {exercise.sets} x {exercise.repMin === exercise.repMax ? exercise.repMin : `${exercise.repMin}-${exercise.repMax}`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.footerNav}>
            <Pressable
              style={[styles.navButton, step === 0 && styles.navButtonDisabled]}
              onPress={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              <Text style={styles.navButtonText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.navButtonPrimary, step === 2 && styles.navButtonDisabled]}
              onPress={() => setStep((current) => Math.min(2, current + 1))}
              disabled={step === 2}
            >
              <Text style={styles.navButtonPrimaryText}>Next</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildExerciseMethodNote(exercise: ManualExercise) {
  if (exercise.method === "Superset") {
    const pairName = exercise.pairedExerciseName.trim();
    const pairLoad = exercise.pairedWeight ? ` @ ${exercise.pairedWeight} kg` : "";
    const pairVolume = `${exercise.sets}x${exercise.pairedReps}${pairLoad}`;
    const pairText = pairName ? `${pairName} ${pairVolume}` : pairVolume;

    return `Superset with ${pairText} · shared rest ${exercise.restSeconds}s`;
  }

  if (exercise.method === "Drop set") {
    if (!exercise.dropSetWeights.length) {
      return "Drop set";
    }

    return `Drop set: ${exercise.dropSetWeights.map((weight) => `${formatNumeric(weight)} kg`).join(" -> ")}`;
  }

  if (exercise.method === "Rest-pause") {
    return `Rest-pause: ${exercise.restPauseSeconds}s pauses, ${exercise.restPauseMiniSets} mini-sets`;
  }

  if (exercise.method === "Myo-reps") {
    return `Myo-reps: activation ${exercise.myoActivationReps}, then ${exercise.myoMiniReps} x ${exercise.myoRounds} with ${exercise.myoRestSeconds}s`;
  }

  if (exercise.method === "Tempo") {
    return `Tempo: ${exercise.tempoEccentric}-${exercise.tempoStretch}-${exercise.tempoConcentric}-${exercise.tempoTop}`;
  }

  if (exercise.method === "Custom") {
    const name = exercise.customMethodName.trim() || "Custom method";
    const instructions = exercise.customInstructions.trim();
    const parts = [`${exercise.sets} sets`, `${exercise.customTargetReps} reps`];
    if (exercise.customRestSeconds > 0) {
      parts.push(`${exercise.customRestSeconds}s rest`);
    }
    const base = `${name}: ${parts.join(", ")}`;
    return instructions ? `${base} · ${instructions}` : base;
  }

  if (exercise.method === "Standard") {
    return undefined;
  }

  return exercise.methodDetails.trim()
    ? `${exercise.method}: ${exercise.methodDetails.trim()}`
    : exercise.method;
}

function buildExerciseRawLine(exercise: ManualExercise) {
  const methodNote = buildExerciseMethodNote(exercise);
  const base = `${exercise.name} ${exercise.sets}x${exercise.reps}`;

  return methodNote ? `${base} · ${methodNote}` : base;
}

function parseDecimalInput(value: string) {
  const sanitized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  if (!sanitized) return 0;
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? roundStep(parsed) : 0;
}

function parseIntegerInput(value: string) {
  const sanitized = value.replace(/[^0-9]/g, "");
  if (!sanitized) return 0;
  const parsed = Number.parseInt(sanitized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMethodDetailsLabel(method: ExerciseMethod) {
  switch (method) {
    case "Drop set":
      return "Weight drops";
    case "Rest-pause":
      return "Rest-pause details";
    case "Myo-reps":
      return "Myo-reps format";
    case "Tempo":
      return "Tempo";
    case "Custom":
      return "Method details";
    default:
      return "Method details";
  }
}

function getMethodDetailsPlaceholder(method: ExerciseMethod) {
  switch (method) {
    case "Drop set":
      return "ex: 30kg -> 25kg -> 20kg after failure";
    case "Rest-pause":
      return "ex: 12 reps + 20s + 4 + 20s + 3";
    case "Myo-reps":
      return "ex: activation 15, then 4+4+4 with 15s";
    case "Tempo":
      return "ex: 3-1-1-0";
    case "Custom":
      return "Describe how this method should be performed";
    default:
      return "Add any useful detail";
  }
}

function Stepper({
  label,
  value,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable style={styles.iconButton} onPress={() => onChange(Math.max(0, roundStep(value - step)))}>
          <Text style={styles.iconButtonText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>
          {formatNumeric(value)}
          {suffix}
        </Text>
        <Pressable style={styles.iconButton} onPress={() => onChange(roundStep(value + step))}>
          <Text style={styles.iconButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatNumeric(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function roundStep(value: number) {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    padding: 10,
  },
  container: {
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
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
  stepTitle: {
    marginTop: 16,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#20242b",
    fontWeight: "700",
  },
  stepBody: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#666c75",
  },
  card: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d4cc",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: "#111318",
    borderColor: "#111318",
  },
  chipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5d646d",
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#f8f8f8",
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ded9cf",
    backgroundColor: "#f8f7f3",
    paddingHorizontal: 11,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#262b33",
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineInput: {
    flex: 1,
  },
  textAreaInput: {
    minHeight: 88,
    height: 88,
    paddingTop: 10,
  },
  fieldHint: {
    marginTop: -4,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#727983",
  },
  exerciseList: {
    gap: 8,
  },
  exerciseCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  exerciseIndex: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sharedSetsCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c79d2a",
    backgroundColor: "#fbf5df",
    padding: 9,
    gap: 5,
  },
  textMetricCard: {
    minWidth: 128,
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#f4f1ea",
    paddingHorizontal: 9,
    paddingVertical: 9,
    gap: 6,
  },
  inlineMetricCard: {
    flex: 1,
  },
  sharedRestCard: {
    borderWidth: 1,
    borderColor: "#c79d2a",
    backgroundColor: "#fbf5df",
  },
  metricHint: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#826416",
  },
  metricInput: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ded9cf",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 11,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#262b33",
  },
  stepperCard: {
    minWidth: 128,
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#f4f1ea",
    paddingHorizontal: 9,
    paddingVertical: 9,
    gap: 6,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#181c23",
    fontWeight: "700",
  },
  iconButton: {
    minWidth: 34,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#f7f7f7",
    fontWeight: "700",
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#090b10",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f4f6f9",
    fontWeight: "700",
  },
  secondaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#e8e1d0",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#151820",
    fontWeight: "700",
  },
  reviewTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#141821",
    fontWeight: "700",
  },
  reviewBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#5d636c",
  },
  reviewRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 2,
  },
  reviewName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  reviewMeta: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6b717a",
  },
  reviewMethod: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#535a63",
  },
  supersetCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6ddc2",
    backgroundColor: "#fbf7ea",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  supersetTitle: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#3f3420",
    fontWeight: "700",
  },
  methodCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd8cf",
    backgroundColor: "#f9f7f2",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  dropSetCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d9d5cd",
    backgroundColor: "#f8f6f1",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 8,
  },
  dropSetRow: {
    gap: 6,
  },
  dropSetLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5d646d",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dropSetControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  dropSetInput: {
    minWidth: 110,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ded9cf",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 11,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#262b33",
  },
  trashButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d7d3cb",
    backgroundColor: "#f8f6f1",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  trashButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#434952",
    fontWeight: "700",
  },
  actionStack: {
    marginTop: 10,
    gap: 8,
  },
  footerNav: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7d3cb",
    backgroundColor: "#f8f6f1",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#111318",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#30353d",
    fontWeight: "700",
  },
  navButtonPrimaryText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#f7f7f7",
    fontWeight: "700",
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
  pressed: {
    opacity: 0.9,
  },
});
