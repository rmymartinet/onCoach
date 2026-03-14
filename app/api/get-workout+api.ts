import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

type GetWorkoutBody = {
  workoutId?: string;
};

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GetWorkoutBody | null;
  const workoutId = body?.workoutId?.trim();

  if (!workoutId) {
    return Response.json({ ok: false, message: "workoutId is required" }, { status: 400 });
  }

  const workout = await prisma.workout.findFirst({
    where: {
      id: workoutId,
      userId: session.user.id,
    },
    include: {
      exercises: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!workout) {
    return Response.json({ ok: false, message: "Workout not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    workout: {
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
    },
  });
}
