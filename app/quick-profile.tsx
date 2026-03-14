import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { getAiContext, updateProfile } from "@/lib/ai-api";

const levelOptions = [
  {
    label: "Beginner",
    value: "beginner",
    description: "Brand new or still learning the basics.",
  },
  {
    label: "Intermediate",
    value: "intermediate",
    description: "You already train and know your main lifts.",
  },
  {
    label: "Advanced",
    value: "advanced",
    description: "You want higher-level programming and progression.",
  },
] as const;

const goalOptions = [
  { label: "Build muscle", value: "muscle_gain" },
  { label: "Get stronger", value: "strength" },
  { label: "Lose fat", value: "fat_loss" },
  { label: "Stay athletic", value: "general_fitness" },
] as const;

const locationOptions = [
  { label: "Gym", value: "commercial_gym" },
  { label: "Home gym", value: "home_gym" },
  { label: "Hybrid", value: "hybrid" },
] as const;

const durationOptions = [30, 45, 60, 75] as const;
const equipmentOptions = ["Barbell", "Dumbbells", "Machines", "Cable station", "Rack", "Bench", "Bodyweight"] as const;

function ChoiceCard({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.choiceCard,
        selected && styles.choiceCardSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{label}</Text>
      {description ? (
        <Text style={[styles.choiceDescription, selected && styles.choiceDescriptionSelected]}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 1,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <View style={styles.stepperCard}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable style={styles.iconButton} onPress={() => onChange(Math.max(min, value - step))}>
          <Text style={styles.iconButtonText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable style={styles.iconButton} onPress={() => onChange(value + step)}>
          <Text style={styles.iconButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export default function QuickProfileScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<string>("intermediate");
  const [goal, setGoal] = useState<string>("muscle_gain");
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(4);
  const [sessionDuration, setSessionDuration] = useState<number>(45);
  const [trainingLocation, setTrainingLocation] = useState<string>("commercial_gym");
  const [equipment, setEquipment] = useState<string[]>(["Barbell", "Dumbbells", "Machines"]);
  const [limitationsInput, setLimitationsInput] = useState("");
  const [loadingAction, setLoadingAction] = useState<"bootstrap" | "save" | null>("bootstrap");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const result = await getAiContext();
        if (cancelled || !result.user) return;

        const user = result.user;
        setLevel(user.level ?? "intermediate");
        setGoal(user.goal ?? "muscle_gain");
        setFrequencyPerWeek(user.frequencyPerWeek ?? 4);
        setSessionDuration(user.sessionDuration ?? 45);
        setTrainingLocation(user.trainingLocation ?? "commercial_gym");
        setEquipment(
          Array.isArray(user.equipment)
            ? user.equipment.filter((item): item is string => typeof item === "string")
            : ["Barbell", "Dumbbells", "Machines"],
        );
        setLimitationsInput(
          Array.isArray(user.limitations)
            ? user.limitations.filter((item): item is string => typeof item === "string").join(", ")
            : "",
        );
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

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleContinue() {
    if (step < 5) {
      setStep((current) => current + 1);
      return;
    }

    setError(null);
    setLoadingAction("save");

    try {
      await updateProfile({
        level,
        goal,
        frequencyPerWeek,
        sessionDuration,
        trainingLocation,
        equipment: trainingLocation === "commercial_gym" ? [] : equipment,
        limitations: limitationsInput
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        completeOnboarding: true,
      });

      router.replace("/ai-workspace");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to save profile");
    } finally {
      setLoadingAction(null);
    }
  }

  const isBusy = loadingAction !== null;
  const totalSteps = 6;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Step {step + 1} of {totalSteps}</Text>
          <Text style={styles.title}>
            {step === 0 && "What best describes you?"}
            {step === 1 && "What do you want right now?"}
            {step === 2 && "How often do you want to train?"}
            {step === 3 && "How long should sessions be?"}
            {step === 4 && "Where do you train?"}
            {step === 5 && "Anything to avoid?"}
          </Text>
          <Text style={styles.subtitle}>
            {step === 0 && "We use this to set the right difficulty and progression."}
            {step === 1 && "Your main goal guides the whole training block."}
            {step === 2 && "Choose the weekly rhythm you actually want to keep."}
            {step === 3 && "We will build workouts that fit your real schedule."}
            {step === 4 && "Your setup changes exercise selection immediately."}
            {step === 5 && "Optional, but useful for safer and better recommendations."}
          </Text>
        </View>

        <View style={styles.progressRow}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <View key={index} style={[styles.progressDot, index === step && styles.progressDotActive]} />
          ))}
        </View>

        <View style={styles.sectionCard}>
          {step === 0 ? (
            <View style={styles.stack}>
              {levelOptions.map((item) => (
                <ChoiceCard
                  key={item.value}
                  label={item.label}
                  description={item.description}
                  selected={level === item.value}
                  onPress={() => setLevel(item.value)}
                />
              ))}
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.stack}>
              {goalOptions.map((item) => (
                <ChoiceCard
                  key={item.value}
                  label={item.label}
                  selected={goal === item.value}
                  onPress={() => setGoal(item.value)}
                />
              ))}
            </View>
          ) : null}

          {step === 2 ? (
            <Stepper label="Sessions per week" value={frequencyPerWeek} min={1} onChange={setFrequencyPerWeek} />
          ) : null}

          {step === 3 ? (
            <View style={styles.chipWrap}>
              {durationOptions.map((item) => (
                <ChoiceChip
                  key={item}
                  label={`${item} min`}
                  selected={sessionDuration === item}
                  onPress={() => setSessionDuration(item)}
                />
              ))}
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.stack}>
              <View style={styles.stack}>
                {locationOptions.map((item) => (
                  <ChoiceCard
                    key={item.value}
                    label={item.label}
                    selected={trainingLocation === item.value}
                    onPress={() => setTrainingLocation(item.value)}
                  />
                ))}
              </View>

              {trainingLocation !== "commercial_gym" ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.stack}>
                    <Text style={styles.fieldLabel}>Equipment</Text>
                    <View style={styles.chipWrap}>
                      {equipmentOptions.map((item) => (
                        <ChoiceChip
                          key={item}
                          label={item}
                          selected={equipment.includes(item)}
                          onPress={() => setEquipment((current) => toggleValue(current, item))}
                        />
                      ))}
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {step === 5 ? (
            <View style={styles.stack}>
              <TextInput
                value={limitationsInput}
                onChangeText={setLimitationsInput}
                placeholder="Low back pain, no barbell squat, shoulder discomfort..."
                placeholderTextColor="#9ba1a9"
                multiline
                style={styles.multilineInput}
              />
              <Text style={styles.footnote}>Leave blank if nothing special to report.</Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => (step === 0 ? router.back() : setStep((current) => current - 1))}
            disabled={isBusy}
          >
            <Text style={styles.secondaryButtonText}>{step === 0 ? "Back" : "Previous"}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={handleContinue}
            disabled={isBusy}
          >
            {loadingAction === "save" ? (
              <ActivityIndicator color="#f6f7f9" />
            ) : (
              <Text style={styles.primaryButtonText}>{step === totalSteps - 1 ? "Finish" : "Continue"}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  container: {
    flex: 1,
    margin: 14,
    borderRadius: 28,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 14,
  },
  header: {
    gap: 8,
  },
  kicker: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8e939b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#111419",
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#69707a",
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
  },
  progressDot: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e4e6ea",
  },
  progressDotActive: {
    backgroundColor: "#111419",
  },
  sectionCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e3e2dd",
    backgroundColor: "#fcfbf8",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  stack: {
    gap: 10,
  },
  choiceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d9dbe0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  choiceCardSelected: {
    borderColor: "#111419",
    backgroundColor: "#111419",
  },
  choiceTitle: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#1a1f26",
    fontWeight: "700",
  },
  choiceTitleSelected: {
    color: "#f6f7f9",
  },
  choiceDescription: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#6b727d",
  },
  choiceDescriptionSelected: {
    color: "#cdd2d9",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d6da",
    backgroundColor: "#f6f7f9",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    borderColor: "#111419",
    backgroundColor: "#111419",
  },
  chipText: {
    fontFamily: Fonts.sans,
    ...Typography.chip,
    color: "#4d545e",
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#f7f8fa",
  },
  stepperCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3e2dd",
    backgroundColor: "#fffefb",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  stepperLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8d929a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.display,
    color: "#181c23",
    fontWeight: "700",
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#111419",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#f6f7f9",
    fontWeight: "700",
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8d929a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e2dc",
  },
  multilineInput: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9dbe0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#1f242b",
    textAlignVertical: "top",
  },
  footnote: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8c9199",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4d6db",
    backgroundColor: "#f7f7f8",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#2b3139",
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1.2,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#0c0f14",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f6f7f9",
    fontWeight: "700",
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
    opacity: 0.92,
  },
});
