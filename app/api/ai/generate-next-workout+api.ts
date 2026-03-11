import { generateNextWorkoutWithOpenAI } from "@/lib/ai";

type GenerateNextWorkoutRequestBody = {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  latestWorkout?: unknown;
  constraints?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GenerateNextWorkoutRequestBody | null;

  try {
    const result = await generateNextWorkoutWithOpenAI({
      userProfile: body?.userProfile,
      recentWorkouts: body?.recentWorkouts,
      latestWorkout: body?.latestWorkout,
      constraints: body?.constraints,
    });

    return Response.json({
      ok: true,
      model: result.model,
      recommendation: result.recommendation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate next workout";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
