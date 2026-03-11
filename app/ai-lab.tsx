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
import type { RecommendationDraft } from "@/lib/ai-types";
import {
  generateNextWorkout,
  getAiContext,
  parseWorkoutNote,
  refineWorkout,
  saveParsedWorkout,
} from "@/lib/ai-api";

const starterNote =
  "back squat 3x8 @90kg felt heavy\nbench 4x6 @75kg\nbarbell row 4x10\ncable curls sets tbd";

const starterConstraints = {
  focus: "lower body",
  avoidExercises: ["conventional deadlift"],
  availableMinutes: 45,
};

type LoadingAction = "bootstrap" | "parse" | "save" | "generate" | "refine" | null;

export default function AiLabScreen() {
  const router = useRouter();
  const [rawNote, setRawNote] = useState(starterNote);
  const [refineMessage, setRefineMessage] = useState(
    "Je veux une seance plus courte, sans squat, et avec plus de machine.",
  );
  const [parsedResult, setParsedResult] = useState("");
  const [recommendation, setRecommendation] = useState<RecommendationDraft | null>(null);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [latestWorkoutId, setLatestWorkoutId] = useState<string | null>(null);
  const [recommendationResult, setRecommendationResult] = useState("");
  const [refineResult, setRefineResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState("");
  const [userProfile, setUserProfile] = useState<unknown>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<unknown[]>([]);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>("bootstrap");

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const result = await getAiContext();
        if (cancelled) return;

        const nextProfile = result.user
          ? {
              goal: result.user.goal ?? "muscle_gain",
              level: result.user.level ?? "intermediate",
              frequencyPerWeek: result.user.frequencyPerWeek ?? 4,
              sessionDuration: result.user.sessionDuration ?? 45,
              equipment: Array.isArray(result.user.equipment) ? result.user.equipment : [],
              splitPreference: result.user.splitPreference ?? "upper_lower",
            }
          : {
              goal: "muscle_gain",
              level: "intermediate",
              frequencyPerWeek: 4,
              sessionDuration: 45,
              equipment: [],
              splitPreference: "upper_lower",
            };

        setUserProfile(nextProfile);
        setRecentWorkouts(result.recentWorkouts);

        if (result.latestRecommendation) {
          setRecommendation(result.latestRecommendation);
          setRecommendationResult(JSON.stringify(result.latestRecommendation, null, 2));
        }

        setContextSummary(
          JSON.stringify(
            {
              user: result.user,
              recentWorkoutCount: result.recentWorkouts.length,
              latestWorkoutId: result.recentWorkouts[0] && typeof result.recentWorkouts[0] === "object"
                ? (result.recentWorkouts[0] as { id?: string }).id ?? null
                : null,
              latestRecommendationId: result.latestRecommendationId ?? null,
              latestThreadId: result.latestThreadId ?? null,
            },
            null,
            2,
          ),
        );

        setLatestWorkoutId(result.latestWorkoutId ?? null);
        setRecommendationId(result.latestRecommendationId ?? null);
        setThreadId(result.latestThreadId ?? null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Failed to load AI context");
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

  async function handleParse() {
    setError(null);
    setLoadingAction("parse");
    try {
      const result = await parseWorkoutNote(rawNote);
      setParsedResult(JSON.stringify(result.parsedWorkout, null, 2));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to parse note");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSaveParsedWorkout() {
    if (!parsedResult) {
      setError("Parse a workout note before saving it.");
      return;
    }

    setError(null);
    setLoadingAction("save");
    try {
      const result = await saveParsedWorkout({
        rawText: rawNote,
        parsedWorkout: JSON.parse(parsedResult),
      });
      setLatestWorkoutId(result.workoutId);
      setContextSummary((current) =>
        `${current}\n${JSON.stringify(
          {
            savedWorkoutId: result.workoutId,
            savedExerciseCount: result.exerciseCount,
          },
          null,
          2,
        )}`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save parsed workout");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGenerate() {
    setError(null);
    setLoadingAction("generate");
    try {
      const result = await generateNextWorkout({
        userProfile,
        recentWorkouts,
        latestWorkout: parsedResult ? JSON.parse(parsedResult) : null,
        constraints: starterConstraints,
        basedOnWorkoutId: latestWorkoutId ?? undefined,
      });
      setRecommendation(result.recommendation);
      setRecommendationId(result.recommendationId);
      setThreadId(result.threadId);
      setRecommendationResult(JSON.stringify(result.recommendation, null, 2));
      setRefineResult("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to generate workout");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRefine() {
    if (!recommendation) {
      setError("Generate a workout before refining it.");
      return;
    }

    if (!recommendationId) {
      setError("No persisted recommendation found. Generate it again first.");
      return;
    }

    setError(null);
    setLoadingAction("refine");
    try {
      const result = await refineWorkout({
        currentRecommendation: recommendation,
        recommendationId,
        threadId: threadId ?? undefined,
        userMessage: refineMessage,
        recentWorkouts,
      });
      setRecommendation(result.refinement.recommendation);
      setRecommendationId(result.recommendationId);
      setThreadId(result.threadId);
      setRecommendationResult(JSON.stringify(result.refinement.recommendation, null, 2));
      setRefineResult(JSON.stringify(result.refinement, null, 2));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to refine workout");
    } finally {
      setLoadingAction(null);
    }
  }

  const isBootstrapping = loadingAction === "bootstrap";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.badge}>AI LAB</Text>
          </View>

          <Text style={styles.title}>Test the AI workout loop</Text>
          <Text style={styles.subtitle}>
            Parse raw notes, generate the next workout, then refine it with a coaching message.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Context</Text>
            <Text style={styles.helperText}>
              {isBootstrapping
                ? "Loading connected user context from Prisma..."
                : "Using the signed-in user's profile and recent workouts."}
            </Text>
            {isBootstrapping ? (
              <ActivityIndicator color="#11141a" />
            ) : (
              <Text selectable style={styles.codeBlock}>
                {contextSummary}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>1. Raw note</Text>
            <TextInput
              multiline
              value={rawNote}
              onChangeText={setRawNote}
              style={styles.textArea}
              placeholder="Paste a messy workout note"
              placeholderTextColor="#9ea3ac"
            />
            <Pressable
              onPress={handleParse}
              disabled={loadingAction !== null}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || loadingAction === "parse") && styles.pressed,
              ]}
            >
              {loadingAction === "parse" ? (
                <ActivityIndicator color="#f7f8fb" />
              ) : (
                <Text style={styles.primaryButtonText}>Parse workout note</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleSaveParsedWorkout}
              disabled={loadingAction !== null || !parsedResult}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || loadingAction === "save" || !parsedResult) && styles.pressed,
              ]}
            >
              {loadingAction === "save" ? (
                <ActivityIndicator color="#11141a" />
              ) : (
                <Text style={styles.secondaryButtonText}>Save parsed workout</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>2. Next workout</Text>
            <Text style={styles.helperText}>
              Uses the signed-in user profile, stored recent workouts, and the parsed workout if available.
            </Text>
            <Pressable
              onPress={handleGenerate}
              disabled={loadingAction !== null}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || loadingAction === "generate") && styles.pressed,
              ]}
            >
              {loadingAction === "generate" ? (
                <ActivityIndicator color="#f7f8fb" />
              ) : (
                <Text style={styles.primaryButtonText}>Generate next workout</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>3. Refine with chat</Text>
            <TextInput
              multiline
              value={refineMessage}
              onChangeText={setRefineMessage}
              style={styles.textArea}
              placeholder="Tell the coach what to change"
              placeholderTextColor="#9ea3ac"
            />
            <Pressable
              onPress={handleRefine}
              disabled={loadingAction !== null}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || loadingAction === "refine") && styles.pressed,
              ]}
            >
              {loadingAction === "refine" ? (
                <ActivityIndicator color="#11141a" />
              ) : (
                <Text style={styles.secondaryButtonText}>Refine workout</Text>
              )}
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ResultBlock title="Parsed workout" content={parsedResult} />
          <ResultBlock title="Recommendation" content={recommendationResult} />
          <ResultBlock title="Refinement" content={refineResult} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultBlock({ title, content }: { title: string; content: string }) {
  if (!content) return null;

  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text selectable style={styles.codeBlock}>
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eceae5",
  },
  scrollContent: {
    padding: 16,
  },
  container: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#ddd8cf",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ece8df",
  },
  backButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#30343a",
    fontWeight: "600",
  },
  badge: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#7c7367",
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#14171d",
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#666a71",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2ddd5",
    backgroundColor: "#fcfaf6",
    padding: 14,
    gap: 12,
  },
  cardLabel: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#1c2027",
    fontWeight: "700",
  },
  helperText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#727780",
  },
  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd9d1",
    backgroundColor: "#f2eee6",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: "#1f232a",
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12151b",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f7f8fb",
    fontWeight: "700",
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dfd8c8",
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#11141a",
    fontWeight: "700",
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dfdbd3",
    backgroundColor: "#fffdf9",
    padding: 14,
    gap: 10,
  },
  resultTitle: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#1b1f26",
    fontWeight: "700",
  },
  codeBlock: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: "#272b32",
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3b3ad",
    backgroundColor: "#fff3f1",
    padding: 14,
  },
  errorText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#9d2f25",
  },
  pressed: {
    opacity: 0.9,
  },
});
