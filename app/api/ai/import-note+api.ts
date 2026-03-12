import { segmentNoteImportWithOpenAI } from "@/lib/ai";
import { createNoteImportRecord } from "@/lib/ai-store";
import { getSessionFromRequest } from "@/lib/session";

type ImportNoteRequestBody = {
  rawText?: string;
  source?: "APPLE_NOTES_SHARE" | "MANUAL_PASTE";
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ImportNoteRequestBody | null;
  const rawText = body?.rawText?.trim();

  if (!rawText) {
    return Response.json({ ok: false, message: "rawText is required" }, { status: 400 });
  }

  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const segmented = await segmentNoteImportWithOpenAI(rawText);
    const persisted = await createNoteImportRecord({
      userId: session.user.id,
      rawText,
      source: body?.source ?? "APPLE_NOTES_SHARE",
      segmentation: segmented.segmentation,
    });

    return Response.json({
      ok: true,
      model: segmented.model,
      noteImportId: persisted.noteImport.id,
      summary: segmented.segmentation.summary,
      candidates: persisted.candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        rawExcerpt: candidate.rawExcerpt,
        performedAt: candidate.performedAt?.toISOString() ?? null,
        confidence: candidate.confidence,
        isMostRecent: candidate.isMostRecent,
        dedupeStatus: candidate.dedupeStatus,
        dedupeReason: candidate.dedupeReason,
        matchedWorkoutId: candidate.matchedWorkoutId,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import workout note";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
