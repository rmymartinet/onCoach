import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

export default function OnboardingThreeScreen() {
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
          <Text style={styles.heroText}>📈</Text>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>Get smarter next workouts</Text>
          <Text style={styles.subtitle}>
            Based on your history, goals, and recovery — we tell you what to
            train next.
          </Text>
        </View>

        <View style={styles.recoCard}>
          <Text style={styles.recoLabel}>NEXT RECOMMENDED</Text>
          <Text style={styles.recoTitle}>Lower Body + Core</Text>
          <Text style={styles.recoBody}>
            You last trained legs 4 days ago. Good recovery window.
          </Text>
        </View>

        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/quick-profile")}
        >
          <Text style={styles.primaryButtonText}>Let&apos;s go →</Text>
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
    marginTop: 24,
    gap: 16,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#0f1115",
    fontWeight: "700",
    maxWidth: 340,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#5d6168",
  },
  recoCard: {
    marginTop: 34,
    borderRadius: 18,
    backgroundColor: "#07090d",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  recoLabel: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    letterSpacing: 1.2,
    color: "#8b9098",
  },
  recoTitle: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#f1f3f6",
    fontWeight: "700",
  },
  recoBody: {
    marginTop: 10,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#a6aab1",
  },
  dots: {
    marginTop: 32,
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
  primaryButton: {
    marginTop: 34,
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
  pressed: {
    opacity: 0.92,
  },
});
