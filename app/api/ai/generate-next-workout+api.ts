import { generateNextWorkoutWithOpenAI } from "@/lib/ai";
import { createRecommendationRecord } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";

type GenerateNextWorkoutRequestBody = {
  userProfile?: unknown;
  recentWorkouts?: unknown;
  latestWorkout?: unknown;
  constraints?: unknown;
  basedOnWorkoutId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GenerateNextWorkoutRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const result = await generateNextWorkoutWithOpenAI({
      userProfile: body?.userProfile,
      recentWorkouts: body?.recentWorkouts,
      latestWorkout: body?.latestWorkout,
      constraints: body?.constraints,
    });

    const persisted = await createRecommendationRecord({
      userId: session.user.id,
      recommendation: result.recommendation,
      basedOnWorkoutId: body?.basedOnWorkoutId ?? null,
    });

    return Response.json({
      ok: true,
      model: result.model,
      recommendation: result.recommendation,
      recommendationId: persisted.recommendation.id,
      threadId: persisted.thread.id,
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
