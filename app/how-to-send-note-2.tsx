import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function HowToSendNoteStepTwoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
        </View>

        <Text style={styles.stepLabel}>Step 2 of 3 · How to send a note</Text>
        <Text style={styles.title}>The iOS share sheet opens</Text>
        <Text style={styles.subtitle}>
          Your app appears at the top. Tap &quot;Reps&quot; to send the note directly.
        </Text>

        <View style={styles.sheetFrame}>
          <Text style={styles.sheetHeader}>Jambes · Apple Notes</Text>

          <View style={styles.appRow}>
            <View style={styles.appItem}>
              <View style={[styles.appIconWrap, styles.appIconActive]}>
                <IconSymbol
                  name="figure.strengthtraining.traditional"
                  size={18}
                  color="#f5f7f9"
                />
              </View>
              <Text style={styles.appNameActive}>Reps</Text>
            </View>

            <View style={styles.appItem}>
              <View style={styles.appIconWrap}>
                <IconSymbol name="airdrop" size={16} color="#c4c8cf" />
              </View>
              <Text style={styles.appName}>AirDrop</Text>
            </View>

            <View style={styles.appItem}>
              <View style={styles.appIconWrap}>
                <IconSymbol name="message.fill" size={16} color="#c4c8cf" />
              </View>
              <Text style={styles.appName}>Messages</Text>
            </View>

            <View style={styles.appItem}>
              <View style={styles.appIconWrap}>
                <IconSymbol name="envelope.fill" size={16} color="#c4c8cf" />
              </View>
              <Text style={styles.appName}>Mail</Text>
            </View>
          </View>

          <View style={styles.listWrap}>
            <Text style={styles.listItem}>Copier</Text>
            <Text style={styles.listItem}>Ouvrir dans Pages</Text>
            <Text style={styles.listItem}>Exporter au format Markdown</Text>
          </View>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipText}>☝️ Tap &quot;Reps&quot; in the app row</Text>
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
            onPress={() => router.push("/how-to-send-note-3")}
          >
            <Text style={styles.nextText}>Next →</Text>
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
  sheetFrame: {
    marginTop: 24,
    borderRadius: 20,
    backgroundColor: "#1a1b20",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2d33",
  },
  sheetHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8d9199",
  },
  appRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#26282f",
  },
  appItem: {
    alignItems: "center",
    width: 58,
    gap: 6,
  },
  appIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#3a3d44",
    alignItems: "center",
    justifyContent: "center",
  },
  appIconActive: {
    borderWidth: 2,
    borderColor: "#f4f5f8",
    backgroundColor: "#11141a",
  },
  appName: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#8b9099",
  },
  appNameActive: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#f3f5f8",
    fontWeight: "700",
  },
  listWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: "#2a2c33",
  },
  listItem: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#d0d4da",
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
  actions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
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
    ...Typography.button,
    fontWeight: "700",
    color: "#f3f5f8",
  },
  pressed: {
    opacity: 0.92,
  },
});
