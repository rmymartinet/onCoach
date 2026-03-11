import { useState } from "react";
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
import { generateNextWorkout, parseWorkoutNote, refineWorkout } from "@/lib/ai-api";

const starterNote =
  "back squat 3x8 @90kg felt heavy\nbench 4x6 @75kg\nbarbell row 4x10\ncable curls sets tbd";

const starterProfile = {
  goal: "muscle_gain",
  level: "intermediate",
  frequencyPerWeek: 4,
  sessionDuration: 45,
  equipment: ["barbell", "dumbbells", "cables", "machines"],
  splitPreference: "upper_lower",
};

const starterConstraints = {
  focus: "lower body",
  avoidExercises: ["conventional deadlift"],
  availableMinutes: 45,
};

const starterRecentWorkouts = [
  {
    title: "Push Day",
    sessionType: "upper",
    fatigueNote: "chest and triceps very taxed",
    exercises: [
      { name: "Bench Press", sets: 4, repMin: 6, repMax: 8, weight: 75 },
      { name: "Incline Dumbbell Press", sets: 3, repMin: 8, repMax: 10 },
    ],
  },
  {
    title: "Pull Day",
    sessionType: "upper",
    exercises: [
      { name: "Barbell Row", sets: 4, repMin: 8, repMax: 10 },
      { name: "Lat Pulldown", sets: 3, repMin: 10, repMax: 12 },
    ],
  },
];

export default function AiLabScreen() {
  const router = useRouter();
  const [rawNote, setRawNote] = useState(starterNote);
  const [refineMessage, setRefineMessage] = useState(
    "Je veux une séance plus courte, sans squat, et avec plus de machine.",
  );
  const [parsedResult, setParsedResult] = useState<string>("");
  const [recommendation, setRecommendation] = useState<RecommendationDraft | null>(null);
  const [recommendationResult, setRecommendationResult] = useState<string>("");
  const [refineResult, setRefineResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"parse" | "generate" | "refine" | null>(null);

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

  async function handleGenerate() {
    setError(null);
    setLoadingAction("generate");
    try {
      const result = await generateNextWorkout({
        userProfile: starterProfile,
        recentWorkouts: starterRecentWorkouts,
        latestWorkout: parsedResult ? JSON.parse(parsedResult) : null,
        constraints: starterConstraints,
      });
      setRecommendation(result.recommendation);
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

    setError(null);
    setLoadingAction("refine");
    try {
      const result = await refineWorkout({
        currentRecommendation: recommendation,
        userMessage: refineMessage,
        recentWorkouts: starterRecentWorkouts,
      });
      setRecommendation(result.refinement.recommendation);
      setRecommendationResult(JSON.stringify(result.refinement.recommendation, null, 2));
      setRefineResult(JSON.stringify(result.refinement, null, 2));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to refine workout");
    } finally {
      setLoadingAction(null);
    }
  }

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
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>2. Next workout</Text>
            <Text style={styles.helperText}>
              Uses starter profile, recent workouts, and the parsed workout if available.
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
