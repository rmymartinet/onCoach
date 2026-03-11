import { parseWorkoutNoteWithOpenAI } from "@/lib/ai";

type ParseWorkoutRequestBody = {
  rawText?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ParseWorkoutRequestBody | null;
  const rawText = body?.rawText?.trim();

  if (!rawText) {
    return Response.json({ message: "rawText is required" }, { status: 400 });
  }

  try {
    const result = await parseWorkoutNoteWithOpenAI(rawText);

    return Response.json({
      ok: true,
      model: result.model,
      parsedWorkout: result.parsedWorkout,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse workout note with AI";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
