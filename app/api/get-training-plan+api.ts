import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

type GetTrainingPlanBody = {
  trainingPlanId?: string;
};

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GetTrainingPlanBody | null;
  const trainingPlanId = body?.trainingPlanId?.trim();

  if (!trainingPlanId) {
    return Response.json({ ok: false, message: "trainingPlanId is required" }, { status: 400 });
  }

  const trainingPlan = await prisma.trainingPlan.findFirst({
    where: {
      id: trainingPlanId,
      userId: session.user.id,
    },
    include: {
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: {
          days: {
            orderBy: { order: "asc" },
            include: {
              exercises: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!trainingPlan) {
    return Response.json({ ok: false, message: "Program not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    trainingPlan: {
      id: trainingPlan.id,
      title: trainingPlan.title,
      goal: trainingPlan.goal,
      level: trainingPlan.level,
      summary: trainingPlan.summary,
      split: trainingPlan.split,
      status: trainingPlan.status,
      source: trainingPlan.source,
      progressionNotes: Array.isArray(trainingPlan.progressionNotes) ? trainingPlan.progressionNotes : [],
      createdAt: trainingPlan.createdAt,
      updatedAt: trainingPlan.updatedAt,
      weeks: trainingPlan.weeks.map((week) => ({
        id: week.id,
        weekNumber: week.weekNumber,
        title: week.title,
        summary: week.summary,
        days: week.days.map((day) => ({
          id: day.id,
          order: day.order,
          dayLabel: day.dayLabel,
          title: day.title,
          summary: day.summary,
          estimatedDurationMinutes: day.estimatedDurationMinutes,
          exercises: day.exercises.map((exercise) => ({
            id: exercise.id,
            order: exercise.order,
            name: exercise.name,
            normalizedName: exercise.normalizedName,
            sets: exercise.sets,
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
            warmup: exercise.warmup,
            exerciseType: exercise.exerciseType,
            muscleGroups: Array.isArray(exercise.muscleGroups) ? exercise.muscleGroups : [],
            equipment: Array.isArray(exercise.equipment) ? exercise.equipment : [],
            substitutions: Array.isArray(exercise.substitutions) ? exercise.substitutions : [],
          })),
        })),
      })),
    },
  });
}
