import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

type UpdateWorkoutExerciseBody = {
  exerciseId?: string;
  workoutId?: string;
  name?: string;
  sets?: number | null;
  reps?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  weight?: number | null;
  unit?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
};

function asOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null) return null;
  return undefined;
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as UpdateWorkoutExerciseBody | null;
  const exerciseId = body?.exerciseId?.trim();
  const workoutId = body?.workoutId?.trim();

  if (!exerciseId || !workoutId) {
    return Response.json({ ok: false, message: "exerciseId and workoutId are required" }, { status: 400 });
  }

  const existing = await prisma.workoutExercise.findFirst({
    where: {
      id: exerciseId,
      workoutId,
      workout: {
        userId: session.user.id,
      },
    },
  });

  if (!existing) {
    return Response.json({ ok: false, message: "Exercise not found" }, { status: 404 });
  }

  const updated = await prisma.workoutExercise.update({
    where: { id: exerciseId },
    data: {
      exerciseName: typeof body?.name === "string" ? body.name.trim() : undefined,
      sets: asOptionalNumber(body?.sets),
      reps: asOptionalNumber(body?.reps),
      repMin: asOptionalNumber(body?.repMin),
      repMax: asOptionalNumber(body?.repMax),
      weight: asOptionalNumber(body?.weight),
      unit: asOptionalString(body?.unit),
      restSeconds: asOptionalNumber(body?.restSeconds),
      notes: asOptionalString(body?.notes),
    },
  });

  return Response.json({
    ok: true,
    exercise: {
      id: updated.id,
      name: updated.exerciseName,
      normalizedName: updated.normalizedName,
      sets: updated.sets,
      reps: updated.reps,
      repMin: updated.repMin,
      repMax: updated.repMax,
      weight: updated.weight,
      unit: updated.unit,
      restSeconds: updated.restSeconds,
      notes: updated.notes,
      order: updated.order,
    },
  });
}
