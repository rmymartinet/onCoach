import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

const modes = [
  {
    href: "/import-note",
    eyebrow: "Import from Notes",
    title: "Bring in a full note",
    body: "Paste or share a full Apple Note. The app detects sessions, lets you review them, then saves the right one.",
    cta: "Open notes import",
  },
  {
    href: "/paste-workout",
    eyebrow: "Quick paste",
    title: "Paste one workout",
    body: "Drop one session, parse it fast, save it, then generate the next workout from your recent history.",
    cta: "Paste a workout",
  },
  {
    href: "/manual-workout",
    eyebrow: "Manual entry",
    title: "Build it step by step",
    body: "Add a workout manually with a guided flow instead of a long form. Choose the split, add exercises, then review.",
    cta: "Add manually",
  },
];

export default function AddWorkoutModeScreen() {
  const router = useRouter();

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
            <Text style={styles.title}>Add workout</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.sectionTitle}>Choose how to add it</Text>
          <Text style={styles.sectionBody}>
            Pick the flow that matches what the user has right now: a full training note, one copied
            session, or a workout they want to enter manually.
          </Text>

          <View style={styles.cardList}>
            {modes.map((mode) => (
              <Pressable
                key={mode.href}
                style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}
                onPress={() => router.push(mode.href as never)}
              >
                <Text style={styles.modeEyebrow}>{mode.eyebrow}</Text>
                <Text style={styles.modeTitle}>{mode.title}</Text>
                <Text style={styles.modeBody}>{mode.body}</Text>
                <View style={styles.modeFooter}>
                  <Text style={styles.modeCta}>{mode.cta}</Text>
                  <Text style={styles.modeArrow}>→</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
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
  },
  container: {
    borderRadius: 20,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
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
  sectionTitle: {
    marginTop: 16,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#20242b",
    fontWeight: "700",
  },
  sectionBody: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#666c75",
  },
  cardList: {
    marginTop: 16,
    gap: 10,
  },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#f7f4ee",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  modeEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9097",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modeTitle: {
    fontFamily: Fonts.serif,
    ...Typography.sectionTitle,
    color: "#151920",
    fontWeight: "700",
  },
  modeBody: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#5e6570",
    lineHeight: 20,
  },
  modeFooter: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeCta: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#111318",
    fontWeight: "700",
  },
  modeArrow: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#111318",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.9,
  },
});
