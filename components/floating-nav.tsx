import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";

type NavKey = "home" | "stats" | "profile";

const items: {
  key: NavKey;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  href: "/home" | "/stats-detail" | "/profile";
}[] = [
  { key: "home", icon: "home-outline", href: "/home" },
  { key: "stats", icon: "chart-bar", href: "/stats-detail" },
  { key: "profile", icon: "account-outline", href: "/profile" },
];

export function FloatingNav({ active }: { active: NavKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 8 }]}>
      <View style={styles.shell}>
        {items.map((item) => {
          const selected = item.key === active;

          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.item,
                selected && styles.itemActive,
                pressed && styles.pressed,
              ]}
              onPress={() => router.replace(item.href)}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={20}
                color={selected ? "#0d1015" : "#f5f7fa"}
              />
              {!selected ? null : <Text style={styles.activeLabel}>{labelFor(item.key)}</Text>}
            </Pressable>
          );
        })}
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => router.push("/ai-workspace")}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#0d1015" />
        </Pressable>
      </View>
    </View>
  );
}

function labelFor(key: NavKey) {
  if (key === "home") return "Home";
  if (key === "stats") return "Stats";
  return "Me";
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 50,
  },
  shell: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: "#07090d",
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  item: {
    width: 42,
    height: 42,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  itemActive: {
    minWidth: 82,
    width: "auto",
    paddingHorizontal: 14,
    backgroundColor: "#f2f2f4",
    flexDirection: "row",
    gap: 8,
  },
  activeLabel: {
    fontFamily: Fonts.sans,
    ...Typography.caption,
    color: "#111318",
    fontWeight: "700",
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 99,
    backgroundColor: "#f2f2f4",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  pressed: {
    opacity: 0.9,
  },
});
