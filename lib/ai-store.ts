import { prisma } from "@/lib/prisma";
import type { ParsedWorkout, RecommendationDraft } from "@/lib/ai-types";

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
