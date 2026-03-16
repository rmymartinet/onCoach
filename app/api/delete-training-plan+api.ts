import { deleteTrainingPlanRecord } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";

type DeleteTrainingPlanBody = {
  trainingPlanId?: string;
};

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as DeleteTrainingPlanBody | null;
  const trainingPlanId = body?.trainingPlanId?.trim();

  if (!trainingPlanId) {
    return Response.json({ ok: false, message: "trainingPlanId is required" }, { status: 400 });
  }

  try {
    await deleteTrainingPlanRecord({
      userId: session.user.id,
      trainingPlanId,
    });

    return Response.json({ ok: true, trainingPlanId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete program";
    const status = message === "Training plan not found" ? 404 : 500;
    return Response.json({ ok: false, message }, { status });
  }
}
