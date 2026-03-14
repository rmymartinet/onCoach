import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

function ExerciseRow({
  name,
  best,
  delta,
  positive = true,
}: {
  name: string;
  best: string;
  delta: string;
  positive?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}>
      <View>
        <Text style={styles.exerciseName}>{name}</Text>
        <Text style={styles.exerciseBest}>Best: {best}</Text>
      </View>
      <View style={styles.exerciseRight}>
        <Text style={[styles.exerciseDelta, !positive && styles.exerciseDeltaNeutral]}>
          {positive ? "↑ " : "→ "}
          {delta}
        </Text>
        <View style={styles.sparkline}>
          <View style={styles.sparkSeg} />
          <View style={[styles.sparkSeg, styles.sparkSegUp]} />
          <View style={styles.sparkSeg} />
          <View style={[styles.sparkSeg, styles.sparkSegUp]} />
        </View>
      </View>
    </Pressable>
  );
}

export default function StatsDetailScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Progress</Text>

        <View style={styles.weekCard}>
          <Text style={styles.weekLabel}>WEEKLY SETS</Text>
          <View style={styles.weekValueRow}>
            <Text style={styles.weekValue}>28 sets</Text>
            <Text style={styles.weekDelta}>↑ +17%</Text>
          </View>

          <View style={styles.barsWrap}>
            <View style={[styles.bar, styles.bar3]} />
            <View style={[styles.bar, styles.bar4]} />
            <View style={[styles.bar, styles.bar3]} />
            <View style={[styles.bar, styles.bar5]} />
            <View style={[styles.bar, styles.bar5]} />
            <View style={[styles.bar, styles.bar6]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabel}>27</Text>
            <Text style={styles.barLabel}>3</Text>
            <Text style={styles.barLabel}>10</Text>
            <Text style={styles.barLabel}>17</Text>
            <Text style={styles.barLabel}>24</Text>
            <Text style={[styles.barLabel, styles.barLabelActive]}>1</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>EXERCISES · TAP TO DRILL DOWN</Text>

        <View style={styles.list}>
          <ExerciseRow name="Back Squat" best="102.5 kg" delta="+7.5 kg" />
          <ExerciseRow name="Bench Press" best="87.5 kg" delta="+5 kg" />
          <ExerciseRow name="Hack Squat" best="50 kg" delta="+2.5 kg" />
          <ExerciseRow name="Barbell Row" best="75 kg" delta="0 kg" positive={false} />
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
            onPress={() => router.push("/ai-workspace")}
          >
            <Text style={styles.nextText}>Next →</Text>
          </Pressable>
        </View>
      </View>
      <FloatingNav active="stats" />
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
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 108,
  },
  pageTitle: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    fontWeight: "700",
    color: "#171b21",
  },
  weekCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e2e5",
    backgroundColor: "#f5f5f6",
    padding: 14,
  },
  weekLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    letterSpacing: 0.8,
    color: "#a6aab1",
  },
  weekValueRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  weekValue: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    fontWeight: "700",
    color: "#1a1f26",
  },
  weekDelta: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#2d9c51",
    fontWeight: "700",
  },
  barsWrap: {
    marginTop: 12,
    height: 46,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bar: {
    width: 30,
    borderRadius: 3,
    backgroundColor: "#d4d5d9",
  },
  bar3: {
    height: 28,
  },
  bar4: {
    height: 36,
  },
  bar5: {
    height: 42,
  },
  bar6: {
    height: 48,
    backgroundColor: "#080a0d",
  },
  barLabels: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  barLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#b0b4ba",
  },
  barLabelActive: {
    color: "#12161c",
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 18,
    fontFamily: Fonts.sans,
    ...Typography.meta,
    letterSpacing: 0.8,
    color: "#a4a8af",
    fontWeight: "700",
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  exerciseRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e3e6",
    backgroundColor: "#f5f5f6",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseName: {
    fontFamily: Fonts.sans,
    ...Typography.button,
    color: "#1c2027",
    fontWeight: "700",
  },
  exerciseBest: {
    marginTop: 2,
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#a3a8b0",
  },
  exerciseRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  exerciseDelta: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#2c974f",
    fontWeight: "700",
  },
  exerciseDeltaNeutral: {
    color: "#9da3aa",
  },
  sparkline: {
    flexDirection: "row",
    gap: 2,
  },
  sparkSeg: {
    width: 10,
    height: 2,
    backgroundColor: "#7f878f",
    transform: [{ rotate: "-25deg" }],
  },
  sparkSegUp: {
    transform: [{ rotate: "25deg" }],
  },
  actions: {
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  backButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4d6da",
    backgroundColor: "#f1f1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  nextButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#07090d",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#313640",
    fontWeight: "600",
  },
  nextText: {
    fontFamily: Fonts.sans,
    ...Typography.buttonSmall,
    color: "#f4f6f9",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.92,
  },
});
