import { saveParsedWorkout } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";
import { validateParsedWorkout } from "@/lib/ai";

type SaveParsedWorkoutBody = {
  rawText?: string;
  parsedWorkout?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SaveParsedWorkoutBody | null;
  const rawText = body?.rawText?.trim();

  if (!rawText) {
    return Response.json({ ok: false, message: "rawText is required" }, { status: 400 });
  }

  if (!body?.parsedWorkout) {
    return Response.json({ ok: false, message: "parsedWorkout is required" }, { status: 400 });
  }

  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsedWorkout = validateParsedWorkout(body.parsedWorkout);
    const workout = await saveParsedWorkout({
      userId: session.user.id,
      rawText,
      parsedWorkout,
    });

    return Response.json({
      ok: true,
      workoutId: workout.id,
      exerciseCount: workout.exercises.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save parsed workout";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
