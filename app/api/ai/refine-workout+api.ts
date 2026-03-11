import { refineWorkoutWithOpenAI, validateRecommendationDraft } from "@/lib/ai";

type RefineWorkoutRequestBody = {
  currentRecommendation?: unknown;
  userMessage?: string;
  recentWorkouts?: unknown;
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

  try {
    const currentRecommendation = validateRecommendationDraft(body.currentRecommendation);
    const result = await refineWorkoutWithOpenAI({
      currentRecommendation,
      userMessage,
      recentWorkouts: body.recentWorkouts,
    });

    return Response.json({
      ok: true,
      model: result.model,
      refinement: result.refinement,
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
