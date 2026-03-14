import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { updateWorkoutExercise } from "@/lib/ai-api";

type FallbackMetrics = {
  sets: string | null;
  reps: string | null;
  load: string | null;
  rest: string | null;
  repMode: "standard" | "failure";
};

const targetAreaOptions = [
  "Lower",
  "Push",
  "Pull",
  "Shoulders",
  "Arms",
  "Core",
  "Full body",
  "Exercise",
] as const;

function toUserNote(raw?: string) {
  const value = raw?.trim();
  if (!value) return "";

  const parts = value.split("||");
  if (parts.length > 1) {
    return parts[1]?.trim() ?? "";
  }

  // Hide internal machine metadata when there is no freeform note.
  if (value.startsWith("method=") || value.includes("timelineWeek=") || value.includes("timelineDate=")) {
    return "";
  }

  return value;
}

function toDisplayValue(raw?: string, fallback = "—") {
  const value = raw?.trim();
  return value ? value : fallback;
}

function parseTargetAreaFromNote(raw?: string) {
  const value = raw?.trim();
  if (!value) return null;
  const match = value.match(/targetArea=([^;|]+)/i);
  return match?.[1]?.trim() || null;
}

function inferMetricsFromNote(note: string): FallbackMetrics {
  const normalized = note.trim();
  if (!normalized) {
    return { sets: null, reps: null, load: null, rest: null, repMode: "standard" };
  }

  const setRepMatch = normalized.match(/(\d+)\s*x\s*(\d+)/i);
  const setsMatch = normalized.match(/(\d+)\s*sets?\b/i);
  const repsMatch = normalized.match(/(\d+)\s*reps?\b/i);
  const restSecondsMatch = normalized.match(/(\d+)\s*(?:s|sec|secs|seconds?|secondes?)\b/i);
  const restMinutesMatch = normalized.match(/(\d+)\s*(?:min|mins|minutes?)\b/i);
  const loadMatch = normalized.match(/(?:@|at\s+)(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\b/i);

  return {
    sets: setRepMatch?.[1] ?? setsMatch?.[1] ?? null,
    reps: setRepMatch?.[2] ?? repsMatch?.[1] ?? null,
    load: loadMatch ? `${loadMatch[1]} ${loadMatch[2]}` : null,
    rest: restMinutesMatch
      ? `${restMinutesMatch[1]} min`
      : restSecondsMatch
        ? `${restSecondsMatch[1]}s`
        : null,
    repMode: /\b(repMode=failure|echec|échec|failure)\b/i.test(normalized) ? "failure" : "standard",
  };
}

function buildDisplayDetail(rawDetail: string | undefined, inferred: FallbackMetrics) {
  const value = rawDetail?.trim();
  if (value && value.toLowerCase() !== "needs review" && value.toLowerCase() !== "volume not specified") {
    return value;
  }

  if (inferred.sets && inferred.reps) {
    return `${inferred.sets} x ${inferred.reps}`;
  }
  if (inferred.repMode === "failure" && inferred.sets) {
    return `${inferred.sets} x failure`;
  }
  if (inferred.sets) {
    return `${inferred.sets} sets`;
  }
  if (inferred.reps) {
    return `${inferred.reps} reps`;
  }

  return "Volume not specified";
}

function toOptionalNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLoadInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return { weight: null, unit: null };

  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (!match) return { weight: null, unit: null };

  const weight = Number(match[1]);
  if (!Number.isFinite(weight)) return { weight: null, unit: null };

  return {
    weight,
    unit: match[2]?.toLowerCase() ?? "kg",
  };
}

function parseRestInput(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    return Number.isFinite(minutes) ? Math.round(minutes * 60) : null;
  }

  const secondsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)?/);
  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);
    return Number.isFinite(seconds) ? Math.round(seconds) : null;
  }

  return null;
}

function buildUpdatedNotes(
  rawNote: string | undefined,
  options: {
    targetArea: string;
    repMode: "standard" | "failure";
    freeform: string;
  },
) {
  const raw = rawNote?.trim() ?? "";
  const metadata = new Map<string, string>();
  const freeform = options.freeform.trim();

  if (raw.startsWith("method=")) {
    const [metaPart] = raw.split("||");
    for (const part of metaPart.split(";").map((item) => item.trim()).filter(Boolean)) {
      const [key, ...rest] = part.split("=");
      const value = rest.join("=").trim();
      if (key && value) {
        metadata.set(key, value);
      }
    }
  }

  if (!metadata.has("method") && (options.targetArea || options.repMode === "failure")) {
    metadata.set("method", "Standard");
  }

  if (options.targetArea.trim()) {
    metadata.set("targetArea", options.targetArea.trim());
  } else {
    metadata.delete("targetArea");
  }

  if (options.repMode === "failure") {
    metadata.set("repMode", "failure");
  } else {
    metadata.delete("repMode");
  }

  const metadataText = Array.from(metadata.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  if (!metadataText) {
    return freeform;
  }

  return freeform ? `${metadataText} || ${freeform}` : metadataText;
}

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workoutId?: string;
    exerciseId?: string;
    name?: string;
    detail?: string;
    sets?: string;
    reps?: string;
    load?: string;
    rest?: string;
    muscle?: string;
    note?: string;
  }>();
  const note = toUserNote(params.note);
  const explicitTargetArea = parseTargetAreaFromNote(params.note);
  const inferred = inferMetricsFromNote(note);
  const detail = buildDisplayDetail(params.detail, inferred);
  const load = toDisplayValue(params.load, inferred.load ?? "—");
  const rest = toDisplayValue(params.rest, inferred.rest ?? "—");
  const initialSets = typeof params.sets === "string" && params.sets.trim().length ? params.sets.trim() : inferred.sets ?? "";
  const initialReps =
    typeof params.reps === "string" && params.reps.trim().length
      ? params.reps.trim()
      : inferred.repMode === "failure"
        ? "Failure"
        : inferred.reps ?? "";
  const [isEditing, setIsEditing] = useState(false);
  const [sets, setSets] = useState(initialSets);
  const [reps, setReps] = useState(initialReps);
  const [editableLoad, setEditableLoad] = useState(load === "—" ? "" : load);
  const [editableRest, setEditableRest] = useState(rest === "—" ? "" : rest);
  const [editableNote, setEditableNote] = useState(note);
  const [targetArea, setTargetArea] = useState(explicitTargetArea || params.muscle?.trim() || "Exercise");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayDetail =
    sets && reps && reps !== "Failure"
      ? `${sets} x ${reps}`
      : sets && reps === "Failure"
        ? `${sets} x failure`
        : sets
          ? `${sets} sets`
          : reps && reps !== "Failure"
            ? `${reps} reps`
            : detail;

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
          <Text style={styles.title}>Exercise detail</Text>
          <Pressable
            style={({ pressed }) => [styles.editTap, pressed && styles.pressed]}
            onPress={() => {
              if (!isEditing) {
                setIsEditing(true);
                return;
              }

              const exerciseId = typeof params.exerciseId === "string" ? params.exerciseId : "";
              const workoutId = typeof params.workoutId === "string" ? params.workoutId : "";

              if (!exerciseId || !workoutId) {
                setIsEditing(false);
                return;
              }

              const repMode = reps === "Failure" ? "failure" : "standard";
              const parsedLoad = parseLoadInput(editableLoad);
              const parsedRest = parseRestInput(editableRest);
              const nextNotes = buildUpdatedNotes(params.note, {
                targetArea,
                repMode,
                freeform: editableNote,
              });

              setIsSaving(true);
              setError(null);
              void updateWorkoutExercise({
                exerciseId,
                workoutId,
                name: params.name ?? "Exercise",
                sets: toOptionalNumber(sets),
                reps: repMode === "failure" ? null : toOptionalNumber(reps),
                repMin: repMode === "failure" ? null : toOptionalNumber(reps),
                repMax: repMode === "failure" ? null : toOptionalNumber(reps),
                weight: parsedLoad.weight,
                unit: parsedLoad.unit,
                restSeconds: parsedRest,
                notes: nextNotes,
              })
                .then(() => {
                  setIsEditing(false);
                })
                .catch((nextError) => {
                  setError(nextError instanceof Error ? nextError.message : "Failed to save exercise");
                })
                .finally(() => {
                  setIsSaving(false);
                });
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#2a2d34" />
            ) : (
              <Text style={styles.editTapText}>{isEditing ? "Save" : "Edit"}</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{targetArea}</Text>
          <Text style={styles.heroTitle}>{params.name ?? "Hack Squat"}</Text>
          <Text style={styles.heroMeta}>{displayDetail}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DETAILS</Text>
          <View style={styles.infoCard}>
            {isEditing ? (
              <>
                <View style={styles.targetAreaBlock}>
                  <Text style={styles.infoLabel}>Rep target</Text>
                  <View style={styles.targetAreaRow}>
                    <Pressable
                      style={[styles.targetAreaChip, reps !== "Failure" && styles.targetAreaChipActive]}
                      onPress={() => setReps((current) => (current === "Failure" ? "" : current))}
                    >
                      <Text
                        style={[
                          styles.targetAreaChipText,
                          reps !== "Failure" && styles.targetAreaChipTextActive,
                        ]}
                      >
                        Fixed reps
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.targetAreaChip, reps === "Failure" && styles.targetAreaChipActive]}
                      onPress={() => setReps("Failure")}
                    >
                      <Text
                        style={[
                          styles.targetAreaChipText,
                          reps === "Failure" && styles.targetAreaChipTextActive,
                        ]}
                      >
                        Failure
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <StepperRow label="Sets" value={sets} onChange={setSets} />
                {reps === "Failure" ? (
                  <InfoRow label="Reps" value="Failure" />
                ) : (
                  <StepperRow label="Reps" value={reps} onChange={setReps} />
                )}
                <EditableRow label="Load" value={editableLoad} onChange={setEditableLoad} placeholder="90 kg" />
                <EditableRow label="Rest" value={editableRest} onChange={setEditableRest} placeholder="90s" />
              </>
            ) : (
              <>
                <InfoRow label="Sets" value={sets || "—"} />
                <InfoRow label="Reps" value={reps || "—"} />
                <InfoRow label="Load" value={editableLoad || "—"} />
                <InfoRow label="Rest" value={editableRest || "—"} />
              </>
            )}
            {isEditing ? (
              <View style={styles.targetAreaBlock}>
                <Text style={styles.infoLabel}>Target area</Text>
                <View style={styles.targetAreaRow}>
                  {targetAreaOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.targetAreaChip, targetArea === option && styles.targetAreaChipActive]}
                      onPress={() => setTargetArea(option)}
                    >
                      <Text
                        style={[
                          styles.targetAreaChipText,
                          targetArea === option && styles.targetAreaChipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <InfoRow label="Target area" value={targetArea} />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <View style={styles.noteCard}>
            {isEditing ? (
              <TextInput
                value={editableNote}
                onChangeText={setEditableNote}
                multiline
                style={[styles.noteText, styles.noteInput]}
                placeholder="Add note"
                placeholderTextColor="#9ca1a8"
              />
            ) : (
              <Text style={styles.noteText}>
                {editableNote || "No additional notes."}
              </Text>
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
      </ScrollView>
      <FloatingNav active="stats" />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.inlineInput}
        placeholder={placeholder}
        placeholderTextColor="#9ca1a8"
      />
    </View>
  );
}

function StepperRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const currentValue = Number(value || "0");
  const safeValue = Number.isFinite(currentValue) ? currentValue : 0;

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.stepperInline}>
        <Pressable style={styles.stepperInlineButton} onPress={() => onChange(String(Math.max(0, safeValue - 1)))}>
          <Text style={styles.stepperInlineButtonText}>-</Text>
        </Pressable>
        <Text style={styles.stepperInlineValue}>{value || "0"}</Text>
        <Pressable style={styles.stepperInlineButton} onPress={() => onChange(String(safeValue + 1))}>
          <Text style={styles.stepperInlineButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
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
    paddingBottom: 24,
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
  editTap: {
    position: "absolute",
    right: 0,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9dbdf",
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  editTapText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#2a2d34",
    fontWeight: "700",
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
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  infoLabel: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8d9299",
  },
  infoValue: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  targetAreaBlock: {
    gap: 8,
  },
  targetAreaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  targetAreaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8dbe0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  targetAreaChipActive: {
    borderColor: "#17141f",
    backgroundColor: "#17141f",
  },
  targetAreaChipText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#5a616c",
    fontWeight: "700",
  },
  targetAreaChipTextActive: {
    color: "#f5f7fa",
  },
  inlineInput: {
    minWidth: 92,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8dbe0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    textAlign: "right",
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#171b22",
  },
  stepperInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperInlineButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#151920",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperInlineButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  stepperInlineValue: {
    minWidth: 28,
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noteText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#565d67",
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  errorCard: {
    marginTop: 18,
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
    opacity: 0.92,
  },
});
