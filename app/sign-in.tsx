import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Fonts } from "@/constants/theme";
import { Typography } from "@/constants/typography";
import { signInWithEmail } from "@/lib/auth-api";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const result = await signInWithEmail({ email, password });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? "Sign in failed.");
      return;
    }

    router.replace("/home");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Welcome back. Continue your training plan.</Text>

        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#9aa0a8"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#9aa0a8"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isSubmitting) && styles.pressed,
          ]}
          onPress={handleSubmit}
        >
          <Text style={styles.primaryButtonText}>{isSubmitting ? "Signing in..." : "Sign in"}</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/sign-up")} style={styles.linkButton}>
          <Text style={styles.linkText}>No account yet? Create one</Text>
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
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e8e8ea",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontFamily: Fonts.serif,
    ...Typography.title,
    color: "#11151b",
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#6a7078",
  },
  form: {
    marginTop: 20,
    gap: 12,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dcdde1",
    backgroundColor: "#f4f5f7",
    paddingHorizontal: 14,
    fontFamily: Fonts.sans,
    ...Typography.body,
    color: "#12161d",
  },
  error: {
    marginTop: 12,
    color: "#b42318",
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
  },
  primaryButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070c",
  },
  primaryButtonText: {
    color: "#f5f7fb",
    fontFamily: Fonts.sans,
    ...Typography.button,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 14,
    alignItems: "center",
  },
  linkText: {
    color: "#474d57",
    fontFamily: Fonts.sans,
    ...Typography.bodySmall,
  },
  pressed: {
    opacity: 0.9,
  },
});
