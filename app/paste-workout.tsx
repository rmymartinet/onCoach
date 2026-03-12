import { useEffect, useState } from "react";
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
import {
  generateNextWorkout,
  getAiContext,
  parseWorkoutNote,
  saveParsedWorkout,
} from "@/lib/ai-api";

const defaultWorkout =
  "back squat 3x8 @90kg felt heavy\nbench 4x6 @75kg\nbarbell row 4x10\ncable curls 3x12";

export default function PasteWorkoutScreen() {
  const router = useRouter();
  const [rawWorkout, setRawWorkout] = useState(defaultWorkout);
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationDraft | null>(null);
  const [latestWorkoutId, setLatestWorkoutId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<unknown>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<unknown[]>([]);
  const [loadingAction, setLoadingAction] = useState<"bootstrap" | "parse" | "save" | "generate" | null>(
    "bootstrap",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const result = await getAiContext();
        if (cancelled) return;

        setUserProfile(
          result.user
            ? {
                goal: result.user.goal ?? "muscle_gain",
                level: result.user.level ?? "intermediate",
                frequencyPerWeek: result.user.frequencyPerWeek ?? 4,
                sessionDuration: result.user.sessionDuration ?? 45,
                equipment: Array.isArray(result.user.equipment) ? result.user.equipment : [],
                splitPreference: result.user.splitPreference ?? "upper_lower",
              }
            : null,
        );
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

  async function handleParseWorkout() {
    setError(null);
    setLoadingAction("parse");
    try {
      const result = await parseWorkoutNote(rawWorkout);
      setParsedWorkout(result.parsedWorkout as ParsedWorkout);
      setRecommendation(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to parse workout");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSaveWorkout() {
    if (!parsedWorkout) {
      setError("Parse the workout before saving it.");
      return;
    }

    setError(null);
    setLoadingAction("save");
    try {
      const result = await saveParsedWorkout({
        rawText: rawWorkout,
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
    if (!parsedWorkout && !latestWorkoutId) {
      setError("Save this session first, or at least parse it before generating the next one.");
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
            <Text style={styles.title}>Paste workout</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.sectionTitle}>Quick flow</Text>
          <Text style={styles.sectionBody}>
            Paste a messy workout note and AI will turn it into a clean, structured session.
          </Text>

          <TextInput
            multiline
            value={rawWorkout}
            onChangeText={setRawWorkout}
            style={styles.inputBox}
            placeholder="bench 4x6 @75kg..."
            placeholderTextColor="#9ea3ac"
          />

          <Pressable
            style={({ pressed }) => [styles.primaryButton, (pressed || loadingAction === "parse") && styles.pressed]}
            onPress={handleParseWorkout}
            disabled={loadingAction !== null}
          >
            {loadingAction === "parse" ? (
              <ActivityIndicator color="#f4f6f9" />
            ) : (
              <Text style={styles.primaryButtonText}>Turn this note into a workout</Text>
            )}
          </Pressable>

          {parsedWorkout ? (
            <>
              <Text style={styles.resultLabel}>Parsed workout</Text>
              <ParsedWorkoutCard workout={parsedWorkout} />
              <View style={styles.inlineActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.inlineButton,
                    (pressed || loadingAction === "save") && styles.pressed,
                  ]}
                  onPress={handleSaveWorkout}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "save" ? (
                    <ActivityIndicator color="#171a20" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Save session</Text>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.inlineButton,
                    (pressed || loadingAction === "generate") && styles.pressed,
                  ]}
                  onPress={handleGenerateWorkout}
                  disabled={loadingAction !== null}
                >
                  {loadingAction === "generate" ? (
                    <ActivityIndicator color="#f4f6f9" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Generate next</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : null}

          {recommendation ? (
            <>
              <Text style={styles.resultLabel}>Next workout</Text>
              <RecommendationCard recommendation={recommendation} />
            </>
          ) : null}

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

function ParsedWorkoutCard({ workout }: { workout: ParsedWorkout }) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.cardTitle}>{workout.title ?? "Workout session"}</Text>
      {workout.cleanedSummary ? <Text style={styles.cardBody}>{workout.cleanedSummary}</Text> : null}
      <View style={styles.exerciseList}>
        {workout.exercises.map((exercise) => (
          <ParsedExerciseRow key={`${exercise.order}-${exercise.name}`} exercise={exercise} />
        ))}
      </View>
    </View>
  );
}

function RecommendationCard({ recommendation }: { recommendation: RecommendationDraft }) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.cardTitle}>{recommendation.title}</Text>
      <Text style={styles.cardBody}>
        {recommendation.coachSummary ??
          recommendation.explanation ??
          "A structured next session based on your recent training."}
      </Text>
      <View style={styles.exerciseList}>
        {recommendation.exercises.map((exercise) => (
          <View key={`${exercise.order}-${exercise.name}`} style={styles.exerciseRow}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseDetail}>
              {exercise.sets} x {exercise.repMin === exercise.repMax ? exercise.repMin : `${exercise.repMin}-${exercise.repMax}`}
              {" · "}
              rest {exercise.restSeconds}s
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ParsedExerciseRow({ exercise }: { exercise: ParsedWorkoutExercise }) {
  return (
    <View style={styles.exerciseRow}>
      <Text style={styles.exerciseName}>{exercise.name}</Text>
      <Text style={styles.exerciseDetail}>{formatWorkoutVolume(exercise)}</Text>
    </View>
  );
}

function formatRepRange(repMin?: number, repMax?: number) {
  if (typeof repMin === "number" && typeof repMax === "number") {
    return repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`;
  }
  if (typeof repMin === "number") return `${repMin}+`;
  if (typeof repMax === "number") return `${repMax}`;
  return "TBD";
}

function formatWorkoutVolume(exercise: ParsedWorkoutExercise) {
  if (typeof exercise.sets === "number" && typeof exercise.reps === "number") {
    return `${exercise.sets} x ${exercise.reps}`;
  }
  if (
    typeof exercise.sets === "number" &&
    (typeof exercise.repMin === "number" || typeof exercise.repMax === "number")
  ) {
    return `${exercise.sets} x ${formatRepRange(exercise.repMin, exercise.repMax)}`;
  }
  return typeof exercise.sets === "number" ? `${exercise.sets} sets` : "Needs review";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  scrollContent: {
    padding: 12,
  },
  container: {
    borderRadius: 22,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
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
  sectionTitle: {
    marginTop: 18,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#20242b",
    fontWeight: "700",
  },
  sectionBody: {
    marginTop: 6,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#666c75",
  },
  inputBox: {
    marginTop: 12,
    minHeight: 136,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d5d6da",
    backgroundColor: "#f5f5f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.mono,
    ...Typography.bodySmall,
    color: "#262a31",
    textAlignVertical: "top",
  },
  primaryButton: {
    marginTop: 14,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#090b10",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    marginTop: 14,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#e8e1d0",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f4f6f9",
    fontWeight: "700",
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#151820",
    fontWeight: "700",
  },
  resultLabel: {
    marginTop: 16,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8e949d",
    fontWeight: "600",
  },
  resultCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cardTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#151920",
    fontWeight: "700",
  },
  cardBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#5d636c",
    lineHeight: 20,
  },
  exerciseList: {
    gap: 10,
  },
  exerciseRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  exerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#161a22",
    fontWeight: "700",
  },
  exerciseDetail: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6b717a",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
  },
  inlineButton: {
    flex: 1,
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
