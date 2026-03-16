import { createTrainingPlanRecord } from "@/lib/ai-store";
import { validateTrainingPlanDraft } from "@/lib/ai";
import { getSessionFromRequest } from "@/lib/session";

type CreateTrainingPlanRequestBody = {
  trainingPlan?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateTrainingPlanRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const trainingPlan = validateTrainingPlanDraft(body?.trainingPlan);
    const createdPlan = await createTrainingPlanRecord({
      userId: session.user.id,
      trainingPlan,
      source: "MANUAL",
    });

    return Response.json({
      ok: true,
      trainingPlanId: createdPlan.trainingPlan.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create training plan";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
