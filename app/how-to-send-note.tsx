import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function HowToSendNoteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
        </View>

        <Text style={styles.stepLabel}>Step 1 of 3 · How to send a note</Text>
        <Text style={styles.title}>Open your note in Apple Notes</Text>
        <Text style={styles.subtitle}>
          Find any workout note. Tap the share button (↑) at the top right.
        </Text>

        <View style={styles.phoneFrame}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>21:10</Text>
            <Text style={styles.statusText}>5G 46%</Text>
          </View>

          <View style={styles.mockHeader}>
            <IconSymbol name="chevron.left" size={18} color="#9aa0a8" />
            <View style={styles.sharePill}>
              <IconSymbol name="square.and.arrow.up" size={15} color="#f5f7f9" />
              <IconSymbol name="ellipsis" size={15} color="#f5f7f9" />
            </View>
          </View>

          <View style={styles.mockBody}>
            <Text style={styles.mockDim}>Jambes</Text>
            <Text style={styles.mockStrong}>Hack squat</Text>
            <Text style={styles.mockLine}>3x10 2 min 45/45+2.5/50</Text>
            <Text style={styles.mockDim}>
              Leg extension 3x echec unilatéral pyramide descendante...
            </Text>
          </View>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipText}>☝️ Tap the share button at the top right</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
          onPress={() => router.push("/how-to-send-note-2")}
        >
          <Text style={styles.nextText}>Next →</Text>
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
    paddingTop: 28,
    paddingBottom: 24,
  },
  progressWrap: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
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
    marginTop: 10,
    fontFamily: Fonts.serif,
    ...Typography.title,
    fontWeight: "700",
    color: "#101318",
  },
  subtitle: {
    marginTop: 10,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#5d6168",
  },
  phoneFrame: {
    marginTop: 24,
    borderRadius: 20,
    backgroundColor: "#04060a",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusText: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#f0f1f3",
  },
  mockHeader: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sharePill: {
    height: 36,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#8d939b",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  mockBody: {
    marginTop: 12,
    gap: 8,
  },
  mockDim: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#787e87",
  },
  mockStrong: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#f2f4f7",
    fontWeight: "700",
  },
  mockLine: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#ced2d8",
  },
  tipBox: {
    marginTop: 18,
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
  nextButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#07090d",
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    fontWeight: "700",
    color: "#f3f5f8",
  },
  pressed: {
    opacity: 0.92,
  },
});
