import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

export default function OnboardingOneScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          style={styles.skipButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroText}>1 → 2</Text>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>Paste your raw notes</Text>
          <Text style={styles.subtitle}>
            Whatever you scribbled in Apple Notes - sets, weights, reps.
            Don&apos;t clean it up.
          </Text>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>squat 3x8 @90kg, bench 4x6</Text>
          <Text style={styles.noteText}>felt heavy, row superset w</Text>
          <Text style={styles.noteText}>pulldowns</Text>
        </View>

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.nextButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/onboarding-2")}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </Pressable>
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
  skipButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skipText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#9da1a6",
  },
  hero: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    ...Typography.heroIcon,
  },
  copyBlock: {
    marginTop: 30,
    gap: 16,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#0f1115",
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#5d6168",
  },
  noteBox: {
    marginTop: 34,
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 14,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  noteText: {
    fontFamily: Fonts.mono,
    ...Typography.meta,
    color: "#656a70",
  },
  dots: {
    marginTop: 34,
    flexDirection: "row",
    alignSelf: "center",
    gap: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: "#d2d3d6",
  },
  dotActive: {
    backgroundColor: "#14171c",
  },
  nextButton: {
    marginTop: 34,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070c",
  },
  nextButtonText: {
    color: "#f4f5f7",
    ...Typography.button,
    fontFamily: Fonts.sans,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.92,
  },
});
