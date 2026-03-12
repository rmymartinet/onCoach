import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

const mockExercises = [
  { name: "Hack Squat", detail: "4 x 10 · 90s rest" },
  { name: "Leg Press", detail: "3 x 12 · 90s rest" },
  { name: "Leg Curl", detail: "3 x 12 · 60s rest" },
  { name: "Calf Raise", detail: "4 x 15 · 45s rest" },
];

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    meta?: string;
    time?: string;
    day?: string;
  }>();

  const title = params.title ?? "Workout";
  const meta = params.meta ?? "Session overview";
  const time = params.time ?? "8:10 AM";
  const day = params.day ?? "Wed 25";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.backTap, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.title}>Workout detail</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{day}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroMeta}>{meta}</Text>
          <Text style={styles.heroTime}>Completed at {time}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EXERCISES</Text>
          <View style={styles.exerciseList}>
            {mockExercises.map((exercise) => (
              <View key={exercise.name} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseDetail}>{exercise.detail}</Text>
              </View>
            ))}
          </View>
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
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    backgroundColor: "#f9f9f9",
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
  heroTime: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8f96a0",
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
  exerciseList: {
    gap: 10,
  },
  exerciseRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  exerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
  exerciseDetail: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7d838c",
  },
  pressed: {
    opacity: 0.92,
  },
});
