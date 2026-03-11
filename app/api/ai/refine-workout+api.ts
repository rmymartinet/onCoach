import { refineWorkoutWithOpenAI, validateRecommendationDraft } from "@/lib/ai";
import { saveRecommendationRefinement } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";

type RefineWorkoutRequestBody = {
  currentRecommendation?: unknown;
  userMessage?: string;
  recentWorkouts?: unknown;
  recommendationId?: string;
  threadId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RefineWorkoutRequestBody | null;
  const userMessage = body?.userMessage?.trim();

  if (!body?.currentRecommendation) {
    return Response.json({ ok: false, message: "currentRecommendation is required" }, { status: 400 });
  }

  if (!userMessage) {
    return Response.json({ ok: false, message: "userMessage is required" }, { status: 400 });
  }

  if (!body.recommendationId) {
    return Response.json({ ok: false, message: "recommendationId is required" }, { status: 400 });
  }

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const currentRecommendation = validateRecommendationDraft(body.currentRecommendation);
    const result = await refineWorkoutWithOpenAI({
      currentRecommendation,
      userMessage,
      recentWorkouts: body.recentWorkouts,
    });

    const thread = await saveRecommendationRefinement({
      userId: session.user.id,
      recommendationId: body.recommendationId,
      threadId: body.threadId,
      userMessage,
      assistantMessage: result.refinement.message,
      actionType: result.refinement.action.type,
      actionPayload: result.refinement.action,
      recommendation: result.refinement.recommendation,
    });

    return Response.json({
      ok: true,
      model: result.model,
      refinement: result.refinement,
      recommendationId: body.recommendationId,
      threadId: thread.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refine workout";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
