import type { RecommendationDraft } from "@/lib/ai-types";

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8081";
}

async function postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
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
}) {
  return postJson<{
    ok: true;
    model: string;
    recommendation: RecommendationDraft;
  }>("/api/ai/generate-next-workout", payload);
}

export function refineWorkout(payload: {
  currentRecommendation: RecommendationDraft;
  userMessage: string;
  recentWorkouts?: unknown;
}) {
  return postJson<{
    ok: true;
    model: string;
    refinement: {
      message: string;
      action: unknown;
      recommendation: RecommendationDraft;
    };
  }>("/api/ai/refine-workout", payload);
}
