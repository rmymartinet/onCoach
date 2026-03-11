import type { RecommendationDraft } from "@/lib/ai-types";

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8081";
}

async function postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as TResponse & { message?: string };
  if (!response.ok) {
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return body;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "GET",
    credentials: "include",
  });

  const body = (await response.json().catch(() => ({}))) as TResponse & { message?: string };
  if (!response.ok) {
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return body;
}

export function parseWorkoutNote(rawText: string) {
  return postJson<{
    ok: true;
    model: string;
    parsedWorkout: unknown;
  }>("/api/ai/parse-workout-note", { rawText });
}

export function generateNextWorkout(payload: {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  latestWorkout?: unknown;
  constraints?: unknown;
  basedOnWorkoutId?: string;
}) {
  return postJson<{
    ok: true;
    model: string;
    recommendation: RecommendationDraft;
    recommendationId: string;
    threadId: string;
  }>("/api/ai/generate-next-workout", payload);
}

export function refineWorkout(payload: {
  currentRecommendation: RecommendationDraft;
  recommendationId: string;
  threadId?: string;
  userMessage: string;
  recentWorkouts?: unknown;
}) {
  return postJson<{
    ok: true;
    model: string;
    recommendationId: string;
    threadId: string;
    refinement: {
      message: string;
      action: unknown;
      recommendation: RecommendationDraft;
    };
  }>("/api/ai/refine-workout", payload);
}

export function saveParsedWorkout(payload: { rawText: string; parsedWorkout: unknown }) {
  return postJson<{
    ok: true;
    workoutId: string;
    exerciseCount: number;
  }>("/api/ai/save-parsed-workout", payload);
}

export function getAiContext() {
  return getJson<{
    ok: true;
    user: {
      id: string;
      name: string;
      email: string;
      goal: string | null;
      level: string | null;
      frequencyPerWeek: number | null;
      sessionDuration: number | null;
      equipment: unknown;
      splitPreference: string | null;
    } | null;
    recentWorkouts: unknown[];
    latestRecommendation: RecommendationDraft | null;
    latestWorkoutId: string | null;
    latestRecommendationId: string | null;
    latestThreadId: string | null;
  }>("/api/ai/context");
}
