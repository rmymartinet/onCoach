import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

export default function AddWorkoutScreen() {
  const router = useRouter();

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
          <Text style={styles.title}>Add workout</Text>
        </View>

        <Text style={styles.label}>Paste your notes</Text>

        <View style={styles.inputBox}>
          <Text style={styles.inputText}>squat 3x8 @90kg</Text>
          <Text style={styles.inputText}>bench 4x6 felt heavy today</Text>
          <Text style={styles.inputText}>row superset w pulldowns 4x10</Text>
          <Text style={styles.inputText}>finished w cable curls</Text>
        </View>

        <Pressable style={({ pressed }) => [styles.parseButton, pressed && styles.pressed]}>
          <Text style={styles.parseText}>Parse with AI ✨</Text>
        </Pressable>

        <Text style={styles.resultLabel}>— parsed result —</Text>

        <View style={styles.resultCard}>
          <Text style={styles.detected}>Detected: Nov 14</Text>

          <View style={styles.row}>
            <Text style={styles.exercise}>Back Squat</Text>
            <Text style={styles.value}>3 × 8 @ 90kg</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.exercise}>Bench Press</Text>
            <Text style={styles.value}>4 × 6 @ 75kg</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.exercise}>Barbell Row</Text>
            <Text style={styles.value}>4 × 10 (superset)</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.exercise}>Cable Curls</Text>
            <Text style={styles.value}>sets TBD</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          <Text style={styles.saveText}>Save session ✓</Text>
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
    margin: 12,
    borderRadius: 22,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backTap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#2a2d34",
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    fontWeight: "700",
    color: "#12151b",
  },
  label: {
    marginTop: 16,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#2a2f37",
    fontWeight: "600",
  },
  inputBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d5d6da",
    backgroundColor: "#f5f5f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  inputText: {
    fontFamily: Fonts.mono,
    ...Typography.bodySmall,
    color: "#666c75",
  },
  parseButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#090b10",
    alignItems: "center",
    justifyContent: "center",
  },
  parseText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f4f6f9",
    fontWeight: "700",
  },
  resultLabel: {
    marginTop: 18,
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#c5c8cd",
  },
  resultCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f2f2f3",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  detected: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#b4b7bc",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  exercise: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#20242b",
  },
  value: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#535a63",
  },
  saveButton: {
    marginTop: 20,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#0a0c10",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f4f6f9",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.92,
  },
});
