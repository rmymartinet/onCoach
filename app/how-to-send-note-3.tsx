import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

export default function HowToSendNoteStepThreeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
        </View>

        <Text style={styles.stepLabel}>Step 3 of 3 · How to send a note</Text>
        <Text style={styles.title}>Note arrives in the app ✓</Text>
        <Text style={styles.subtitle}>
          The AI parses your note instantly. Review and save the structured session.
        </Text>

        <View style={styles.resultCard}>
          <Text style={styles.cardHeader}>Received from Apple Notes · Jambes</Text>

          <View style={styles.rawBox}>
            <Text style={styles.rawText}>Hack squat 3x10 2min 45/45+2.5/50</Text>
            <Text style={styles.rawText}>Leg extension 3x échec unilatéral...</Text>
          </View>

          <Text style={styles.aiParsed}>↓ AI parsed</Text>

          <View style={styles.structuredBox}>
            <Text style={styles.structuredHeader}>JAMBES · STRUCTURED</Text>

            <View style={styles.row}>
              <Text style={styles.exercise}>Hack Squat</Text>
              <Text style={styles.sets}>3×10 @ 50kg</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.exercise}>Leg Extension</Text>
              <Text style={styles.sets}>3× to failure</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.exercise}>Fente</Text>
              <Text style={styles.sets}>3×10 @ 12kg</Text>
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
            <Text style={styles.saveText}>Save session ✓</Text>
          </Pressable>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipText}>✅ Confirm and save your session</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            onPress={() => router.replace("/home")}
          >
            <Text style={styles.nextText}>Got it, let&apos;s go →</Text>
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
    margin: 12,
    borderRadius: 34,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 16,
  },
  progressWrap: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: "#d5d6d9",
  },
  progressActive: {
    backgroundColor: "#121418",
  },
  stepLabel: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#a7abb1",
  },
  title: {
    marginTop: 6,
    fontFamily: Fonts.serif,
    ...Typography.title,
    fontWeight: "700",
    color: "#101318",
  },
  subtitle: {
    marginTop: 8,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#5d6168",
  },
  resultCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: "#eceae3",
    borderWidth: 1,
    borderColor: "#e2ddd2",
    padding: 10,
    gap: 8,
  },
  cardHeader: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#aaa597",
  },
  rawBox: {
    borderRadius: 10,
    backgroundColor: "#dfddd8",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  rawText: {
    fontFamily: Fonts.mono,
    ...Typography.caption,
    color: "#6e6a61",
  },
  aiParsed: {
    textAlign: "center",
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#b5b1a8",
  },
  structuredBox: {
    borderRadius: 14,
    backgroundColor: "#080a0e",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  structuredHeader: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    letterSpacing: 1,
    color: "#6f7680",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  exercise: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f1f3f6",
  },
  sets: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#97a0ab",
  },
  saveButton: {
    marginTop: 4,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#0a0c10",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#f3f5f8",
    fontWeight: "700",
  },
  tipBox: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4d27f",
    backgroundColor: "#f8f2da",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tipText: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#7b6520",
  },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  backButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d2d3d7",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f1",
  },
  backText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#3f444d",
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#07090d",
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    fontWeight: "700",
    color: "#f3f5f8",
  },
  pressed: {
    opacity: 0.92,
  },
});
