import type {
  AiWorkspaceClarificationDecision,
  CoachAction,
  NextTrainingDayDraft,
  NoteImportSegmentation,
  NoteWorkoutCandidate,
  ParsedWorkout,
  ParsedWorkoutCollection,
  ParsedWorkoutExercise,
  RecommendationDraft,
  RecommendationExerciseDraft,
  RefineWorkoutResponse,
  TrainingPlanDay,
  TrainingPlanDraft,
  TrainingPlanWeek,
} from "@/lib/ai-types";

type ParseWorkoutResult = {
  parsedWorkout: ParsedWorkout;
  model: string;
};

type RecommendationResult = {
  recommendation: RecommendationDraft;
  model: string;
};

type TrainingPlanResult = {
  trainingPlan: TrainingPlanDraft;
  model: string;
};

type NextTrainingDayResult = {
  nextDay: NextTrainingDayDraft;
  model: string;
};

type RefineRecommendationResult = {
  refinement: RefineWorkoutResponse;
  model: string;
};

type SegmentNoteImportResult = {
  segmentation: NoteImportSegmentation;
  model: string;
};

type ParseWorkoutCollectionResult = {
  parsedCollection: ParsedWorkoutCollection;
  model: string;
};

type WorkspaceDecisionResult = {
  decision: AiWorkspaceClarificationDecision;
  model: string;
};

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

type ExerciseMetadata = {
  method?: string;
  targetArea?: string;
  repMode?: "standard" | "failure";
  extra?: Record<string, string>;
};

type InferredExerciseData = {
  sets?: number;
  reps?: number;
  repMin?: number;
  repMax?: number;
  weight?: number;
  unit?: string;
  restSeconds?: number;
  method?: string;
  repMode?: "standard" | "failure";
};

function inferMethodExtrasFromText(value: string, method?: string) {
  const raw = value.trim();
  const lower = raw.toLowerCase();
  const extra: Record<string, string> = {};

  if (method === "Drop set") {
    const weights = [...raw.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?/gi)]
      .map((match) => match[1]?.replace(",", "."))
      .filter((entry): entry is string => Boolean(entry));
    if (weights.length >= 2) {
      extra.dropWeights = weights.join("|");
    }
  }

  if (method === "Rest-pause") {
    const pauseMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|secondes?|min|mins|minute|minutes)\b/);
    const miniSetMatch = lower.match(/(\d+)\s*(?:mini[- ]?sets?|clusters?|rounds?)/);
    if (pauseMatch?.[1]) {
      const pauseValue = Number(pauseMatch[1].replace(",", "."));
      if (Number.isFinite(pauseValue)) {
        extra.restPauseSeconds = lower.includes("min")
          ? `${Math.round(pauseValue * 60)}`
          : `${Math.round(pauseValue)}`;
      }
    }
    if (miniSetMatch?.[1]) {
      extra.restPauseMiniSets = miniSetMatch[1];
    }
  }

  if (method === "Myo-reps") {
    const activationMatch = lower.match(/activation\s*(\d+)/);
    const miniMatch = lower.match(/mini\s*(?:reps?)?\s*(\d+)/);
    const roundsMatch = lower.match(/(\d+)\s*rounds?/);
    const restMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|secondes?)\b/);
    if (activationMatch?.[1]) extra.myoActivationReps = activationMatch[1];
    if (miniMatch?.[1]) extra.myoMiniReps = miniMatch[1];
    if (roundsMatch?.[1]) extra.myoRounds = roundsMatch[1];
    if (restMatch?.[1]) extra.myoRestSeconds = `${Math.round(Number(restMatch[1].replace(",", ".")))}`;
  }

  if (method === "Tempo") {
    const tempoMatch = raw.match(/\b(\d)\s*[-/]\s*(\d)\s*[-/]\s*(\d)\s*[-/]\s*(\d)\b/);
    if (tempoMatch) {
      extra.tempoEccentric = tempoMatch[1];
      extra.tempoStretch = tempoMatch[2];
      extra.tempoConcentric = tempoMatch[3];
      extra.tempoTop = tempoMatch[4];
    }
  }

  if (method === "Custom" && /(giant set|triset|tri-set|cluster|circuit)/.test(lower)) {
    const customName = lower.includes("giant set")
      ? "Giant set"
      : lower.includes("triset") || lower.includes("tri-set")
        ? "Triset"
        : lower.includes("cluster")
          ? "Cluster"
          : "Circuit";
    extra.customName = customName;
  }

  return extra;
}

function inferTargetAreaFromText(value: string) {
  const raw = value.toLowerCase();

  if (
    /(presse|leg press|squat|quad|glute|calf|ham|ischio|leg extension|leg curl|hack|fente|lunge|mollet|adductor|abductor)/.test(
      raw,
    )
  ) {
    return "Lower";
  }
  if (/(bench|chest|fly|pec|dip|push-up|push up)/.test(raw)) {
    return "Push";
  }
  if (/(row|pull|lat|pulldown|tirage|back|trap)/.test(raw)) {
    return "Pull";
  }
  if (/(shoulder press|military press|lateral raise|rear delt|shoulder)/.test(raw)) {
    return "Shoulders";
  }
  if (/(biceps|triceps|curl|extension corde|skull crusher|arm)/.test(raw)) {
    return "Arms";
  }
  if (/(core|ab|plank|crunch|sit-up|sit up)/.test(raw)) {
    return "Core";
  }

  return "Exercise";
}

function splitNotesMetadata(notes?: string) {
  const trimmed = notes?.trim() ?? "";
  if (!trimmed) {
    return {
      metadata: { extra: {} } as ExerciseMetadata,
      freeform: "",
    };
  }

  if (!trimmed.startsWith("method=") && !trimmed.includes("targetArea=") && !trimmed.includes("repMode=")) {
    return {
      metadata: { extra: {} } as ExerciseMetadata,
      freeform: trimmed,
    };
  }

  const [metaPart, freeform = ""] = trimmed.split("||");
  const metadata: ExerciseMetadata = { extra: {} };

  for (const entry of metaPart.split(";").map((item) => item.trim()).filter(Boolean)) {
    const [key, ...rest] = entry.split("=");
    const value = rest.join("=").trim();
    if (!key || !value) continue;

    if (key === "method") metadata.method = value;
    if (key === "targetArea") metadata.targetArea = value;
    if (key === "repMode" && (value === "standard" || value === "failure")) {
      metadata.repMode = value;
    } else if (key !== "method" && key !== "targetArea" && key !== "repMode") {
      metadata.extra![key] = value;
    }
  }

  return {
    metadata,
    freeform: freeform.trim(),
  };
}

function detectMethodFromText(value: string) {
  const raw = value.toLowerCase();
  if (/(superset|super set)/.test(raw)) return "Superset";
  if (/(drop ?set|dropset|dégressif|degressif)/.test(raw)) return "Drop set";
  if (/rest[- ]?pause/.test(raw)) return "Rest-pause";
  if (/myo/.test(raw)) return "Myo-reps";
  if (/tempo/.test(raw)) return "Tempo";
  if (/(giant set|triset|tri-set|cluster|circuit)/.test(raw)) return "Custom";
  return undefined;
}

function inferExerciseDataFromText(value: string): InferredExerciseData {
  const raw = value.trim();
  const lower = raw.toLowerCase();
  const setRepMatch = raw.match(/(\d+)\s*x\s*(\d+)(?:\s*[-a]\s*(\d+))?/i);
  const setsOnlyMatch = raw.match(/(\d+)\s*sets?\b/i);
  const repsOnlyMatch = raw.match(/(\d+)\s*reps?\b/i);
  const restMinutesMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes)\b/i);
  const restSecondsMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|secondes?)\b/i);
  const weightAtMatch = raw.match(/(?:@|at\s+)(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\b/i);
  const weightLooseMatch = raw.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\b/i);
  const repMode = /\b(echec|échec|failure)\b/i.test(lower) ? "failure" : "standard";
  const sets = setRepMatch?.[1] ? Number(setRepMatch[1]) : setsOnlyMatch?.[1] ? Number(setsOnlyMatch[1]) : undefined;
  const firstReps = setRepMatch?.[2] ? Number(setRepMatch[2]) : repsOnlyMatch?.[1] ? Number(repsOnlyMatch[1]) : undefined;
  const secondReps = setRepMatch?.[3] ? Number(setRepMatch[3]) : undefined;
  const weightMatch = weightAtMatch ?? weightLooseMatch;
  const weight = weightMatch?.[1] ? Number(weightMatch[1].replace(",", ".")) : undefined;
  const unit = weightMatch?.[2]?.toLowerCase().startsWith("lb") ? "lb" : weightMatch?.[2] ? "kg" : undefined;
  const restSeconds = restMinutesMatch?.[1]
    ? Math.round(Number(restMinutesMatch[1].replace(",", ".")) * 60)
    : restSecondsMatch?.[1]
      ? Math.round(Number(restSecondsMatch[1].replace(",", ".")))
      : undefined;

  return {
    sets: Number.isFinite(sets) ? sets : undefined,
    reps: repMode === "failure" ? undefined : Number.isFinite(firstReps) && !secondReps ? firstReps : undefined,
    repMin: repMode === "failure" ? undefined : Number.isFinite(firstReps) ? firstReps : undefined,
    repMax: repMode === "failure" ? undefined : Number.isFinite(secondReps) ? secondReps : Number.isFinite(firstReps) ? firstReps : undefined,
    weight: Number.isFinite(weight) ? weight : undefined,
    unit,
    restSeconds,
    method: detectMethodFromText(lower),
    repMode,
  };
}

function buildNotesWithMetadata(
  notes: string | undefined,
  metadataPatch: ExerciseMetadata,
) {
  const current = splitNotesMetadata(notes);
  const metadata: ExerciseMetadata = {
    ...current.metadata,
    ...metadataPatch,
    extra: {
      ...(current.metadata.extra ?? {}),
      ...(metadataPatch.extra ?? {}),
    },
  };

  if (!metadata.method && (metadata.targetArea || metadata.repMode === "failure")) {
    metadata.method = "Standard";
  }

  const parts: string[] = [];
  if (metadata.method) parts.push(`method=${metadata.method}`);
  if (metadata.targetArea) parts.push(`targetArea=${metadata.targetArea}`);
  if (metadata.repMode === "failure") parts.push("repMode=failure");
  for (const [key, value] of Object.entries(metadata.extra ?? {})) {
    if (value.trim()) {
      parts.push(`${key}=${value}`);
    }
  }

  if (!parts.length) {
    return current.freeform || undefined;
  }

  return current.freeform ? `${parts.join("; ")} || ${current.freeform}` : parts.join("; ");
}

const sectionHeadingPatterns: { label: string; pattern: RegExp }[] = [
  {
    label: "Lower Body",
    pattern: /^(jambes?|legs?|leg day|lower body|bas du corps)$/i,
  },
  { label: "Back", pattern: /^(dos|back|pull|pull day)$/i },
  { label: "Chest", pattern: /^(pecs?|chest|push|push day)$/i },
  { label: "Shoulders", pattern: /^(epaules?|shoulders?)$/i },
  { label: "Arms", pattern: /^(bras|arms?)$/i },
  { label: "Upper Body", pattern: /^(haut du corps|upper body|upper)$/i },
  { label: "Full Body", pattern: /^(full body|fullbody)$/i },
];

function normalizeExercise(
  input: unknown,
  order: number,
): ParsedWorkoutExercise | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const name = asOptionalString(record.name);
  if (!name) return null;

  const rawLine = asOptionalString(record.rawLine);
  const normalizedName = asOptionalString(record.normalizedName);
  const notes = asOptionalString(record.notes);
  const sourceText = [name, normalizedName, rawLine, notes].filter(Boolean).join(" ");
  const targetArea = inferTargetAreaFromText(sourceText);
  const inferred = inferExerciseDataFromText(sourceText);

  return {
    rawLine,
    name,
    normalizedName,
    sets: asOptionalNumber(record.sets) ?? inferred.sets,
    reps: asOptionalNumber(record.reps) ?? inferred.reps,
    repMin: asOptionalNumber(record.repMin) ?? inferred.repMin,
    repMax: asOptionalNumber(record.repMax) ?? inferred.repMax,
    weight: asOptionalNumber(record.weight) ?? inferred.weight,
    unit: asOptionalString(record.unit) ?? inferred.unit,
    restSeconds: asOptionalNumber(record.restSeconds) ?? inferred.restSeconds,
    notes: buildNotesWithMetadata(notes, {
      targetArea,
      method: inferred.method,
      repMode: inferred.repMode,
    }),
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
  const notes = asOptionalString(record.notes);
  const sourceText = [name, asOptionalString(record.normalizedName), notes].filter(Boolean).join(" ");
  const inferred = inferExerciseDataFromText(sourceText);
  const targetArea = inferTargetAreaFromText(sourceText);
  const method = inferred.method ?? detectMethodFromText(sourceText);
  const methodExtras = inferMethodExtrasFromText(sourceText, method);

  if (
    !name ||
    sets === undefined ||
    repMin === undefined ||
    repMax === undefined ||
    restSeconds === undefined
  ) {
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
    notes: buildNotesWithMetadata(notes, {
      targetArea,
      method,
      repMode: inferred.repMode,
      extra: methodExtras,
    }),
    warmup: typeof record.warmup === "boolean" ? record.warmup : undefined,
    exerciseType: asOptionalString(record.exerciseType),
    muscleGroups: Array.isArray(record.muscleGroups)
      ? record.muscleGroups.filter(
          (value): value is string => typeof value === "string",
        )
      : undefined,
    equipment: Array.isArray(record.equipment)
      ? record.equipment.filter(
          (value): value is string => typeof value === "string",
        )
      : undefined,
    substitutions: Array.isArray(record.substitutions)
      ? record.substitutions.filter(
          (value): value is string => typeof value === "string",
        )
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
    const estimatedDurationMinutes = asOptionalNumber(
      record.estimatedDurationMinutes,
    );
    if (estimatedDurationMinutes !== undefined) {
      return { type, estimatedDurationMinutes };
    }
  }

  if (type === "regenerate_workout") {
    return { type, reason: asOptionalString(record.reason) };
  }

  return { type: "none" };
}

function normalizeNoteWorkoutCandidate(
  input: unknown,
): NoteWorkoutCandidate | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const rawExcerpt = asOptionalString(record.rawExcerpt);
  if (!rawExcerpt) return null;

  return {
    title: asOptionalString(record.title),
    rawExcerpt,
    performedAt: asOptionalString(record.performedAt),
    confidence: asOptionalNumber(record.confidence),
    isMostRecent:
      typeof record.isMostRecent === "boolean"
        ? record.isMostRecent
        : undefined,
    fingerprint: asOptionalString(record.fingerprint),
  };
}

export function validateParsedWorkout(input: unknown): ParsedWorkout {
  if (!input || typeof input !== "object") {
    throw new Error("Parsed workout must be an object");
  }

  const record = input as Record<string, unknown>;
  const exercisesInput = Array.isArray(record.exercises)
    ? record.exercises
    : [];
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

export function validateRecommendationDraft(
  input: unknown,
): RecommendationDraft {
  if (!input || typeof input !== "object") {
    throw new Error("Recommendation must be an object");
  }

  const record = input as Record<string, unknown>;
  const title = asOptionalString(record.title);
  if (!title) {
    throw new Error("Recommendation must include a title");
  }

  const exercisesInput = Array.isArray(record.exercises)
    ? record.exercises
    : [];
  const exercises = exercisesInput
    .map((exercise, index) => normalizeRecommendationExercise(exercise, index))
    .filter((exercise): exercise is RecommendationExerciseDraft =>
      Boolean(exercise),
    );

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

function normalizeTrainingPlanDay(
  input: unknown,
  index: number,
): TrainingPlanDay | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const dayLabel = asOptionalString(record.dayLabel);
  const title = asOptionalString(record.title);
  if (!dayLabel || !title) {
    return null;
  }

  const exercisesInput = Array.isArray(record.exercises)
    ? record.exercises
    : [];
  const exercises = exercisesInput
    .map((exercise, exerciseIndex) =>
      normalizeRecommendationExercise(exercise, exerciseIndex),
    )
    .filter((exercise): exercise is RecommendationExerciseDraft =>
      Boolean(exercise),
    );

  if (exercises.length === 0) {
    return null;
  }

  const normalizedExercises = normalizePlanExerciseRelationships(exercises);

  return {
    dayLabel,
    title,
    summary: asOptionalString(record.summary),
    estimatedDurationMinutes: asOptionalNumber(record.estimatedDurationMinutes),
    exercises: normalizedExercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      order: exerciseIndex,
    })),
  };
}

function normalizePlanExerciseRelationships(
  exercises: RecommendationExerciseDraft[],
) {
  return exercises.map((exercise, index, list) => {
    const parsed = splitNotesMetadata(exercise.notes);
    const method = parsed.metadata.method ?? detectMethodFromText(exercise.notes ?? "");
    const nextExercise = list[index + 1];

    if (method !== "Superset" || !nextExercise) {
      return exercise;
    }

    const pairName =
      parsed.metadata.extra?.pairName?.trim() || nextExercise.name.trim();

    const nextParsed = splitNotesMetadata(nextExercise.notes);
    const nextMethod =
      nextParsed.metadata.method ?? detectMethodFromText(nextExercise.notes ?? "");

    if (nextMethod !== "Superset") {
      nextExercise.notes = buildNotesWithMetadata(nextExercise.notes, {
        method: "Superset",
        extra: {
          pairName: exercise.name.trim(),
        },
      });
    } else if (!nextParsed.metadata.extra?.pairName?.trim()) {
      nextExercise.notes = buildNotesWithMetadata(nextExercise.notes, {
        extra: {
          pairName: exercise.name.trim(),
        },
      });
    }

    return {
      ...exercise,
      notes: buildNotesWithMetadata(exercise.notes, {
        method: "Superset",
        extra: {
          pairName,
        },
      }),
    };
  });
}

export function validateTrainingPlanDay(input: unknown): TrainingPlanDay {
  const day = normalizeTrainingPlanDay(input, 0);
  if (!day) {
    throw new Error("Training plan day must include a label, title, and exercises");
  }

  return day;
}

function normalizeTrainingPlanWeek(
  input: unknown,
  index: number,
): TrainingPlanWeek | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const title = asOptionalString(record.title);
  const weekNumber = asOptionalNumber(record.weekNumber) ?? index + 1;
  if (!title) {
    return null;
  }

  const daysInput = Array.isArray(record.days) ? record.days : [];
  const days = daysInput
    .map((day, dayIndex) => normalizeTrainingPlanDay(day, dayIndex))
    .filter((day): day is TrainingPlanDay => Boolean(day));

  if (days.length === 0) {
    return null;
  }

  return {
    weekNumber,
    title,
    summary: asOptionalString(record.summary),
    days,
  };
}

function parseCountToken(value: string) {
  const normalized = value.toLowerCase();
  const dictionary: Record<string, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six_fr: 6,
  };
  return dictionary[normalized === "six" ? "six" : normalized] ?? null;
}

function extractRequestedWeekCount(userMessage?: string) {
  const raw = userMessage?.toLowerCase() ?? "";
  const match = raw.match(/\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:week|weeks|semaine|semaines)\b/);
  if (!match?.[1]) return null;
  return parseCountToken(match[1]);
}

function extractRequestedDayCount(userMessage?: string) {
  const raw = userMessage?.toLowerCase() ?? "";
  const match = raw.match(/\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:day|days|jour|jours|session|sessions|workout|workouts)\b/);
  if (!match?.[1]) return null;
  return parseCountToken(match[1]);
}

function sanitizeTrainingPlanStructure(
  plan: TrainingPlanDraft,
  userMessage?: string,
) {
  const requestedWeeks = extractRequestedWeekCount(userMessage);
  const requestedDays = extractRequestedDayCount(userMessage);

  let weeks = plan.weeks;

  if (requestedWeeks && requestedWeeks > 0) {
    weeks = weeks.slice(0, requestedWeeks);
  } else if (requestedDays && requestedDays > 0) {
    weeks = weeks.slice(0, 1);
  }

  if (requestedDays && requestedDays > 0) {
    weeks = weeks.map((week) => ({
      ...week,
      days: week.days.slice(0, requestedDays).map((day, index) => ({
        ...day,
        exercises: day.exercises.map((exercise, exerciseIndex) => ({
          ...exercise,
          order: exerciseIndex,
        })),
      })),
    }));
  }

  return {
    ...plan,
    weeks: weeks.map((week, index) => ({
      ...week,
      weekNumber: index + 1,
      days: week.days,
    })),
  };
}

function userExplicitlyWantsMethodsEverywhere(userMessage?: string) {
  const raw = userMessage?.toLowerCase() ?? "";
  return /(all exercises|every exercise|each exercise|partout|tous les exercices|chaque exercice)/.test(raw);
}

function exerciseLooksLikeHeavyCompound(name: string) {
  const raw = name.toLowerCase();
  return /(squat|deadlift|bench press|barbell row|overhead press|military press|hack squat|leg press|romanian deadlift|pull-up|pull up|chin-up|chin up|dip\b)/.test(
    raw,
  );
}

function stripAdvancedMethodMetadata(notes?: string) {
  const parsed = splitNotesMetadata(notes);
  return buildNotesWithMetadata(parsed.freeform || undefined, {
    targetArea: parsed.metadata.targetArea,
    repMode: parsed.metadata.repMode,
    method: "Standard",
    extra: {
      timelineDate: parsed.metadata.extra?.timelineDate ?? "",
      timelineWeek: parsed.metadata.extra?.timelineWeek ?? "",
      timelineMonth: parsed.metadata.extra?.timelineMonth ?? "",
    },
  });
}

function sanitizeTrainingPlanAdvancedMethods(
  plan: TrainingPlanDraft,
  userMessage?: string,
) {
  if (userExplicitlyWantsMethodsEverywhere(userMessage)) {
    return plan;
  }

  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => {
        const maxAdvancedSlots = Math.max(1, Math.min(3, Math.floor(day.exercises.length / 3) || 1));
        let usedAdvancedSlots = 0;

        const sanitizedExercises = day.exercises.map((exercise, index, list) => {
          const parsed = splitNotesMetadata(exercise.notes);
          const method = parsed.metadata.method ?? detectMethodFromText(exercise.notes ?? "");

          if (!method || method === "Standard") {
            return exercise;
          }

          const heavyCompound = exerciseLooksLikeHeavyCompound(exercise.name);
          const nextExercise = list[index + 1];

          if (method === "Superset") {
            if (heavyCompound || usedAdvancedSlots >= maxAdvancedSlots || !nextExercise) {
              return {
                ...exercise,
                notes: stripAdvancedMethodMetadata(exercise.notes),
              };
            }
            usedAdvancedSlots += 1;
            return exercise;
          }

          if (heavyCompound || usedAdvancedSlots >= maxAdvancedSlots) {
            return {
              ...exercise,
              notes: stripAdvancedMethodMetadata(exercise.notes),
            };
          }

          usedAdvancedSlots += 1;
          return exercise;
        });

        const exercises = sanitizedExercises.map((exercise, index, list) => {
          const parsed = splitNotesMetadata(exercise.notes);
          const method = parsed.metadata.method ?? detectMethodFromText(exercise.notes ?? "");
          if (method !== "Superset") {
            return exercise;
          }

          const nextExercise = list[index + 1];
          const nextParsed = splitNotesMetadata(nextExercise?.notes);
          const nextMethod =
            nextParsed.metadata.method ?? detectMethodFromText(nextExercise?.notes ?? "");
          const pairName = parsed.metadata.extra?.pairName?.trim().toLowerCase();
          const nextName = nextExercise?.name.trim().toLowerCase();

          if (!nextExercise || nextMethod !== "Superset" || !pairName || pairName !== nextName) {
            return {
              ...exercise,
              notes: stripAdvancedMethodMetadata(exercise.notes),
            };
          }

          return exercise;
        });

        return {
          ...day,
          exercises,
        };
      }),
    })),
  };
}

export function validateTrainingPlanDraft(input: unknown): TrainingPlanDraft {
  if (!input || typeof input !== "object") {
    throw new Error("Training plan must be an object");
  }

  const record = input as Record<string, unknown>;
  const blockTitle = asOptionalString(record.blockTitle);
  if (!blockTitle) {
    throw new Error("Training plan must include a blockTitle");
  }

  const weeksInput = Array.isArray(record.weeks) ? record.weeks : [];
  const weeks = weeksInput
    .map((week, index) => normalizeTrainingPlanWeek(week, index))
    .filter((week): week is TrainingPlanWeek => Boolean(week));

  if (weeks.length === 0) {
    throw new Error("Training plan must include at least one week");
  }

  return {
    blockTitle,
    goal: asOptionalString(record.goal),
    summary: asOptionalString(record.summary),
    split: asOptionalString(record.split),
    progressionNotes: Array.isArray(record.progressionNotes)
      ? record.progressionNotes.filter(
          (value): value is string => typeof value === "string",
        )
      : undefined,
    weeks,
  };
}

export function validateRefineWorkoutResponse(
  input: unknown,
): RefineWorkoutResponse {
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

export function validateNoteImportSegmentation(
  input: unknown,
): NoteImportSegmentation {
  if (!input || typeof input !== "object") {
    throw new Error("Note segmentation must be an object");
  }

  const record = input as Record<string, unknown>;
  const candidatesInput = Array.isArray(record.candidates)
    ? record.candidates
    : [];
  const candidates = candidatesInput
    .map((candidate) => normalizeNoteWorkoutCandidate(candidate))
    .filter((candidate): candidate is NoteWorkoutCandidate =>
      Boolean(candidate),
    );

  if (candidates.length === 0) {
    throw new Error(
      "Note segmentation must include at least one workout candidate",
    );
  }

  return {
    summary: asOptionalString(record.summary),
    candidates,
  };
}

export function validateParsedWorkoutCollection(
  input: unknown,
): ParsedWorkoutCollection {
  if (!input || typeof input !== "object") {
    throw new Error("Parsed workout collection must be an object");
  }

  const record = input as Record<string, unknown>;
  const sessionsInput = Array.isArray(record.sessions) ? record.sessions : [];
  const sessions = sessionsInput.map((session) =>
    validateParsedWorkout(session),
  );

  if (sessions.length === 0) {
    throw new Error(
      "Parsed workout collection must include at least one session",
    );
  }

  return {
    summary: asOptionalString(record.summary),
    sessions,
  };
}

export function validateAiWorkspaceDecision(
  input: unknown,
  fallbackMode?: "import_note" | "paste_workout" | "generate_from_scratch",
): AiWorkspaceClarificationDecision {
  if (!input || typeof input !== "object") {
    throw new Error("Workspace decision must be an object");
  }

  const record = input as Record<string, unknown>;
  const normalizedType = asOptionalString(record.type)?.toLowerCase().replaceAll("-", "_");
  const rawMode = asOptionalString(record.mode)?.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const normalizedMode =
    rawMode === "import_note" || rawMode === "paste_workout" || rawMode === "generate_from_scratch"
      ? rawMode
      : fallbackMode;
  const assistantMessage =
    asOptionalString(record.assistantMessage) ??
    asOptionalString(record.message) ??
    asOptionalString(record.assistant_message);

  if (
    (normalizedType !== "clarify" && normalizedType !== "ready") ||
    (normalizedMode !== "import_note" &&
      normalizedMode !== "paste_workout" &&
      normalizedMode !== "generate_from_scratch") ||
    !assistantMessage
  ) {
    throw new Error("Workspace decision is invalid");
  }

  return {
    type: normalizedType,
    mode: normalizedMode,
    assistantMessage,
    questions: Array.isArray(record.questions)
      ? record.questions.filter((value): value is string => typeof value === "string").slice(0, 3)
      : undefined,
    missingFields: Array.isArray(record.missingFields)
      ? record.missingFields.filter((value): value is string => typeof value === "string").slice(0, 6)
      : undefined,
  };
}

function inferSessionTitleFromBlock(block: string) {
  const value = block.toLowerCase();
  const hasLower =
    /squat|leg press|hack squat|lunge|rdl|romanian|hamstring|quad|calf|glute|leg curl|leg extension/.test(
      value,
    );
  const hasPush =
    /bench|incline|chest|shoulder press|overhead press|dip|fly|push/.test(
      value,
    );
  const hasPull =
    /row|pull.?up|lat pull|pulldown|curl|rear delt|face pull|back/.test(value);

  if (hasLower && !hasPush && !hasPull) return "Lower Body";
  if (hasPush && !hasLower && !hasPull) return "Push";
  if (hasPull && !hasLower && !hasPush) return "Pull";
  if (hasLower && hasPull && !hasPush) return "Lower + Back";
  if (hasPush && hasPull && !hasLower) return "Upper";

  return "Detected workout";
}

function detectSectionHeading(line: string) {
  const normalized = line.trim().replace(/[:\-]+$/, "");
  for (const entry of sectionHeadingPatterns) {
    if (entry.pattern.test(normalized)) {
      return entry.label;
    }
  }

  return null;
}

type ExerciseTheme =
  | "lower"
  | "push"
  | "pull"
  | "shoulders"
  | "arms"
  | "mixed"
  | "unknown";

function inferLineTheme(line: string): ExerciseTheme {
  const value = line.toLowerCase();

  const lower =
    /hack squat|squat|leg press|leg curl|leg extension|hamstring|quad|calf|glute|rdl|romanian deadlift|split squat|lunge/.test(
      value,
    );
  const push =
    /bench|incline|press|chest|pec|dip|fly|convergent machine press|machine press/.test(
      value,
    );
  const pull =
    /row|pulldown|lat pull|pull-up|pull up|back|rear delt|face pull/.test(
      value,
    );
  const shoulders =
    /lateral raise|shoulder press|overhead press|rear delt raise/.test(value);
  const arms =
    /curl|triceps|pushdown|extension corde|skull crusher|hammer curl/.test(
      value,
    );

  const hits = [lower, push, pull, shoulders, arms].filter(Boolean).length;
  if (hits > 1) return "mixed";
  if (lower) return "lower";
  if (push) return "push";
  if (pull) return "pull";
  if (shoulders) return "shoulders";
  if (arms) return "arms";

  return "unknown";
}

function themeToTitle(theme: ExerciseTheme) {
  switch (theme) {
    case "lower":
      return "Lower Body";
    case "push":
      return "Push";
    case "pull":
      return "Pull";
    case "shoulders":
      return "Shoulders";
    case "arms":
      return "Arms";
    default:
      return "Detected workout";
  }
}

function workoutSignalScore(block: string) {
  const nonEmptyLines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let score = 0;
  for (const line of nonEmptyLines) {
    if (/\d/.test(line)) score += 1;
    if (/@|kg|lb|\bx\b|sets?|reps?|mins?|min/.test(line.toLowerCase()))
      score += 2;
    if (
      /squat|bench|row|curl|press|pulldown|pull-up|pull up|deadlift|lunge|extension|raise|fly|dip/.test(
        line.toLowerCase(),
      )
    ) {
      score += 3;
    }
  }

  return score;
}

function buildHeuristicCandidates(rawText: string): NoteWorkoutCandidate[] {
  const normalized = normalizeMultilineText(rawText);
  const byHeadings = buildHeadingCandidates(normalized);
  if (byHeadings.length >= 2) {
    return byHeadings;
  }

  const byThemeRuns = buildThemeRunCandidates(normalized);
  if (byThemeRuns.length >= 2) {
    return byThemeRuns;
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 20);

  const workoutBlocks = blocks.filter(
    (block) => workoutSignalScore(block) >= 6,
  );
  if (workoutBlocks.length < 2) {
    return [];
  }

  return workoutBlocks.map((block, index) => ({
    title: inferSessionTitleFromBlock(block),
    rawExcerpt: block,
    confidence: 0.62,
    isMostRecent: index === workoutBlocks.length - 1,
    fingerprint: `heuristic-${index + 1}`,
  }));
}

function buildThemeRunCandidates(rawText: string): NoteWorkoutCandidate[] {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sessions: { theme: ExerciseTheme; lines: string[] }[] = [];
  let current: { theme: ExerciseTheme; lines: string[] } | null = null;

  for (const line of lines) {
    if (detectSectionHeading(line)) {
      continue;
    }

    const theme = inferLineTheme(line);
    if (theme === "unknown") {
      if (current) {
        current.lines.push(line);
      }
      continue;
    }

    if (!current) {
      current = { theme, lines: [line] };
      continue;
    }

    const currentIsBroad =
      current.theme === "arms" || current.theme === "shoulders";
    const nextIsBroad = theme === "arms" || theme === "shoulders";
    const compatible =
      theme === current.theme ||
      theme === "mixed" ||
      current.theme === "mixed" ||
      (current.theme === "push" && nextIsBroad) ||
      (theme === "push" && currentIsBroad) ||
      (current.theme === "pull" && theme === "arms");

    if (compatible) {
      current.lines.push(line);
      if (current.theme === "mixed" && theme !== "mixed") {
        current.theme = theme;
      }
      continue;
    }

    if (
      workoutSignalScore(current.lines.join("\n")) >= 6 &&
      current.lines.length >= 2
    ) {
      sessions.push(current);
    }
    current = { theme, lines: [line] };
  }

  if (
    current &&
    workoutSignalScore(current.lines.join("\n")) >= 6 &&
    current.lines.length >= 2
  ) {
    sessions.push(current);
  }

  if (sessions.length < 2) {
    return [];
  }

  return sessions.map((session, index) => ({
    title: themeToTitle(session.theme),
    rawExcerpt: session.lines.join("\n"),
    confidence: 0.68,
    isMostRecent: index === sessions.length - 1,
    fingerprint: `theme-run-${session.theme}-${index + 1}`,
  }));
}

function buildHeadingCandidates(rawText: string): NoteWorkoutCandidate[] {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = detectSectionHeading(line);
    if (heading) {
      if (current && workoutSignalScore(current.lines.join("\n")) >= 6) {
        sections.push(current);
      }
      current = { title: heading, lines: [] };
      continue;
    }

    if (!current) {
      continue;
    }

    current.lines.push(line);
  }

  if (current && workoutSignalScore(current.lines.join("\n")) >= 6) {
    sections.push(current);
  }

  if (sections.length < 2) {
    return [];
  }

  return sections.map((section, index) => ({
    title: section.title,
    rawExcerpt: section.lines.join("\n"),
    confidence: 0.76,
    isMostRecent: index === sections.length - 1,
    fingerprint: `heading-${section.title.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
  }));
}

function shouldUseHeuristicSegmentation(
  rawText: string,
  segmentation: NoteImportSegmentation,
) {
  if (segmentation.candidates.length !== 1) {
    return false;
  }

  const normalized = normalizeMultilineText(rawText);
  const onlyCandidate = normalizeMultilineText(
    segmentation.candidates[0]?.rawExcerpt ?? "",
  );
  const candidateCoverage =
    normalized.length > 0 ? onlyCandidate.length / normalized.length : 1;
  const hasMultipleParagraphs =
    normalized.split(/\n{2,}/).filter((block) => block.trim().length > 0)
      .length >= 3;
  const hasMultipleHeadings =
    normalized
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => detectSectionHeading(line)).length >= 2;

  return (
    candidateCoverage > 0.8 && (hasMultipleParagraphs || hasMultipleHeadings)
  );
}

function noteHasMultipleThemes(rawText: string) {
  const matches = rawText.match(
    /\b(jambes?|legs?|dos|back|pecs?|chest|push|pull|upper|lower|epaules?|shoulders?|bras|arms?)\b/gi,
  );

  return new Set((matches ?? []).map((value) => value.toLowerCase())).size >= 2;
}

function buildParseWorkoutPrompt(rawText: string) {
  return [
    "You are a workout parsing assistant.",
    "Convert messy gym notes into strict JSON.",
    "Do not invent exercises that are not implied by the note.",
    "If a value is missing, omit it instead of guessing aggressively.",
    "The raw text can include a final section called 'Additional context from the user'.",
    "Treat that section as authoritative clarification for how to interpret the workout.",
    "Only mark an exercise as Superset when the text is explicit (keywords like 'superset', 'super set', or a clear paired-expression).",
    "Do not infer Superset from short rest, no rest, fatigue cues, or generic sequencing alone.",
    "If the user says exercises are in a superset, dropset, or another pairing/method, reflect that explicitly in the notes fields of the affected exercises.",
    "If the user gives relationship or ordering context, preserve it instead of ignoring it.",
    "For every exercise, infer a target area and store it in notes metadata as targetArea=Lower, targetArea=Push, targetArea=Pull, targetArea=Shoulders, targetArea=Arms, targetArea=Core, or targetArea=Exercise.",
    "Use these rules consistently: back/rows/pulldowns = Pull. chest/pec pressing = Push. shoulder pressing and lateral/rear-delt work = Shoulders. biceps/triceps isolation = Arms. legs/quads/glutes/hamstrings/calves/leg press/squat/hack/lunge = Lower.",
    "When notes already contain metadata like method=... or timeline..., append targetArea to that metadata instead of putting it only in free text.",
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
            notes: "method=Standard; targetArea=Lower || felt heavy",
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
        coachSummary:
          "Leg focus with manageable fatigue after the previous push session.",
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

function buildGenerateTrainingPlanPrompt(input: {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  currentTrainingPlan?: unknown;
  userMessage?: string;
}) {
  return [
    "You are an AI strength and hypertrophy coach.",
    input.currentTrainingPlan
      ? "Refine the user's current training plan in strict JSON only."
      : "Build an initial training plan in strict JSON only.",
    "This is a structured training block with weeks and training days when that makes sense.",
    "Do not force a 4-week plan if the user asked for a shorter horizon like 1 week or only a few training days.",
    "If the user explicitly asks for a 1-week plan, a 2-day plan, or another short block, honor that exact scope.",
    "Use the user's profile choices to decide split, exercise selection, weekly structure, and progression.",
    "Keep all days realistic for the user's session duration and equipment.",
    "If the user has limitations, avoid conflicting exercises.",
    "If a current plan is provided, preserve as much structure as possible unless the user context clearly asks for changes.",
    "When the latest user coaching message asks for concrete changes, you must apply those changes in the returned plan.",
    "If the user asks for methods like superset, drop set, rest-pause, or tempo, use them selectively and intelligently, not on every exercise by default.",
    "Advanced methods are tools, not a blanket rule. Use the minimum number of placements needed to improve density, stimulus, or weak-point focus.",
    "Prefer advanced methods on accessories, isolation, machine work, or end-of-session hypertrophy work.",
    "Avoid putting advanced methods on heavy primary compounds unless the user explicitly asks for that.",
    "If the user asks for supersets, prefer a few high-value pairings rather than converting the whole day.",
    "Method notes must be structured, not vague free text.",
    "Use notes metadata patterns like:",
    "- Superset: method=Superset; pairName=Exercise B; pairReps=12 || optional free note",
    "- Drop set: method=Drop set; dropWeights=90|70|50 || optional free note",
    "- Rest-pause: method=Rest-pause; restPauseSeconds=20; restPauseMiniSets=3 || optional free note",
    "- Myo-reps: method=Myo-reps; myoActivationReps=15; myoMiniReps=4; myoRounds=4; myoRestSeconds=20 || optional free note",
    "- Tempo: method=Tempo; tempoEccentric=3; tempoStretch=1; tempoConcentric=1; tempoTop=0 || optional free note",
    "- Custom: method=Custom; customName=Giant set; customInstructions=Move exercise to exercise with no rest || optional free note",
    "When you use Superset, create a real pair of two consecutive exercises and set pairName on both sides when possible.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        blockTitle: "4-Week Lower Body Growth Block",
        goal: "muscle_gain",
        summary:
          "A 4-week block focused on lower body growth with upper support work.",
        split: "Upper / Lower",
        progressionNotes: [
          "Week 1 sets the baseline.",
          "Week 2 adds small overload.",
          "Week 3 pushes the main lifts.",
          "Week 4 pulls fatigue down slightly.",
        ],
        weeks: [
          {
            weekNumber: 1,
            title: "Week 1",
            summary: "Baseline volume and movement selection.",
            days: [
              {
                dayLabel: "Mon",
                title: "Lower A",
                summary: "Quad-focused day with controlled accessories.",
                estimatedDurationMinutes: 45,
                exercises: [
                  {
                    name: "Hack Squat",
                    normalizedName: "hack squat",
                    sets: 4,
                    repMin: 8,
                    repMax: 10,
                    restSeconds: 120,
                    targetRpe: 8,
                    notes: "Leave 1-2 reps in reserve.",
                    exerciseType: "compound",
                    muscleGroups: ["quads", "glutes"],
                    equipment: ["machine"],
                    substitutions: ["Leg Press"],
                  },
                ],
              },
            ],
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
    "Latest user coaching message:",
    JSON.stringify(input.userMessage ?? null),
    "Current training plan:",
    JSON.stringify(input.currentTrainingPlan ?? null),
  ].join("\n");
}

function buildGenerateNextTrainingDayPrompt(input: {
  trainingPlan: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  userMessage?: string;
}) {
  return [
    "You are an AI strength coach continuing an existing structured training plan.",
    "Generate only the single best next training day in strict JSON.",
    "You must understand where the user is inside the current plan and extend it coherently.",
    "Respect the existing split, style, exercise balance, and progression logic already present in the plan.",
    "Avoid repeating the exact previous day unless the plan structure truly calls for it.",
    "Use the user's profile, recent workouts, and optional message to adapt volume, duration, and exercise selection.",
    "If the user asks for a change, apply it while keeping the program coherent.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        dayLabel: "Thu",
        title: "Pull B",
        summary: "Back-focused day that continues the current block with manageable fatigue.",
        estimatedDurationMinutes: 50,
        exercises: [
          {
            name: "Chest-Supported Row",
            normalizedName: "chest supported row",
            sets: 4,
            repMin: 8,
            repMax: 10,
            restSeconds: 120,
            targetRpe: 8,
            notes: "Drive elbows low and control the eccentric.",
            exerciseType: "compound",
            muscleGroups: ["back", "lats"],
            equipment: ["machine"],
            substitutions: ["Cable Row"],
          },
        ],
      },
      null,
      2,
    ),
    "Current training plan:",
    JSON.stringify(input.trainingPlan ?? null),
    "User profile:",
    JSON.stringify(input.userProfile ?? null),
    "Recent workouts:",
    JSON.stringify(input.recentWorkouts ?? []),
    "Latest user coaching message:",
    JSON.stringify(input.userMessage ?? null),
  ].join("\n");
}

function buildSegmentNoteImportPrompt(rawText: string) {
  return [
    "You are a workout-note segmentation assistant.",
    "A single Apple Note may contain one or many workouts, old logs, comments, shopping lists, or noise.",
    "Find the workout blocks that look like actual training sessions.",
    "Your job is to separate the note into distinct workout sessions, not to summarize the whole note.",
    "Prefer extracting multiple candidates over merging unrelated sessions.",
    "Never merge a legs workout, a pull workout, and a chest workout into a single candidate if they are separate blocks.",
    "If the note spans multiple weeks, return one candidate per workout day or workout block in text order.",
    "Use proximity, blank lines, day/date markers, repeated headings, and changes in exercise theme to split sessions.",
    "If a block is mostly quads/hamstrings/glutes, title it Lower Body. If it is bench/press/fly, title it Push or Chest. If it is rows/pulldowns/curls, title it Pull or Back.",
    "Mark which candidate is most recent when the evidence is strong.",
    "Do not parse the exercises in detail yet.",
    "Each rawExcerpt should contain only the lines for one likely workout, not the entire original note.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        summary: "Short explanation of what was found in the note.",
        candidates: [
          {
            title: "Lower body",
            rawExcerpt:
              "exact excerpt or condensed excerpt of one workout block",
            performedAt: "optional ISO date if explicit",
            confidence: 0.9,
            isMostRecent: true,
            fingerprint: "optional short stable fingerprint hint",
          },
        ],
      },
      null,
      2,
    ),
    "Raw note:",
    rawText,
  ].join("\n");
}

function buildThemeSplitPrompt(rawText: string) {
  return [
    "You are a workout-note restructuring assistant.",
    "The note may contain multiple workout sessions written one after another.",
    "Split the note into distinct sessions by heading or training theme.",
    "Important: if you see a title like 'jambes', 'dos', 'pec', 'push', 'pull', 'upper', or 'lower', all exercise lines below belong to that session until the next title.",
    "Do not merge all exercises into one big workout if the note clearly switches theme.",
    "Return one candidate per session and keep only the lines that belong to that session.",
    "Do not parse sets/reps beyond copying the relevant excerpt.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        summary: "Short explanation of how the note was split into sessions.",
        candidates: [
          {
            title: "Jambes",
            rawExcerpt: "only the lines for that workout",
            performedAt: "optional ISO date if explicit",
            confidence: 0.91,
            isMostRecent: false,
            fingerprint: "optional short stable fingerprint hint",
          },
        ],
      },
      null,
      2,
    ),
    "Raw note:",
    rawText,
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

function buildAnalyzeWorkspacePrompt(input: {
  mode: "import_note" | "paste_workout" | "generate_from_scratch";
  sourceText?: string;
  messages?: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  trainingPlan?: unknown;
  clarificationRound?: number;
}) {
  return [
    "You are an AI workout coach deciding whether more clarification is needed before generating.",
    "Return strict JSON only.",
    "Ask only the smallest number of essential questions that would materially change the output.",
    "Never ask more than 3 questions.",
    "Never repeat questions already answered in the conversation or profile.",
    "If the user says session duration does not matter, is flexible, or they do not care, do not ask about session duration again.",
    "If enough context exists, return type=ready.",
    "If clarificationRound is 2 or more, prefer type=ready unless critical safety/program context is missing.",
    "For generate_from_scratch prioritize frequency, session duration, equipment, limitations, and priority muscles.",
    "For paste_workout prioritize whether this is one workout or a whole program, desired cleanup vs optimization, and user goal if missing.",
    "For import_note prioritize whether the note should become multiple sessions or one program, and whether to preserve or optimize structure.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        type: "clarify",
        mode: input.mode,
        assistantMessage: "Before I build it, I need 2 quick details.",
        questions: [
          "How many days per week do you want to train?",
          "Do you have full gym access or mostly machines/home equipment?",
        ],
        missingFields: ["frequencyPerWeek", "equipment"],
      },
      null,
      2,
    ),
    "Current mode:",
    JSON.stringify(input.mode),
    "Source text:",
    JSON.stringify(input.sourceText ?? null),
    "Conversation messages:",
    JSON.stringify(input.messages ?? []),
    "User profile:",
    JSON.stringify(input.userProfile ?? null),
    "Recent workouts:",
    JSON.stringify(input.recentWorkouts ?? []),
    "Current training plan:",
    JSON.stringify(input.trainingPlan ?? null),
    "Clarification round:",
    JSON.stringify(input.clarificationRound ?? 0),
  ].join("\n");
}

function conversationSaysDurationIsFlexible(messages: unknown) {
  if (!Array.isArray(messages)) return false;

  return messages.some((message) => {
    if (!message || typeof message !== "object") return false;
    const text = asOptionalString((message as Record<string, unknown>).text)?.toLowerCase();
    if (!text) return false;

    return (
      /(no defined time|no specific time|don't care about.*duration|do not care about.*duration|duration doesn't matter|any duration|flexible duration)/.test(
        text,
      ) ||
      /((je m'en fiche|je m’en fiche|peu importe|pas de temps d[ée]fini|pas de dur[ée]e d[ée]finie|la dur[ée]e m'importe peu|la durée m’importe peu)).*(temps|dur[ée]e)?/.test(
        text,
      )
    );
  });
}

function removeDurationClarification(
  decision: AiWorkspaceClarificationDecision,
) {
  if (decision.type !== "clarify") {
    return decision;
  }

  const nextQuestions = (decision.questions ?? []).filter(
    (question) => !/duration|minutes|session length|durée|temps/i.test(question),
  );
  const nextMissingFields = (decision.missingFields ?? []).filter(
    (field) => field !== "sessionDuration",
  );

  if (nextQuestions.length === 0) {
    return {
      type: "ready",
      mode: decision.mode,
      assistantMessage: "I have enough context to build it.",
    };
  }

  return {
    ...decision,
    questions: nextQuestions,
    missingFields: nextMissingFields,
  };
}

function buildDirectMultiSessionParsePrompt(rawText: string) {
  return [
    "You are an expert workout-note interpreter.",
    "You will receive one long raw note that may contain multiple workout sessions across multiple days or weeks.",
    "Your task is to infer the workout sessions directly from the note without relying on explicit formatting.",
    "Use headings like Jambes, Dos, Pec, Upper, Lower, Push, Pull when present.",
    "When there is no heading, infer the session boundary from exercise theme changes and the order of the note.",
    "If Hack Squat and Leg Curl appear together, that is likely lower body. If Incline Press and Dips appear together, that is likely upper/chest.",
    "Repeated headings later in the note usually mean a later session, not the same one merged together.",
    "Return multiple sessions when the note clearly contains multiple training days.",
    "Return only valid JSON with this shape:",
    JSON.stringify(
      {
        summary: "Short explanation of how the note was interpreted.",
        sessions: [
          {
            title: "Jambes",
            sessionType: "lower_body",
            performedAt: "optional ISO date if explicit",
            cleanedSummary: "Short summary of the session.",
            fatigueNote: "optional fatigue note",
            parseConfidence: 0.82,
            exercises: [
              {
                rawLine: "Hack squat 2x10 40 puis 45 chaque cote",
                name: "Hack Squat",
                normalizedName: "hack squat",
                sets: 2,
                reps: 10,
                weight: 40,
                unit: "kg",
                notes: "then 45 each side",
                confidence: 0.89,
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "Raw note:",
    rawText,
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
    choices?: { message?: { content?: string } }[];
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

export async function parseWorkoutNoteWithOpenAI(
  rawText: string,
): Promise<ParseWorkoutResult> {
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

export async function analyzeAiWorkspaceWithOpenAI(input: {
  mode: "import_note" | "paste_workout" | "generate_from_scratch";
  sourceText?: string;
  messages?: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  trainingPlan?: unknown;
  clarificationRound?: number;
}): Promise<WorkspaceDecisionResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_ANALYZE_WORKSPACE",
    defaultModel: "gpt-4.1-mini",
    systemPrompt:
      "You decide whether a workout/program request needs clarification before generation, and you return strict JSON only.",
    userPrompt: buildAnalyzeWorkspacePrompt(input),
    temperature: 0.2,
  });

  const durationIsFlexible = conversationSaysDurationIsFlexible(input.messages);

  return {
    decision: durationIsFlexible
      ? removeDurationClarification(
          validateAiWorkspaceDecision(result.json, input.mode),
        )
      : validateAiWorkspaceDecision(result.json, input.mode),
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
    systemPrompt:
      "You generate structured workout recommendations in strict JSON.",
    userPrompt: buildGenerateWorkoutPrompt(input),
    temperature: 0.4,
  });

  return {
    recommendation: validateRecommendationDraft(result.json),
    model: result.model,
  };
}

export async function generateTrainingPlanWithOpenAI(input: {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  currentTrainingPlan?: unknown;
  userMessage?: string;
}): Promise<TrainingPlanResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_GENERATE_PLAN",
    defaultModel: "gpt-4.1-mini",
    systemPrompt:
      "You generate structured 4-week training plans in strict JSON.",
    userPrompt: buildGenerateTrainingPlanPrompt(input),
    temperature: 0.4,
  });

  return {
    trainingPlan: sanitizeTrainingPlanAdvancedMethods(
      sanitizeTrainingPlanStructure(
        validateTrainingPlanDraft(result.json),
        input.userMessage,
      ),
      input.userMessage,
    ),
    model: result.model,
  };
}

export async function generateNextTrainingDayWithOpenAI(input: {
  trainingPlan: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  userMessage?: string;
}): Promise<NextTrainingDayResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_GENERATE_NEXT_DAY",
    defaultModel: "gpt-4.1-mini",
    systemPrompt:
      "You generate the next structured training day for an existing training plan in strict JSON.",
    userPrompt: buildGenerateNextTrainingDayPrompt(input),
    temperature: 0.4,
  });

  return {
    nextDay: validateTrainingPlanDay(result.json),
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
    systemPrompt:
      "You refine workout recommendations and return strict JSON only.",
    userPrompt: buildRefineWorkoutPrompt(input),
    temperature: 0.4,
  });

  return {
    refinement: validateRefineWorkoutResponse(result.json),
    model: result.model,
  };
}

export async function segmentNoteImportWithOpenAI(
  rawText: string,
): Promise<SegmentNoteImportResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_SEGMENT_NOTE_IMPORT",
    defaultModel: "gpt-4.1-mini",
    systemPrompt:
      "You segment long messy notes into likely workout-session candidates in strict JSON.",
    userPrompt: buildSegmentNoteImportPrompt(rawText),
    temperature: 0.2,
  });

  let finalSegmentation = validateNoteImportSegmentation(result.json);

  if (
    shouldUseHeuristicSegmentation(rawText, finalSegmentation) &&
    noteHasMultipleThemes(rawText)
  ) {
    const themeResult = await requestJsonFromOpenAI({
      modelEnvKey: "OPENAI_MODEL_SEGMENT_NOTE_IMPORT",
      defaultModel: "gpt-4.1-mini",
      systemPrompt:
        "You split a messy note into separate workout sessions by headings and body-part themes.",
      userPrompt: buildThemeSplitPrompt(rawText),
      temperature: 0.1,
    });

    finalSegmentation = validateNoteImportSegmentation(themeResult.json);
  }

  if (shouldUseHeuristicSegmentation(rawText, finalSegmentation)) {
    const heuristicCandidates = buildHeuristicCandidates(rawText);
    if (heuristicCandidates.length > 0) {
      finalSegmentation = {
        summary:
          "The note looked like multiple workout blocks, so the app split it into likely sessions for review.",
        candidates: heuristicCandidates,
      };
    }
  }

  if (finalSegmentation.candidates.length === 0) {
    throw new Error("Could not detect distinct workout blocks in this note");
  }

  return {
    segmentation: finalSegmentation,
    model: result.model,
  };
}

export async function parseWorkoutCollectionWithOpenAI(
  rawText: string,
): Promise<ParseWorkoutCollectionResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_PARSE_WORKOUT_COLLECTION",
    defaultModel: "gpt-4.1-mini",
    systemPrompt:
      "You directly convert a long messy workout note into multiple structured workout sessions in strict JSON.",
    userPrompt: buildDirectMultiSessionParsePrompt(rawText),
    temperature: 0.2,
  });

  return {
    parsedCollection: validateParsedWorkoutCollection(result.json),
    model: result.model,
  };
}
