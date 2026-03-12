import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { FloatingNav } from "@/components/floating-nav";
import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Alex Martin</Text>
          <Text style={styles.subtitle}>Your training preferences, history and recovery settings.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Goal</Text>
          <Text style={styles.cardValue}>Muscle gain</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Split preference</Text>
          <Text style={styles.cardValue}>Upper / Lower</Text>
        </View>

        <Pressable style={styles.card}>
          <Text style={styles.cardLabel}>Equipment</Text>
          <Text style={styles.cardValue}>Machine + free weights</Text>
        </Pressable>
      </View>

      <FloatingNav active="profile" />
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
    paddingTop: 22,
    paddingBottom: 110,
    gap: 12,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: Fonts.sans,
    ...Typography.meta,
    color: "#a3a8b0",
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#161a20",
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
    color: "#727983",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dddddf",
    backgroundColor: "#f7f6f4",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  cardLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#9aa0a8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardValue: {
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#171b22",
    fontWeight: "700",
  },
});
