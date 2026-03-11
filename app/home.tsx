import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dayText}>Wednesday</Text>
            <Text style={styles.greeting}>Morning, Alex 👋</Text>
          </View>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.statsCard, pressed && styles.pressed]}
          onPress={() => router.push("/stats-detail")}
        >
          <View style={styles.statsTopRow}>
            <View>
              <Text style={styles.statsLabel}>THIS WEEK</Text>
              <View style={styles.statsValueRow}>
                <Text style={styles.statsValue}>3</Text>
                <Text style={styles.statsUnit}>workouts</Text>
              </View>
            </View>

            <View style={styles.statsRight}>
              <Text style={styles.statsLabel}>VOLUME</Text>
              <Text style={styles.statsTrend}>↑ +12%</Text>
            </View>
          </View>

          <View style={styles.barChartWrap}>
            <View style={[styles.chartBar, styles.chartBarTall]} />
            <View style={[styles.chartBar, styles.chartBarShort]} />
            <View style={[styles.chartBar, styles.chartBarMid]} />
            <View style={[styles.chartBar, styles.chartBarMid]} />
            <View style={[styles.chartBar, styles.chartBarTiny]} />
            <View style={[styles.chartBar, styles.chartBarTall]} />
            <View style={[styles.chartBar, styles.chartBarTiny]} />
          </View>
          <View style={styles.weekLabels}>
            <Text style={styles.weekLabel}>M</Text>
            <Text style={styles.weekLabel}>T</Text>
            <Text style={styles.weekLabel}>W</Text>
            <Text style={styles.weekLabel}>T</Text>
            <Text style={styles.weekLabel}>F</Text>
            <Text style={[styles.weekLabel, styles.weekLabelActive]}>S</Text>
            <Text style={styles.weekLabel}>S</Text>
          </View>

          <View style={styles.statsDivider} />

          <Text style={styles.prLabel}>Squat · 8-week PR</Text>
          <View style={styles.prRow}>
            <Text style={styles.prValue}>102.5 kg</Text>
            <Text style={styles.prDelta}>↑ +7.5</Text>
          </View>
          <View style={styles.sparkline}>
            <View style={styles.sparkSeg} />
            <View style={[styles.sparkSeg, styles.sparkSegUp]} />
            <View style={styles.sparkSeg} />
            <View style={[styles.sparkSeg, styles.sparkSegUp]} />
            <View style={[styles.sparkSeg, styles.sparkSegUp]} />
            <View style={styles.sparkSeg} />
            <View style={[styles.sparkSeg, styles.sparkSegUp]} />
          </View>
          <Text style={styles.statsHint}>Tap to see all exercises →</Text>
        </Pressable>

        <View style={styles.recoCard}>
          <Text style={styles.recoLabel}>RECOMMENDED TODAY</Text>
          <Text style={styles.recoTitle}>Lower Body</Text>
          <Text style={styles.recoBody}>4 days since last leg session. You&apos;re ready.</Text>

          <Pressable style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
            <Text style={styles.startButtonText}>Start this workout</Text>
          </Pressable>
        </View>

        <View style={styles.sessionsBlock}>
          <Text style={styles.sessionsTitle}>RECENT SESSIONS</Text>

          <View style={styles.sessionRow}>
            <View>
              <Text style={styles.sessionName}>Push Day</Text>
              <Text style={styles.sessionMeta}>9 sets · 42 min</Text>
            </View>
            <Text style={styles.sessionDate}>Yesterday</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sessionRow}>
            <View>
              <Text style={styles.sessionName}>Pull Day</Text>
              <Text style={styles.sessionMeta}>8 sets · 38 min</Text>
            </View>
            <Text style={styles.sessionDate}>Nov 12</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.labButton, pressed && styles.pressed]}
          onPress={() => router.push("/ai-lab")}
        >
          <Text style={styles.labEyebrow}>AI TESTING</Text>
          <Text style={styles.labTitle}>Open the workout lab</Text>
          <Text style={styles.labBody}>Parse notes, generate the next session, and refine it live.</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => router.push("/add-workout")}
        >
          <Text style={styles.addButtonText}>+ Add workout</Text>
        </Pressable>
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
    padding: 16,
  },
  container: {
    borderRadius: 36,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e8e8e8",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 28,
  },
  headerRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayText: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#b1b4b9",
    marginBottom: 2,
  },
  greeting: {
    fontFamily: Fonts.sans,
    ...Typography.title,
    color: "#161a20",
    fontWeight: "700",
  },
  avatarWrap: {
    paddingLeft: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: "#0d1015",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#f5f7fa",
    fontWeight: "700",
  },
  statsCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dedee2",
    backgroundColor: "#f5f5f6",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  statsTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statsLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#a0a5ad",
    letterSpacing: 0.8,
  },
  statsValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  statsValue: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#1c2027",
    fontWeight: "700",
  },
  statsUnit: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#8f949c",
  },
  statsRight: {
    alignItems: "flex-end",
  },
  statsTrend: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#22944b",
    fontWeight: "700",
  },
  barChartWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 34,
    paddingHorizontal: 2,
  },
  chartBar: {
    width: 26,
    borderRadius: 4,
    backgroundColor: "#d4d5d9",
  },
  chartBarTall: {
    height: 30,
    backgroundColor: "#2f3137",
  },
  chartBarMid: {
    height: 24,
  },
  chartBarShort: {
    height: 12,
  },
  chartBarTiny: {
    height: 3,
  },
  weekLabels: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  weekLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#b4b8be",
  },
  weekLabelActive: {
    color: "#16191f",
    fontWeight: "700",
  },
  statsDivider: {
    marginTop: 12,
    marginBottom: 12,
    height: 1,
    backgroundColor: "#e2e3e6",
  },
  prLabel: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#9ca1a8",
  },
  prRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  prValue: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#1b2027",
    fontWeight: "700",
  },
  prDelta: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#2a9b4d",
    fontWeight: "700",
  },
  sparkline: {
    marginTop: 8,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  sparkSeg: {
    width: 10,
    height: 2,
    backgroundColor: "#a3a8b0",
    transform: [{ rotate: "-25deg" }],
  },
  sparkSegUp: {
    transform: [{ rotate: "25deg" }],
    backgroundColor: "#707784",
  },
  statsHint: {
    marginTop: 8,
    textAlign: "right",
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#b1b5bb",
  },
  recoCard: {
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: "#07090d",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
  },
  recoLabel: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#707783",
    letterSpacing: 1,
  },
  recoTitle: {
    fontFamily: Fonts.serif,
    ...Typography.display,
    color: "#f2f4f7",
    fontWeight: "700",
  },
  recoBody: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#afb4bc",
  },
  startButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ececee",
  },
  startButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#151820",
    fontWeight: "700",
  },
  sessionsBlock: {
    marginTop: 22,
    gap: 14,
  },
  sessionsTitle: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#acb0b6",
    letterSpacing: 1,
    fontWeight: "600",
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sessionName: {
    fontFamily: Fonts.sans,
    ...Typography.sectionTitle,
    color: "#1a1e24",
    fontWeight: "700",
  },
  sessionMeta: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#a5aab1",
  },
  sessionDate: {
    marginTop: 8,
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#b0b4ba",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e1e4",
  },
  labButton: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dddccf",
    backgroundColor: "#f3f0e7",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  labEyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#989177",
    letterSpacing: 1,
  },
  labTitle: {
    marginTop: 6,
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#191d23",
    fontWeight: "700",
  },
  labBody: {
    marginTop: 4,
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#666d75",
  },
  addButton: {
    marginTop: 28,
    alignSelf: "center",
    minWidth: 140,
    height: 44,
    borderRadius: 99,
    backgroundColor: "#080a0e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  addButtonText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#f3f5f8",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.92,
  },
});
