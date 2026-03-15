import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { getTrainingPlan, type AiContextTrainingPlan } from "@/lib/ai-api";

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

export default function ProgramDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trainingPlanId?: string; title?: string }>();
  const trainingPlanId = params.trainingPlanId ?? "";
  const [trainingPlan, setTrainingPlan] = useState<AiContextTrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

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
            <Text style={styles.heroEyebrow}>{trainingPlan?.split ?? "Program"}</Text>
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

          {trainingPlan?.progressionNotes?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PROGRESSION</Text>
              <View style={styles.noteCard}>
                {trainingPlan.progressionNotes.map((note, index) => (
                  <Text key={`${index}-${note}`} style={styles.noteText}>
                    {note}
                  </Text>
                ))}
              </View>
            </View>
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
                              <View key={day.id} style={styles.dayCard}>
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
                                    {day.exercises.map((exercise) => (
                                      <View key={exercise.id} style={styles.exerciseCard}>
                                        <View style={styles.exerciseHeader}>
                                          <View style={styles.exerciseCopy}>
                                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                                            <Text style={styles.exerciseMeta}>
                                              {exercise.sets} x {formatRepRange(exercise.repMin, exercise.repMax)} · rest {exercise.restSeconds}s
                                            </Text>
                                          </View>
                                          {parseTargetArea(exercise.notes) ? (
                                            <View style={styles.exerciseChip}>
                                              <Text style={styles.exerciseChipText}>{parseTargetArea(exercise.notes)}</Text>
                                            </View>
                                          ) : null}
                                        </View>
                                      </View>
                                    ))}
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
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
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
  pressed: {
    opacity: 0.9,
  },
});
