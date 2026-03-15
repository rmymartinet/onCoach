import { updateTrainingPlanRecord } from "@/lib/ai-store";
import { validateTrainingPlanDraft } from "@/lib/ai";
import { getSessionFromRequest } from "@/lib/session";

type UpdateTrainingPlanRequestBody = {
  trainingPlanId?: string;
  trainingPlan?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UpdateTrainingPlanRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!body?.trainingPlanId) {
      return Response.json({ ok: false, message: "trainingPlanId is required" }, { status: 400 });
    }

    const trainingPlan = validateTrainingPlanDraft(body.trainingPlan);
    const updatedPlan = await updateTrainingPlanRecord({
      userId: session.user.id,
      trainingPlanId: body.trainingPlanId,
      trainingPlan,
    });

    return Response.json({
      ok: true,
      trainingPlanId: updatedPlan.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update training plan";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
