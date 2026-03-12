import type {
  CoachAction,
  NoteImportSegmentation,
  NoteWorkoutCandidate,
  ParsedWorkoutCollection,
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

type SegmentNoteImportResult = {
  segmentation: NoteImportSegmentation;
  model: string;
};

type ParseWorkoutCollectionResult = {
  parsedCollection: ParsedWorkoutCollection;
  model: string;
};

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

const sectionHeadingPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "Lower Body", pattern: /^(jambes?|legs?|leg day|lower body|bas du corps)$/i },
  { label: "Back", pattern: /^(dos|back|pull|pull day)$/i },
  { label: "Chest", pattern: /^(pecs?|chest|push|push day)$/i },
  { label: "Shoulders", pattern: /^(epaules?|shoulders?)$/i },
  { label: "Arms", pattern: /^(bras|arms?)$/i },
  { label: "Upper Body", pattern: /^(haut du corps|upper body|upper)$/i },
  { label: "Full Body", pattern: /^(full body|fullbody)$/i },
];

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

function normalizeNoteWorkoutCandidate(input: unknown): NoteWorkoutCandidate | null {
  if (!input || typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const rawExcerpt = asOptionalString(record.rawExcerpt);
  if (!rawExcerpt) return null;

  return {
    title: asOptionalString(record.title),
    rawExcerpt,
    performedAt: asOptionalString(record.performedAt),
    confidence: asOptionalNumber(record.confidence),
    isMostRecent: typeof record.isMostRecent === "boolean" ? record.isMostRecent : undefined,
    fingerprint: asOptionalString(record.fingerprint),
  };
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

export function validateNoteImportSegmentation(input: unknown): NoteImportSegmentation {
  if (!input || typeof input !== "object") {
    throw new Error("Note segmentation must be an object");
  }

  const record = input as Record<string, unknown>;
  const candidatesInput = Array.isArray(record.candidates) ? record.candidates : [];
  const candidates = candidatesInput
    .map((candidate) => normalizeNoteWorkoutCandidate(candidate))
    .filter((candidate): candidate is NoteWorkoutCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    throw new Error("Note segmentation must include at least one workout candidate");
  }

  return {
    summary: asOptionalString(record.summary),
    candidates,
  };
}

export function validateParsedWorkoutCollection(input: unknown): ParsedWorkoutCollection {
  if (!input || typeof input !== "object") {
    throw new Error("Parsed workout collection must be an object");
  }

  const record = input as Record<string, unknown>;
  const sessionsInput = Array.isArray(record.sessions) ? record.sessions : [];
  const sessions = sessionsInput.map((session) => validateParsedWorkout(session));

  if (sessions.length === 0) {
    throw new Error("Parsed workout collection must include at least one session");
  }

  return {
    summary: asOptionalString(record.summary),
    sessions,
  };
}

function inferSessionTitleFromBlock(block: string) {
  const value = block.toLowerCase();
  const hasLower =
    /squat|leg press|hack squat|lunge|rdl|romanian|hamstring|quad|calf|glute|leg curl|leg extension/.test(
      value,
    );
  const hasPush = /bench|incline|chest|shoulder press|overhead press|dip|fly|push/.test(value);
  const hasPull = /row|pull.?up|lat pull|pulldown|curl|rear delt|face pull|back/.test(value);

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

type ExerciseTheme = "lower" | "push" | "pull" | "shoulders" | "arms" | "mixed" | "unknown";

function inferLineTheme(line: string): ExerciseTheme {
  const value = line.toLowerCase();

  const lower =
    /hack squat|squat|leg press|leg curl|leg extension|hamstring|quad|calf|glute|rdl|romanian deadlift|split squat|lunge/.test(
      value,
    );
  const push =
    /bench|incline|press|chest|pec|dip|fly|convergent machine press|machine press/.test(value);
  const pull =
    /row|pulldown|lat pull|pull-up|pull up|back|rear delt|face pull/.test(value);
  const shoulders = /lateral raise|shoulder press|overhead press|rear delt raise/.test(value);
  const arms = /curl|triceps|pushdown|extension corde|skull crusher|hammer curl/.test(value);

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
  const lower = block.toLowerCase();
  const nonEmptyLines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let score = 0;
  for (const line of nonEmptyLines) {
    if (/\d/.test(line)) score += 1;
    if (/@|kg|lb|\bx\b|sets?|reps?|mins?|min/.test(line.toLowerCase())) score += 2;
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

  const workoutBlocks = blocks.filter((block) => workoutSignalScore(block) >= 6);
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

  const sessions: Array<{ theme: ExerciseTheme; lines: string[] }> = [];
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

    const currentIsBroad = current.theme === "arms" || current.theme === "shoulders";
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

    if (workoutSignalScore(current.lines.join("\n")) >= 6 && current.lines.length >= 2) {
      sessions.push(current);
    }
    current = { theme, lines: [line] };
  }

  if (current && workoutSignalScore(current.lines.join("\n")) >= 6 && current.lines.length >= 2) {
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

  const sections: Array<{ title: string; lines: string[] }> = [];
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

function shouldUseHeuristicSegmentation(rawText: string, segmentation: NoteImportSegmentation) {
  if (segmentation.candidates.length !== 1) {
    return false;
  }

  const normalized = normalizeMultilineText(rawText);
  const onlyCandidate = normalizeMultilineText(segmentation.candidates[0]?.rawExcerpt ?? "");
  const candidateCoverage = normalized.length > 0 ? onlyCandidate.length / normalized.length : 1;
  const hasMultipleParagraphs = normalized.split(/\n{2,}/).filter((block) => block.trim().length > 0).length >= 3;
  const hasMultipleHeadings =
    normalized
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => detectSectionHeading(line)).length >= 2;

  return candidateCoverage > 0.8 && (hasMultipleParagraphs || hasMultipleHeadings);
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
            rawExcerpt: "exact excerpt or condensed excerpt of one workout block",
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

export async function segmentNoteImportWithOpenAI(rawText: string): Promise<SegmentNoteImportResult> {
  const result = await requestJsonFromOpenAI({
    modelEnvKey: "OPENAI_MODEL_SEGMENT_NOTE_IMPORT",
    defaultModel: "gpt-4.1-mini",
    systemPrompt: "You segment long messy notes into likely workout-session candidates in strict JSON.",
    userPrompt: buildSegmentNoteImportPrompt(rawText),
    temperature: 0.2,
  });

  let finalSegmentation = validateNoteImportSegmentation(result.json);

  if (shouldUseHeuristicSegmentation(rawText, finalSegmentation) && noteHasMultipleThemes(rawText)) {
    const themeResult = await requestJsonFromOpenAI({
      modelEnvKey: "OPENAI_MODEL_SEGMENT_NOTE_IMPORT",
      defaultModel: "gpt-4.1-mini",
      systemPrompt: "You split a messy note into separate workout sessions by headings and body-part themes.",
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
    systemPrompt: "You directly convert a long messy workout note into multiple structured workout sessions in strict JSON.",
    userPrompt: buildDirectMultiSessionParsePrompt(rawText),
    temperature: 0.2,
  });

  return {
    parsedCollection: validateParsedWorkoutCollection(result.json),
    model: result.model,
  };
}
