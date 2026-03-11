import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

const GOALS = ["Build muscle", "Lose fat", "Get stronger", "Stay active"] as const;
const FREQUENCIES = ["1–2x/wk", "3–4x/wk", "5+/wk"] as const;

type Goal = (typeof GOALS)[number];
type Frequency = (typeof FREQUENCIES)[number];

function Chip({
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

export default function QuickProfileScreen() {
  const router = useRouter();
  const [goal, setGoal] = useState<Goal>("Build muscle");
  const [frequency, setFrequency] = useState<Frequency>("3–4x/wk");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.copyBlock}>
          <Text style={styles.title}>Quick setup</Text>
          <Text style={styles.subtitle}>2 questions. That&apos;s it.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What&apos;s your main goal?</Text>
          <View style={styles.chipsWrap}>
            {GOALS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={goal === item}
                onPress={() => setGoal(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How often do you train?</Text>
          <View style={styles.chipsWrap}>
            {FREQUENCIES.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={frequency === item}
                onPress={() => setFrequency(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.bottomBlock}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push("/how-to-send-note")}
          >
            <Text style={styles.primaryButtonText}>Continue →</Text>
          </Pressable>

          <Text style={styles.footnote}>Update anytime in settings</Text>
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
    margin: 16,
    borderRadius: 36,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 36,
  },
  copyBlock: {
    gap: 16,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#0f1115",
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#5d6168",
  },
  section: {
    marginTop: 32,
    gap: 14,
  },
  sectionTitle: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#20242a",
    fontWeight: "700",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  chip: {
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cfcfd3",
    backgroundColor: "#f7f7f8",
    justifyContent: "center",
    alignItems: "center",
  },
  chipSelected: {
    borderColor: "#0b0d10",
    backgroundColor: "#0b0d10",
  },
  chipText: {
    fontFamily: Fonts.sans,
    ...Typography.chip,
    color: "#4c5259",
  },
  chipTextSelected: {
    color: "#f5f6f8",
    fontWeight: "700",
  },
  bottomBlock: {
    marginTop: "auto",
    gap: 16,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070c",
  },
  primaryButtonText: {
    color: "#f4f5f7",
    ...Typography.button,
    fontFamily: Fonts.sans,
    fontWeight: "700",
  },
  footnote: {
    textAlign: "center",
    ...Typography.bodySmall,
    color: "#b1b4b9",
    fontFamily: Fonts.sans,
  },
  pressed: {
    opacity: 0.92,
  },
});
