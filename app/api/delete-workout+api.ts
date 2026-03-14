import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

type DeleteWorkoutBody = {
  workoutId?: string;
};

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as DeleteWorkoutBody | null;
  const workoutId = body?.workoutId?.trim();

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
