import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Fonts } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.emoji}>💪</Text>

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Reps</Text>
          <Text style={styles.subtitle}>Your messy notes → smart workouts</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push("/sign-up")}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>

          <Text style={styles.footnote}>No account needed to start ↓</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  container: {
    flex: 1,
    margin: 16,
    borderRadius: 36,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  emoji: {
    fontSize: 44,
  },
  headingBlock: {
    marginTop: 12,
    gap: 12,
  },
  title: {
    fontSize: 46,
    lineHeight: 52,
    color: '#0f1115',
    fontFamily: Fonts.serif,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5f6368',
    fontSize: 29,
    lineHeight: 40,
    maxWidth: 360,
    fontFamily: Fonts.sans,
  },
  actions: {
    gap: 14,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05070c',
  },
  primaryButtonText: {
    color: '#f4f5f7',
    fontSize: 18,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#dfdfdf',
  },
  secondaryButtonText: {
    color: '#15171a',
    fontSize: 18,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  footnote: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#9ca1a8',
    fontFamily: Fonts.sans,
  },
  pressed: {
    opacity: 0.92,
  },
});
