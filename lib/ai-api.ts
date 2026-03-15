import type {
  AiWorkspaceClarificationDecision,
  NextTrainingDayDraft,
  NoteImportSegmentation,
  ParsedWorkoutCollection,
  RecommendationDraft,
  TrainingPlanDraft,
} from "@/lib/ai-types";

export type AiContextUser = {
  id: string;
  name: string;
  email: string;
  goal: string | null;
  level: string | null;
  frequencyPerWeek: number | null;
  sessionDuration: number | null;
  equipment: unknown;
  splitPreference: string | null;
  heightCm: number | null;
  weightKg: number | null;
  experienceYears: number | null;
  trainingLocation: string | null;
  preferredStyles: unknown;
  favoriteExercises: unknown;
  avoidedExercises: unknown;
  priorityMuscles: unknown;
  limitations: unknown;
  jobActivityLevel: string | null;
  preferredTrainingTimes: unknown;
  availableDays: unknown;
  onboardingCompletedAt: string | null;
};

export type AiContextWorkout = {
  id: string;
  title: string;
  rawText: string;
  cleanedSummary: string | null;
  sessionType: string | null;
  fatigueNote: string | null;
  performedAt: string | null;
  createdAt: string;
  exercises: unknown[];
};

export type AiContextTrainingPlanExercise = {
  id: string;
  order: number;
  name: string;
  normalizedName?: string | null;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  notes?: string | null;
  warmup?: boolean;
  exerciseType?: string | null;
  muscleGroups?: string[];
  equipment?: string[];
  substitutions?: string[];
};

export type AiContextTrainingPlanDay = {
  id: string;
  order: number;
  dayLabel: string;
  title: string;
  summary?: string | null;
  estimatedDurationMinutes?: number | null;
  exercises: AiContextTrainingPlanExercise[];
};

export type AiContextTrainingPlanWeek = {
  id: string;
  weekNumber: number;
  title: string;
  summary?: string | null;
  days: AiContextTrainingPlanDay[];
};

export type AiContextTrainingPlan = {
  id: string;
  title: string;
  goal?: string | null;
  level?: string | null;
  summary?: string | null;
  split?: string | null;
  status: string;
  source: string;
  progressionNotes?: string[];
  createdAt: string;
  updatedAt: string;
  weeks: AiContextTrainingPlanWeek[];
};

export type WorkoutDetailApiExercise = {
  id: string;
  name: string;
  normalizedName?: string | null;
  sets?: number | null;
  reps?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  weight?: number | null;
  unit?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
  order: number;
};

export type WorkoutDetailApiWorkout = {
  id: string;
  title: string;
  rawText: string;
  cleanedSummary: string | null;
  sessionType: string | null;
  fatigueNote: string | null;
  performedAt: string | null;
  createdAt: string;
  exercises: WorkoutDetailApiExercise[];
};

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function toAiUserProfile(user: AiContextUser | null) {
  if (!user) return null;

  return {
    goal: user.goal ?? "muscle_gain",
    level: user.level ?? "intermediate",
    frequencyPerWeek: user.frequencyPerWeek ?? 4,
    sessionDuration: user.sessionDuration ?? 45,
    equipment: asStringArray(user.equipment),
    splitPreference: user.splitPreference ?? "upper_lower",
    heightCm: user.heightCm ?? undefined,
    weightKg: user.weightKg ?? undefined,
    experienceYears: user.experienceYears ?? undefined,
    trainingLocation: user.trainingLocation ?? undefined,
    preferredStyles: asStringArray(user.preferredStyles),
    favoriteExercises: asStringArray(user.favoriteExercises),
    avoidedExercises: asStringArray(user.avoidedExercises),
    priorityMuscles: asStringArray(user.priorityMuscles),
    limitations: asStringArray(user.limitations),
    jobActivityLevel: user.jobActivityLevel ?? undefined,
    preferredTrainingTimes: asStringArray(user.preferredTrainingTimes),
    availableDays: asStringArray(user.availableDays),
  };
}

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

export function analyzeAiWorkspace(payload: {
  mode: "import_note" | "paste_workout" | "generate_from_scratch";
  sourceText?: string;
  messages?: { role: "assistant" | "user"; text: string }[];
  userProfile?: unknown;
  recentWorkouts?: unknown;
  trainingPlan?: unknown;
  clarificationRound?: number;
}) {
  return postJson<{
    ok: true;
    model: string;
    decision: AiWorkspaceClarificationDecision;
  }>("/api/ai/analyze-workspace", payload);
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

export function generateTrainingPlan(payload: {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  currentTrainingPlan?: unknown;
  currentTrainingPlanId?: string;
  userMessage?: string;
}) {
  return postJson<{
    ok: true;
    model: string;
    trainingPlan: TrainingPlanDraft;
    trainingPlanId: string;
    threadId: string | null;
  }>("/api/ai/generate-training-plan", payload);
}

export function updateTrainingPlan(payload: {
  trainingPlanId: string;
  trainingPlan: TrainingPlanDraft;
}) {
  return postJson<{
    ok: true;
    trainingPlanId: string;
  }>("/api/update-training-plan", payload);
}

export function generateNextTrainingDay(payload: {
  trainingPlan: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  userMessage?: string;
}) {
  return postJson<{
    ok: true;
    model: string;
    nextDay: NextTrainingDayDraft;
  }>("/api/ai/generate-next-training-day", payload);
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

export function deleteWorkout(workoutId: string) {
  return postJson<{ ok: true; workoutId: string }>("/api/delete-workout", {
    workoutId,
  });
}

export function deleteWorkoutExercise(exerciseId: string) {
  return postJson<{ ok: true; exerciseId: string; workoutId: string }>(
    "/api/delete-workout-exercise",
    {
      exerciseId,
    },
  );
}

export function getWorkout(workoutId: string) {
  return postJson<{
    ok: true;
    workout: WorkoutDetailApiWorkout;
  }>("/api/get-workout", { workoutId });
}

export function getTrainingPlan(trainingPlanId: string) {
  return postJson<{
    ok: true;
    trainingPlan: AiContextTrainingPlan;
  }>("/api/get-training-plan", { trainingPlanId });
}

export function appendTrainingPlanDay(payload: {
  trainingPlanId: string;
  nextDay: NextTrainingDayDraft;
}) {
  return postJson<{
    ok: true;
    trainingPlanId: string;
  }>("/api/append-training-plan-day", payload);
}

export function updateWorkoutExercise(payload: {
  exerciseId: string;
  workoutId: string;
  name?: string;
  sets?: number | null;
  reps?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  weight?: number | null;
  unit?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
}) {
  return postJson<{
    ok: true;
    exercise: WorkoutDetailApiExercise;
  }>("/api/update-workout-exercise", payload);
}

export function getAiContext() {
  return getJson<{
    ok: true;
    user: AiContextUser | null;
    recentWorkouts: AiContextWorkout[];
    trainingPlans: AiContextTrainingPlan[];
    latestRecommendation: RecommendationDraft | null;
    latestWorkoutId: string | null;
    latestRecommendationId: string | null;
    latestThreadId: string | null;
  }>("/api/ai/context");
}

export function updateProfile(payload: {
  goal?: string;
  level?: string;
  frequencyPerWeek?: number;
  sessionDuration?: number;
  splitPreference?: string;
  trainingLocation?: string;
  jobActivityLevel?: string;
  heightCm?: number;
  weightKg?: number;
  experienceYears?: number;
  equipment?: string[];
  preferredStyles?: string[];
  favoriteExercises?: string[];
  avoidedExercises?: string[];
  priorityMuscles?: string[];
  limitations?: string[];
  preferredTrainingTimes?: string[];
  availableDays?: string[];
  completeOnboarding?: boolean;
}) {
  return postJson<{
    ok: true;
    user: AiContextUser;
  }>("/api/profile", payload);
}

export function importNote(payload: {
  rawText: string;
  source?: "APPLE_NOTES_SHARE" | "MANUAL_PASTE";
}) {
  return postJson<{
    ok: true;
    model: string;
    noteImportId: string;
    summary?: NoteImportSegmentation["summary"];
    candidates: {
      id: string;
      title: string | null;
      rawExcerpt: string;
      performedAt: string | null;
      confidence?: number | null;
      isMostRecent: boolean;
      dedupeStatus: "PENDING" | "NEW" | "POSSIBLE_DUPLICATE" | "DUPLICATE";
      dedupeReason: string | null;
      matchedWorkoutId: string | null;
    }[];
  }>("/api/ai/import-note", payload);
}

export function parseNoteDirect(rawText: string) {
  return postJson<{
    ok: true;
    model: string;
    parsedCollection: ParsedWorkoutCollection;
  }>("/api/ai/parse-note-direct", { rawText });
}
