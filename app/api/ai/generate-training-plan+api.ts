import { generateTrainingPlanWithOpenAI } from "@/lib/ai";
import { createTrainingPlanRecord } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";

type GenerateTrainingPlanRequestBody = {
  userProfile?: unknown;
  recentWorkouts?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GenerateTrainingPlanRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const result = await generateTrainingPlanWithOpenAI({
      userProfile: body?.userProfile,
      recentWorkouts: body?.recentWorkouts,
    });

    const persisted = await createTrainingPlanRecord({
      userId: session.user.id,
      trainingPlan: result.trainingPlan,
      source: "AI_GENERATED",
    });

    return Response.json({
      ok: true,
      model: result.model,
      trainingPlan: result.trainingPlan,
      trainingPlanId: persisted.trainingPlan.id,
      threadId: persisted.thread.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate training plan";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
