import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

function getExerciseIdFromRequest(request: Request) {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

export async function DELETE(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const exerciseId = getExerciseIdFromRequest(request);
  if (!exerciseId) {
    return Response.json({ ok: false, message: "exerciseId is required" }, { status: 400 });
  }

  const exercise = await prisma.workoutExercise.findFirst({
    where: {
      id: exerciseId,
      workout: {
        userId: session.user.id,
      },
    },
    select: { id: true, workoutId: true },
  });

  if (!exercise) {
    return Response.json({ ok: false, message: "Exercise not found" }, { status: 404 });
  }

  await prisma.workoutExercise.delete({
    where: { id: exerciseId },
  });

  return Response.json({ ok: true, exerciseId, workoutId: exercise.workoutId });
}
