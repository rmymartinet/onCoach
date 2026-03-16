import { saveTrainingDayCompletionRecord } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";

type SaveTrainingDayCompletionBody = {
  trainingPlanId?: string;
  completion?: {
    planId?: string;
    dayId?: string;
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "ADJUSTED" | "SKIPPED";
    completedAt?: string;
    notes?: string;
    exercises?: Array<{
      plannedExerciseId?: string;
      order?: number;
      name?: string;
      status?: "PLANNED" | "DONE" | "ADJUSTED" | "SKIPPED";
      completedSets?: number;
      completedRepMin?: number;
      completedRepMax?: number;
      completedWeight?: number;
      completedUnit?: string;
      completedRestSeconds?: number;
      notes?: string;
    }>;
  };
};

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SaveTrainingDayCompletionBody | null;
  const trainingPlanId = body?.trainingPlanId?.trim();
  const completion = body?.completion;

  if (!trainingPlanId || !completion?.dayId || !completion?.status) {
    return Response.json(
      { ok: false, message: "trainingPlanId, completion.dayId and completion.status are required" },
      { status: 400 },
    );
  }

  try {
    const result = await saveTrainingDayCompletionRecord({
      userId: session.user.id,
      trainingPlanId,
      completion: {
        planId: completion.planId ?? trainingPlanId,
        dayId: completion.dayId,
        status: completion.status,
        completedAt: completion.completedAt,
        notes: completion.notes,
        exercises: Array.isArray(completion.exercises)
          ? completion.exercises
              .filter((exercise) => exercise?.plannedExerciseId && exercise?.name && exercise?.status)
              .map((exercise) => ({
                plannedExerciseId: exercise.plannedExerciseId!,
                order: exercise.order ?? 0,
                name: exercise.name!,
                status: exercise.status!,
                completedSets: exercise.completedSets,
                completedRepMin: exercise.completedRepMin,
                completedRepMax: exercise.completedRepMax,
                completedWeight: exercise.completedWeight,
                completedUnit: exercise.completedUnit,
                completedRestSeconds: exercise.completedRestSeconds,
                notes: exercise.notes,
              }))
          : [],
      },
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save completion";
    const status = message === "Training day not found" ? 404 : 500;
    return Response.json({ ok: false, message }, { status });
  }
}
