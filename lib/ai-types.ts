export type ParsedWorkoutExercise = {
  rawLine?: string;
  name: string;
  normalizedName?: string;
  sets?: number;
  reps?: number;
  repMin?: number;
  repMax?: number;
  weight?: number;
  unit?: string;
  restSeconds?: number;
  notes?: string;
  confidence?: number;
  order: number;
};

export type ParsedWorkout = {
  title?: string;
  sessionType?: string;
  performedAt?: string;
  cleanedSummary?: string;
  fatigueNote?: string;
  parseConfidence?: number;
  exercises: ParsedWorkoutExercise[];
};

export type RecommendationExerciseDraft = {
  name: string;
  normalizedName?: string;
  order: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  targetRpe?: number;
  rir?: number;
  notes?: string;
  warmup?: boolean;
  exerciseType?: string;
  muscleGroups?: string[];
  equipment?: string[];
  substitutions?: string[];
};

export type RecommendationDraft = {
  title: string;
  goal?: string;
  coachSummary?: string;
  explanation?: string;
  estimatedDurationMinutes?: number;
  exercises: RecommendationExerciseDraft[];
};

export type TrainingPlanDay = {
  dayLabel: string;
  title: string;
  summary?: string;
  estimatedDurationMinutes?: number;
  exercises: RecommendationExerciseDraft[];
};

export type TrainingPlanWeek = {
  weekNumber: number;
  title: string;
  summary?: string;
  days: TrainingPlanDay[];
};

export type TrainingPlanDraft = {
  blockTitle: string;
  goal?: string;
  summary?: string;
  split?: string;
  progressionNotes?: string[];
  weeks: TrainingPlanWeek[];
};

export type CoachAction =
  | { type: "none" }
  | { type: "replace_exercise"; targetExercise: string; replacement: RecommendationExerciseDraft }
  | { type: "adjust_volume"; deltaSets: number; reason?: string }
  | { type: "adjust_rest"; targetExercise: string; restSeconds: number }
  | { type: "adjust_duration"; estimatedDurationMinutes: number }
  | { type: "regenerate_workout"; reason?: string };

export type RefineWorkoutResponse = {
  message: string;
  action: CoachAction;
  recommendation: RecommendationDraft;
};

export type NoteWorkoutCandidate = {
  title?: string;
  rawExcerpt: string;
  performedAt?: string;
  confidence?: number;
  isMostRecent?: boolean;
  fingerprint?: string;
};

export type NoteImportSegmentation = {
  summary?: string;
  candidates: NoteWorkoutCandidate[];
};

export type ParsedWorkoutCollection = {
  summary?: string;
  sessions: ParsedWorkout[];
};
