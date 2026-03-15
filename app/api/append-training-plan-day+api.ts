import { appendTrainingDayToPlan } from "@/lib/ai-store";
import { validateTrainingPlanDay } from "@/lib/ai";
import { getSessionFromRequest } from "@/lib/session";

type AppendTrainingPlanDayRequestBody = {
  trainingPlanId?: string;
  nextDay?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AppendTrainingPlanDayRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!body?.trainingPlanId) {
      return Response.json({ ok: false, message: "trainingPlanId is required" }, { status: 400 });
    }

    const nextDay = validateTrainingPlanDay(body.nextDay);
    const trainingPlan = await appendTrainingDayToPlan({
      userId: session.user.id,
      trainingPlanId: body.trainingPlanId,
      nextDay,
    });

    return Response.json({
      ok: true,
      trainingPlanId: trainingPlan.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to append training day";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
