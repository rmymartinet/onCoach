import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type {
  NoteImportSegmentation,
  NoteWorkoutCandidate,
  ParsedWorkout,
  RecommendationDraft,
} from "@/lib/ai-types";

function serializeRecommendation(recommendation: RecommendationDraft) {
  return {
    title: recommendation.title,
    goal: recommendation.goal,
    coachSummary: recommendation.coachSummary,
    explanation: recommendation.explanation,
    estimatedDurationMinutes: recommendation.estimatedDurationMinutes,
    exercises: recommendation.exercises,
  };
}

function normalizeFreeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim().toLowerCase();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintCandidate(candidate: NoteWorkoutCandidate) {
  if (candidate.fingerprint) {
    return candidate.fingerprint;
  }

  return hashText(normalizeFreeText(candidate.rawExcerpt)).slice(0, 24);
}

function toCoachActionType(actionType: string | undefined) {
  switch (actionType) {
    case "replace_exercise":
      return "REPLACE_EXERCISE" as const;
    case "adjust_volume":
      return "ADJUST_VOLUME" as const;
    case "adjust_rest":
      return "ADJUST_REST" as const;
    case "adjust_duration":
      return "ADJUST_DURATION" as const;
    case "regenerate_workout":
      return "REGENERATE_WORKOUT" as const;
    default:
      return "NONE" as const;
  }
}

export async function saveParsedWorkout(params: {
  userId: string;
  rawText: string;
  parsedWorkout: ParsedWorkout;
}) {
  const { userId, rawText, parsedWorkout } = params;

  const workout = await prisma.workout.create({
    data: {
      userId,
      rawText,
      cleanedSummary: parsedWorkout.cleanedSummary,
      sessionType: parsedWorkout.sessionType,
      fatigueNote: parsedWorkout.fatigueNote,
      parseConfidence: parsedWorkout.parseConfidence,
      parsingStatus: "CONFIRMED",
      performedAt: parsedWorkout.performedAt ? new Date(parsedWorkout.performedAt) : undefined,
    },
  });

  if (parsedWorkout.exercises.length > 0) {
    for (const exercise of parsedWorkout.exercises) {
      await prisma.workoutExercise.create({
        data: {
        workoutId: workout.id,
        rawLine: exercise.rawLine,
        exerciseName: exercise.name,
        normalizedName: exercise.normalizedName,
        sets: exercise.sets,
        reps: exercise.reps,
        repMin: exercise.repMin,
        repMax: exercise.repMax,
        weight: exercise.weight,
        unit: exercise.unit,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
        confidence: exercise.confidence,
        order: exercise.order,
        },
      });
    }
  }

  return prisma.workout.findUniqueOrThrow({
    where: { id: workout.id },
    include: {
      exercises: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function createRecommendationRecord(params: {
  userId: string;
  recommendation: RecommendationDraft;
  basedOnWorkoutId?: string | null;
}) {
  const { userId, recommendation, basedOnWorkoutId } = params;
  const created = await prisma.recommendation.create({
    data: {
      userId,
      basedOnWorkoutId,
      title: recommendation.title,
      goal: recommendation.goal,
      explanation: recommendation.explanation,
      coachSummary: recommendation.coachSummary,
      estimatedDurationMinutes: recommendation.estimatedDurationMinutes,
      workoutJson: serializeRecommendation(recommendation),
      status: "DRAFT",
    },
  });

  if (recommendation.exercises.length > 0) {
    for (const exercise of recommendation.exercises) {
      await prisma.recommendationExercise.create({
        data: {
        recommendationId: created.id,
        order: exercise.order,
        name: exercise.name,
        normalizedName: exercise.normalizedName,
        sets: exercise.sets,
        repMin: exercise.repMin,
        repMax: exercise.repMax,
        restSeconds: exercise.restSeconds,
        targetRpe: exercise.targetRpe,
        rir: exercise.rir,
        notes: exercise.notes,
        warmup: exercise.warmup ?? false,
        exerciseType: exercise.exerciseType,
        muscleGroups: exercise.muscleGroups ?? [],
        equipment: exercise.equipment ?? [],
        substitutions: exercise.substitutions ?? [],
        },
      });
    }
  }

  const thread = await prisma.coachThread.create({
    data: {
      userId,
      recommendationId: created.id,
      title: created.title,
    },
  });

  return {
    recommendation: await prisma.recommendation.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        exercises: {
          orderBy: { order: "asc" },
        },
      },
    }),
    thread,
  };
}

export async function saveRecommendationRefinement(params: {
  userId: string;
  recommendationId: string;
  threadId?: string | null;
  userMessage: string;
  assistantMessage: string;
  actionType?: string;
  actionPayload?: unknown;
  recommendation: RecommendationDraft;
}) {
  const {
    userId,
    recommendationId,
    threadId,
    userMessage,
    assistantMessage,
    actionType,
    actionPayload,
    recommendation,
  } = params;
  const thread =
    threadId
      ? await prisma.coachThread.findFirst({
          where: { id: threadId, userId },
        })
      : await prisma.coachThread.findFirst({
          where: { recommendationId, userId },
        });

  const ensuredThread =
    thread ??
    (await prisma.coachThread.create({
      data: {
        userId,
        recommendationId,
        title: recommendation.title,
      },
    }));

  await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      title: recommendation.title,
      goal: recommendation.goal,
      explanation: recommendation.explanation,
      coachSummary: recommendation.coachSummary,
      estimatedDurationMinutes: recommendation.estimatedDurationMinutes,
      workoutJson: serializeRecommendation(recommendation),
      status: "EDITED",
    },
  });

  const existingExercises = await prisma.recommendationExercise.findMany({
    where: { recommendationId },
    select: { id: true },
  });

  for (const exercise of existingExercises) {
    await prisma.recommendationExercise.delete({
      where: { id: exercise.id },
    });
  }

  if (recommendation.exercises.length > 0) {
    for (const exercise of recommendation.exercises) {
      await prisma.recommendationExercise.create({
        data: {
        recommendationId,
        order: exercise.order,
        name: exercise.name,
        normalizedName: exercise.normalizedName,
        sets: exercise.sets,
        repMin: exercise.repMin,
        repMax: exercise.repMax,
        restSeconds: exercise.restSeconds,
        targetRpe: exercise.targetRpe,
        rir: exercise.rir,
        notes: exercise.notes,
        warmup: exercise.warmup ?? false,
        exerciseType: exercise.exerciseType,
        muscleGroups: exercise.muscleGroups ?? [],
        equipment: exercise.equipment ?? [],
        substitutions: exercise.substitutions ?? [],
        },
      });
    }
  }

  await prisma.coachMessage.create({
    data: {
        threadId: ensuredThread.id,
        role: "USER",
        content: userMessage,
        actionType: "NONE",
      },
  });

  await prisma.coachMessage.create({
    data: {
        threadId: ensuredThread.id,
        role: "ASSISTANT",
        content: assistantMessage,
        actionType: toCoachActionType(actionType),
        actionPayload: actionPayload ?? undefined,
      },
  });

  return ensuredThread;
}

export async function createNoteImportRecord(params: {
  userId: string;
  rawText: string;
  source?: "APPLE_NOTES_SHARE" | "MANUAL_PASTE";
  segmentation: NoteImportSegmentation;
}) {
  const { userId, rawText, source = "APPLE_NOTES_SHARE", segmentation } = params;
  const normalizedText = normalizeFreeText(rawText);
  const contentHash = hashText(normalizedText);

  const noteImport = await prisma.noteImport.create({
    data: {
      userId,
      rawText,
      normalizedText,
      contentHash,
      source,
      status: segmentation.candidates.length > 1 ? "REVIEW_REQUIRED" : "SEGMENTED",
    },
  });

  const recentWorkouts = await prisma.workout.findMany({
    where: { userId },
    select: {
      id: true,
      rawText: true,
      performedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const persistedCandidates = [];
  for (const candidate of segmentation.candidates) {
    const candidateFingerprint = fingerprintCandidate(candidate);
    const duplicateMatch = recentWorkouts.find((workout) => {
      const rawMatch =
        hashText(normalizeFreeText(workout.rawText)).slice(0, 24) === candidateFingerprint;

      const dateMatch =
        candidate.performedAt &&
        workout.performedAt &&
        new Date(candidate.performedAt).toDateString() === workout.performedAt.toDateString();

      return rawMatch || Boolean(dateMatch);
    });

    const dedupeStatus = duplicateMatch
      ? ("DUPLICATE" as const)
      : candidate.confidence !== undefined && candidate.confidence < 0.65
        ? ("POSSIBLE_DUPLICATE" as const)
        : ("NEW" as const);

    persistedCandidates.push(
      await prisma.noteWorkoutCandidate.create({
        data: {
          noteImportId: noteImport.id,
          title: candidate.title,
          rawExcerpt: candidate.rawExcerpt,
          performedAt: candidate.performedAt ? new Date(candidate.performedAt) : undefined,
          confidence: candidate.confidence,
          isMostRecent: candidate.isMostRecent ?? false,
          dedupeStatus,
          dedupeReason: duplicateMatch
            ? "Matched an existing workout by content or date"
            : dedupeStatus === "POSSIBLE_DUPLICATE"
              ? "Low confidence candidate, review before import"
              : undefined,
          fingerprint: candidateFingerprint,
          matchedWorkoutId: duplicateMatch?.id,
        },
      }),
    );
  }

  return {
    noteImport,
    candidates: persistedCandidates,
  };
}
