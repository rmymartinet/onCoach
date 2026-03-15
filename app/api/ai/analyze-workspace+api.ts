import { analyzeAiWorkspaceWithOpenAI } from "@/lib/ai";
import { getSessionFromRequest } from "@/lib/session";

type AnalyzeWorkspaceRequestBody = {
  mode?: "import_note" | "paste_workout" | "generate_from_scratch";
  sourceText?: string;
  messages?: unknown;
  userProfile?: unknown;
  recentWorkouts?: unknown;
  trainingPlan?: unknown;
  clarificationRound?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AnalyzeWorkspaceRequestBody | null;

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!body?.mode) {
      return Response.json({ ok: false, message: "mode is required" }, { status: 400 });
    }

    const result = await analyzeAiWorkspaceWithOpenAI({
      mode: body.mode,
      sourceText: body.sourceText,
      messages: body.messages,
      userProfile: body.userProfile,
      recentWorkouts: body.recentWorkouts,
      trainingPlan: body.trainingPlan,
      clarificationRound: body.clarificationRound,
    });

    return Response.json({
      ok: true,
      model: result.model,
      decision: result.decision,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze workspace context";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
