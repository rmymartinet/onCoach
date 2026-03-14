import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

function getWorkoutIdFromRequest(request: Request) {
  const { pathname } = new URL(request.url);
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

export async function DELETE(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const workoutId = getWorkoutIdFromRequest(request);
  if (!workoutId) {
    return Response.json({ ok: false, message: "workoutId is required" }, { status: 400 });
  }

  const workout = await prisma.workout.findFirst({
    where: {
      id: workoutId,
      userId: session.user.id,
    },
    select: { id: true },
  });

  if (!workout) {
    return Response.json({ ok: false, message: "Workout not found" }, { status: 404 });
  }

  await prisma.workout.delete({
    where: { id: workoutId },
  });

  return Response.json({ ok: true, workoutId });
}
