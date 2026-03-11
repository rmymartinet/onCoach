import type {
  CoachAction,
  ParsedWorkout,
  ParsedWorkoutExercise,
  RecommendationDraft,
  RecommendationExerciseDraft,
  RefineWorkoutResponse,
} from "@/lib/ai-types";

type ParseWorkoutResult = {
  parsedWorkout: ParsedWorkout;
  model: string;
};

type RecommendationResult = {
  recommendation: RecommendationDraft;
  model: string;
};

type RefineRecommendationResult = {
  refinement: RefineWorkoutResponse;
  model: string;
};

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeExercise(input: unknown, order: number): ParsedWorkoutExercise | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const name = asOptionalString(record.name);
  if (!name) return null;

  return {
    rawLine: asOptionalString(record.rawLine),
    name,
    normalizedName: asOptionalString(record.normalizedName),
    sets: asOptionalNumber(record.sets),
    reps: asOptionalNumber(record.reps),
    repMin: asOptionalNumber(record.repMin),
    repMax: asOptionalNumber(record.repMax),
    weight: asOptionalNumber(record.weight),
    unit: asOptionalString(record.unit),
    restSeconds: asOptionalNumber(record.restSeconds),
    notes: asOptionalString(record.notes),
    confidence: asOptionalNumber(record.confidence),
    order,
  };
}

function normalizeRecommendationExercise(
  input: unknown,
  order: number,
): RecommendationExerciseDraft | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const name = asOptionalString(record.name);
  const sets = asOptionalNumber(record.sets);
  const repMin = asOptionalNumber(record.repMin);
  const repMax = asOptionalNumber(record.repMax);
  const restSeconds = asOptionalNumber(record.restSeconds);

  if (!name || sets === undefined || repMin === undefined || repMax === undefined || restSeconds === undefined) {
    return null;
  }

  return {
    name,
    normalizedName: asOptionalString(record.normalizedName),
    order,
    sets,
    repMin,
    repMax,
    restSeconds,
    targetRpe: asOptionalNumber(record.targetRpe),
    rir: asOptionalNumber(record.rir),
    notes: asOptionalString(record.notes),
    warmup: typeof record.warmup === "boolean" ? record.warmup : undefined,
    exerciseType: asOptionalString(record.exerciseType),
    muscleGroups: Array.isArray(record.muscleGroups)
      ? record.muscleGroups.filter((value): value is string => typeof value === "string")
      : undefined,
    equipment: Array.isArray(record.equipment)
      ? record.equipment.filter((value): value is string => typeof value === "string")
      : undefined,
    substitutions: Array.isArray(record.substitutions)
      ? record.substitutions.filter((value): value is string => typeof value === "string")
      : undefined,
  };
}

function normalizeCoachAction(input: unknown): CoachAction {
  if (!input || typeof input !== "object") {
    return { type: "none" };
  }

  const record = input as Record<string, unknown>;
  const type = asOptionalString(record.type);
  if (!type) return { type: "none" };

  if (type === "replace_exercise") {
    const targetExercise = asOptionalString(record.targetExercise);
    const replacement = normalizeRecommendationExercise(record.replacement, 0);
    if (targetExercise && replacement) {
      return { type, targetExercise, replacement };
    }
  }

  if (type === "adjust_volume") {
    const deltaSets = asOptionalNumber(record.deltaSets);
    if (deltaSets !== undefined) {
      return { type, deltaSets, reason: asOptionalString(record.reason) };
    }
  }

  if (type === "adjust_rest") {
    const targetExercise = asOptionalString(record.targetExercise);
    const restSeconds = asOptionalNumber(record.restSeconds);
    if (targetExercise && restSeconds !== undefined) {
      return { type, targetExercise, restSeconds };
    }
  }

  if (type === "adjust_duration") {
    const estimatedDurationMinutes = asOptionalNumber(record.estimatedDurationMinutes);
    if (estimatedDurationMinutes !== undefined) {
      return { type, estimatedDurationMinutes };
    }
  }

  if (type === "regenerate_workout") {
    return { type, reason: asOptionalString(record.reason) };
  }

  return { type: "none" };
}

export function validateParsedWorkout(input: unknown): ParsedWorkout {
  if (!input || typeof input !== "object") {
    throw new Error("Parsed workout must be an object");
  }

  const record = input as Record<string, unknown>;
  const exercisesInput = Array.isArray(record.exercises) ? record.exercises : [];
  const exercises = exercisesInput
    .map((exercise, index) => normalizeExercise(exercise, index))
    .filter((exercise): exercise is ParsedWorkoutExercise => Boolean(exercise));

  if (exercises.length === 0) {
    throw new Error("Parsed workout must include at least one exercise");
  }

  return {
    title: asOptionalString(record.title),
    sessionType: asOptionalString(record.sessionType),
    performedAt: asOptionalString(record.performedAt),
    cleanedSummary: asOptionalString(record.cleanedSummary),
    fatigueNote: asOptionalString(record.fatigueNote),
    parseConfidence: asOptionalNumber(record.parseConfidence),
    exercises,
  };
}

export function validateRecommendationDraft(input: unknown): RecommendationDraft {
  if (!input || typeof input !== "object") {
    throw new Error("Recommendation must be an object");
  }

  const record = input as Record<string, unknown>;
  const title = asOptionalString(record.title);
  if (!title) {
    throw new Error("Recommendation must include a title");
  }

  const exercisesInput = Array.isArray(record.exercises) ? record.exercises : [];
  const exercises = exercisesInput
    .map((exercise, index) => normalizeRecommendationExercise(exercise, index))
    .filter((exercise): exercise is RecommendationExerciseDraft => Boolean(exercise));

  if (exercises.length === 0) {
    throw new Error("Recommendation must include at least one exercise");
  }

  return {
    title,
    goal: asOptionalString(record.goal),
    coachSummary: asOptionalString(record.coachSummary),
    explanation: asOptionalString(record.explanation),
    estimatedDurationMinutes: asOptionalNumber(record.estimatedDurationMinutes),
    exercises,
  };
}

export function validateRefineWorkoutResponse(input: unknown): RefineWorkoutResponse {
  if (!input || typeof input !== "object") {
    throw new Error("Refinement response must be an object");
  }

  const record = input as Record<string, unknown>;
  const message = asOptionalString(record.message);
  if (!message) {
    throw new Error("Refinement response must include a message");
  }

  return {
    message,
    action: normalizeCoachAction(record.action),
    recommendation: validateRecommendationDraft(record.recommendation),
  };
}

function buildParseWorkoutPrompt(rawText: string) {
  return [
    "You are a workout parsing assistant.",
    "Convert messy gym notes into strict JSON.",
    "Do not invent exercises that are not implied by the note.",
    "If a value is missing, omit it instead of guessing aggressively.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        title: "optional short session title",
        sessionType: "optional session type",
        performedAt: "optional ISO date if explicit",
        cleanedSummary: "optional concise summary",
        fatigueNote: "optional fatigue note",
        parseConfidence: 0.84,
        exercises: [
          {
            rawLine: "original line if useful",
            name: "Back Squat",
            normalizedName: "back squat",
            sets: 3,
            reps: 8,
            repMin: 8,
            repMax: 10,
            weight: 90,
            unit: "kg",
            restSeconds: 120,
            notes: "felt heavy",
            confidence: 0.92,
          },
        ],
      },
      null,
      2,
    ),
    "Workout note:",
    rawText,
  ].join("\n");
}

function buildGenerateWorkoutPrompt(input: {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  latestWorkout?: unknown;
  constraints?: unknown;
}) {
  return [
    "You are an AI strength coach.",
    "Generate the user's next workout in strict JSON only.",
    "Use recent history to avoid repeating the exact same stress too aggressively.",
    "Keep the workout editable and realistic.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        title: "Lower Body + Core",
        goal: "hypertrophy",
        coachSummary: "Leg focus with manageable fatigue after the previous push session.",
        explanation: "Short explanation of progression logic.",
        estimatedDurationMinutes: 45,
        exercises: [
          {
            name: "Back Squat",
            normalizedName: "back squat",
            sets: 4,
            repMin: 6,
            repMax: 8,
            restSeconds: 150,
            targetRpe: 8,
            rir: 2,
            notes: "Leave 1-2 reps in reserve on the top set.",
            warmup: false,
            exerciseType: "compound",
            muscleGroups: ["quads", "glutes"],
            equipment: ["barbell", "rack"],
            substitutions: ["Hack Squat", "Leg Press"],
          },
        ],
      },
      null,
      2,
    ),
    "User profile:",
    JSON.stringify(input.userProfile ?? null),
    "Recent workouts:",
    JSON.stringify(input.recentWorkouts ?? []),
    "Latest workout:",
    JSON.stringify(input.latestWorkout ?? null),
    "Constraints:",
    JSON.stringify(input.constraints ?? null),
  ].join("\n");
}

function buildRefineWorkoutPrompt(input: {
  currentRecommendation: RecommendationDraft;
  userMessage: string;
  recentWorkouts?: unknown;
}) {
  return [
    "You are an AI workout coach refining a proposed workout.",
    "Return strict JSON only.",
    "Keep as much of the current plan as possible unless the user asked for a larger change.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        message: "Short coach reply to the user.",
        action: {
          type: "replace_exercise",
          targetExercise: "Back Squat",
          replacement: {
            name: "Leg Press",
            normalizedName: "leg press",
            sets: 4,
            repMin: 10,
            repMax: 12,
            restSeconds: 120,
            notes: "Controlled reps.",
          },
        },
        recommendation: {
          title: "Lower Body + Core",
          goal: "hypertrophy",
          coachSummary: "Adjusted for knee-friendly quad work.",
          explanation: "Replaced squat with a more stable option.",
          estimatedDurationMinutes: 45,
          exercises: [],
        },
      },
      null,
      2,
    ),
    "Current recommendation:",
    JSON.stringify(input.currentRecommendation),
    "User message:",
    input.userMessage,
    "Recent workouts:",
    JSON.stringify(input.recentWorkouts ?? []),
  ].join("\n");
}

async function requestJsonFromOpenAI(options: {
  modelEnvKey: string;
  defaultModel: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env[options.modelEnvKey] ?? options.defaultModel;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      temperature: options.temperature,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return {
    model,
    json: JSON.parse(content) as unknown,
  };
}

export async function parseWorkoutNoteWithOpenAI(rawText: string): Promise<ParseWorkoutResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_PARSE_WORKOUT",
    defaultModel: "gpt-4.1-mini",
    systemPrompt: "You extract structured workout data from messy notes.",
    userPrompt: buildParseWorkoutPrompt(rawText),
    temperature: 0.2,
  });

  return {
    parsedWorkout: validateParsedWorkout(result.json),
    model: result.model,
  };
}

export async function generateNextWorkoutWithOpenAI(input: {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  latestWorkout?: unknown;
  constraints?: unknown;
}): Promise<RecommendationResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_GENERATE_WORKOUT",
    defaultModel: "gpt-4.1-mini",
    systemPrompt: "You generate structured workout recommendations in strict JSON.",
    userPrompt: buildGenerateWorkoutPrompt(input),
    temperature: 0.4,
  });

  return {
    recommendation: validateRecommendationDraft(result.json),
    model: result.model,
  };
}

export async function refineWorkoutWithOpenAI(input: {
  currentRecommendation: RecommendationDraft;
  userMessage: string;
  recentWorkouts?: unknown;
}): Promise<RefineRecommendationResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_REFINE_WORKOUT",
    defaultModel: "gpt-4.1-mini",
    systemPrompt: "You refine workout recommendations and return strict JSON only.",
    userPrompt: buildRefineWorkoutPrompt(input),
    temperature: 0.4,
  });

  return {
    refinement: validateRefineWorkoutResponse(result.json),
    model: result.model,
  };
}
