import { parseWorkoutCollectionWithOpenAI } from "@/lib/ai";

type ParseWorkoutCollectionRequestBody = {
  rawText?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ParseWorkoutCollectionRequestBody | null;
  const rawText = body?.rawText?.trim();

  if (!rawText) {
    return Response.json({ ok: false, message: "rawText is required" }, { status: 400 });
  }

  try {
    const result = await parseWorkoutCollectionWithOpenAI(rawText);

    return Response.json({
      ok: true,
      model: result.model,
      parsedCollection: result.parsedCollection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse note directly with AI";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
