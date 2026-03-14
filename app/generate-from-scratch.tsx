import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import type { TrainingPlanDraft } from "@/lib/ai-types";
import { generateTrainingPlan, getAiContext, toAiUserProfile } from "@/lib/ai-api";

export default function GenerateFromScratchScreen() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<unknown>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<unknown[]>([]);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanDraft | null>(null);
  const [trainingPlanId, setTrainingPlanId] = useState<string | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [loadingAction, setLoadingAction] = useState<"bootstrap" | "generate" | null>("bootstrap");
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
          setError(nextError instanceof Error ? nextError.message : "Failed to load your profile");
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

  async function handleGenerate() {
    setError(null);
    setLoadingAction("generate");

    try {
      const result = await generateTrainingPlan({
        userProfile,
        recentWorkouts,
      });

      setTrainingPlan(result.trainingPlan);
      setTrainingPlanId(result.trainingPlanId);
      setSelectedWeekIndex(0);
      setSelectedDayIndex(0);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to generate training plan");
    } finally {
      setLoadingAction(null);
    }
  }

  const selectedWeek = trainingPlan?.weeks[selectedWeekIndex] ?? null;
  const selectedDay = selectedWeek?.days[selectedDayIndex] ?? null;
  const isBusy = loadingAction !== null;

  const weekTabs = useMemo(() => trainingPlan?.weeks ?? [], [trainingPlan]);

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
            <Text style={styles.title}>Generate from scratch</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>AI plan</Text>
            <Text style={styles.heroTitle}>Build a full first block from your profile</Text>
            <Text style={styles.heroBody}>
              This creates a week-by-week structure, then lets you open each week and each training day.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, (pressed || loadingAction === "generate") && styles.pressed]}
              onPress={handleGenerate}
              disabled={isBusy}
            >
              {loadingAction === "generate" ? (
                <ActivityIndicator color="#f5f7fa" />
              ) : (
                <Text style={styles.primaryButtonText}>Generate plan</Text>
              )}
            </Pressable>
          </View>

          {trainingPlan ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultEyebrow}>Generated plan</Text>
              <Text style={styles.resultTitle}>{trainingPlan.blockTitle}</Text>
              <Text style={styles.resultBody}>
                {trainingPlan.summary ?? "A structured 4-week plan based on your profile."}
              </Text>

              {trainingPlanId ? (
                <Text style={styles.resultMeta}>Plan saved · {trainingPlanId.slice(0, 8)}</Text>
              ) : null}

              <View style={styles.metaRow}>
                {trainingPlan.goal ? <MetaChip label={trainingPlan.goal.replaceAll("_", " ")} /> : null}
                {trainingPlan.split ? <MetaChip label={trainingPlan.split} tone="soft" /> : null}
              </View>

              <View style={styles.weekRow}>
                {weekTabs.map((week, index) => (
                  <Pressable
                    key={`${week.weekNumber}-${week.title}`}
                    style={[styles.weekPill, index === selectedWeekIndex && styles.weekPillActive]}
                    onPress={() => {
                      setSelectedWeekIndex(index);
                      setSelectedDayIndex(0);
                    }}
                  >
                    <Text style={[styles.weekPillText, index === selectedWeekIndex && styles.weekPillTextActive]}>
                      Week {week.weekNumber}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {selectedWeek ? (
                <View style={styles.weekCard}>
                  <Text style={styles.weekTitle}>{selectedWeek.title}</Text>
                  {selectedWeek.summary ? <Text style={styles.weekSummary}>{selectedWeek.summary}</Text> : null}

                  <View style={styles.dayRow}>
                    {selectedWeek.days.map((day, index) => (
                      <Pressable
                        key={`${day.dayLabel}-${day.title}`}
                        style={[styles.dayPill, index === selectedDayIndex && styles.dayPillActive]}
                        onPress={() => setSelectedDayIndex(index)}
                      >
                        <Text style={[styles.dayPillLabel, index === selectedDayIndex && styles.dayPillLabelActive]}>
                          {day.dayLabel}
                        </Text>
                        <Text style={[styles.dayPillTitle, index === selectedDayIndex && styles.dayPillTitleActive]}>
                          {day.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {selectedDay ? (
                <View style={styles.dayDetailCard}>
                  <Text style={styles.dayDetailEyebrow}>{selectedDay.dayLabel}</Text>
                  <Text style={styles.dayDetailTitle}>{selectedDay.title}</Text>
                  {selectedDay.summary ? <Text style={styles.dayDetailBody}>{selectedDay.summary}</Text> : null}
                  {selectedDay.estimatedDurationMinutes ? (
                    <Text style={styles.dayDetailMeta}>{selectedDay.estimatedDurationMinutes} min session</Text>
                  ) : null}

                  <View style={styles.exerciseList}>
                    {selectedDay.exercises.map((exercise) => (
                      <View key={`${exercise.order}-${exercise.name}`} style={styles.exerciseCard}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {exercise.sets} x{" "}
                          {exercise.repMin === exercise.repMax
                            ? exercise.repMin
                            : `${exercise.repMin}-${exercise.repMax}`}{" "}
                          · rest {exercise.restSeconds}s
                        </Text>
                        {exercise.notes ? <Text style={styles.exerciseNote}>{exercise.notes}</Text> : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
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

function MetaChip({ label, tone = "default" }: { label: string; tone?: "default" | "soft" }) {
  return (
    <View style={[styles.metaChip, tone === "soft" && styles.metaChipSoft]}>
      <Text style={[styles.metaChipText, tone === "soft" && styles.metaChipTextSoft]}>{label}</Text>
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
  },
  container: {
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4dfd5",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    ...Typography.sectionTitle,
    color: "#151920",
    fontWeight: "700",
  },
  heroBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#69707a",
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 4,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#090b10",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
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
    color: "#5d636c",
    lineHeight: 20,
  },
  resultMeta: {
    marginTop: -2,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    borderRadius: 999,
    backgroundColor: "#ece8df",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipSoft: {
    backgroundColor: "#efefef",
  },
  metaChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#2e333b",
    fontWeight: "600",
  },
  metaChipTextSoft: {
    color: "#5f6670",
  },
  weekRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  weekPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d4cc",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  weekPillActive: {
    backgroundColor: "#111318",
    borderColor: "#111318",
  },
  weekPillText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5d646d",
    fontWeight: "700",
  },
  weekPillTextActive: {
    color: "#f8f8f8",
  },
  weekCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  weekTitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  weekSummary: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#707781",
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayPill: {
    minWidth: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd8cf",
    backgroundColor: "#faf8f3",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  dayPillActive: {
    backgroundColor: "#111318",
    borderColor: "#111318",
  },
  dayPillLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dayPillLabelActive: {
    color: "#b9bfc8",
  },
  dayPillTitle: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#21262e",
    fontWeight: "700",
  },
  dayPillTitleActive: {
    color: "#f6f7f9",
  },
  dayDetailCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dayDetailEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dayDetailTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#171b22",
    fontWeight: "700",
  },
  dayDetailBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#666d77",
    lineHeight: 20,
  },
  dayDetailMeta: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    fontWeight: "600",
  },
  exerciseList: {
    gap: 8,
  },
  exerciseCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ebe7de",
    backgroundColor: "#f8f7f4",
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  exerciseNote: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#434952",
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
  pressed: {
    opacity: 0.9,
  },
});
