import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      goal: true,
      level: true,
      frequencyPerWeek: true,
      sessionDuration: true,
      equipment: true,
      splitPreference: true,
      heightCm: true,
      weightKg: true,
      experienceYears: true,
      trainingLocation: true,
      preferredStyles: true,
      favoriteExercises: true,
      avoidedExercises: true,
      priorityMuscles: true,
      limitations: true,
      jobActivityLevel: true,
      preferredTrainingTimes: true,
      availableDays: true,
      onboardingCompletedAt: true,
    },
  });

  const recentWorkouts = await prisma.workout.findMany({
    where: { userId: session.user.id },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      exercises: {
        orderBy: { order: "asc" },
      },
    },
  });

  const latestRecommendation = await prisma.recommendation.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      thread: {
        select: {
          id: true,
        },
      },
      exercises: {
        orderBy: { order: "asc" },
      },
    },
  });

  return Response.json({
    ok: true,
    user,
    latestWorkoutId: recentWorkouts[0]?.id ?? null,
    recentWorkouts: recentWorkouts.map((workout) => ({
      id: workout.id,
      title: workout.title ?? workout.cleanedSummary ?? workout.sessionType ?? "Workout",
      rawText: workout.rawText,
      cleanedSummary: workout.cleanedSummary,
      sessionType: workout.sessionType,
      fatigueNote: workout.fatigueNote,
      performedAt: workout.performedAt,
      createdAt: workout.createdAt,
      exercises: workout.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.exerciseName,
        normalizedName: exercise.normalizedName,
        sets: exercise.sets,
        reps: exercise.reps,
        repMin: exercise.repMin,
        repMax: exercise.repMax,
        weight: exercise.weight,
        unit: exercise.unit,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
        order: exercise.order,
      })),
    })),
    latestRecommendation: latestRecommendation
      ? {
          id: latestRecommendation.id,
          title: latestRecommendation.title,
          goal: latestRecommendation.goal,
          coachSummary: latestRecommendation.coachSummary,
          explanation: latestRecommendation.explanation,
          estimatedDurationMinutes: latestRecommendation.estimatedDurationMinutes,
          status: latestRecommendation.status,
          exercises: latestRecommendation.exercises.map((exercise) => ({
            name: exercise.name,
            normalizedName: exercise.normalizedName,
            order: exercise.order,
            sets: exercise.sets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            restSeconds: exercise.restSeconds,
            targetRpe: exercise.targetRpe,
            rir: exercise.rir,
            notes: exercise.notes,
            warmup: exercise.warmup,
            exerciseType: exercise.exerciseType,
            muscleGroups: Array.isArray(exercise.muscleGroups) ? exercise.muscleGroups : [],
            equipment: Array.isArray(exercise.equipment) ? exercise.equipment : [],
            substitutions: Array.isArray(exercise.substitutions) ? exercise.substitutions : [],
          })),
        }
      : null,
    latestRecommendationId: latestRecommendation?.id ?? null,
    latestThreadId: latestRecommendation?.thread?.id ?? null,
  });
}
