import { generateNextTrainingDayWithOpenAI } from "@/lib/ai";
import { getSessionFromRequest } from "@/lib/session";

type GenerateNextTrainingDayRequestBody = {
  trainingPlan?: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  userMessage?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as GenerateNextTrainingDayRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!body?.trainingPlan) {
      return Response.json({ ok: false, message: "trainingPlan is required" }, { status: 400 });
    }

    const result = await generateNextTrainingDayWithOpenAI({
      trainingPlan: body.trainingPlan,
      userProfile: body.userProfile,
      recentWorkouts: body.recentWorkouts,
      userMessage: body.userMessage,
    });

    return Response.json({
      ok: true,
      model: result.model,
      nextDay: result.nextDay,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate next training day";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
