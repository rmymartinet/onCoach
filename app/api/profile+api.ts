import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

function asOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function asOptionalInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  return undefined;
}

function asOptionalFloat(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : [];
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session?.user?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const completedOnboarding = payload.completeOnboarding === true;

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      goal: asOptionalString(payload.goal),
      level: asOptionalString(payload.level),
      frequencyPerWeek: asOptionalInt(payload.frequencyPerWeek),
      sessionDuration: asOptionalInt(payload.sessionDuration),
      splitPreference: asOptionalString(payload.splitPreference),
      trainingLocation: asOptionalString(payload.trainingLocation),
      jobActivityLevel: asOptionalString(payload.jobActivityLevel),
      heightCm: asOptionalInt(payload.heightCm),
      weightKg: asOptionalFloat(payload.weightKg),
      experienceYears: asOptionalFloat(payload.experienceYears),
      equipment: asStringArray(payload.equipment),
      preferredStyles: asStringArray(payload.preferredStyles),
      favoriteExercises: asStringArray(payload.favoriteExercises),
      avoidedExercises: asStringArray(payload.avoidedExercises),
      priorityMuscles: asStringArray(payload.priorityMuscles),
      limitations: asStringArray(payload.limitations),
      preferredTrainingTimes: asStringArray(payload.preferredTrainingTimes),
      availableDays: asStringArray(payload.availableDays),
      onboardingCompletedAt: completedOnboarding ? new Date() : undefined,
    },
    select: {
      id: true,
      goal: true,
      level: true,
      frequencyPerWeek: true,
      sessionDuration: true,
      splitPreference: true,
      trainingLocation: true,
      jobActivityLevel: true,
      heightCm: true,
      weightKg: true,
      experienceYears: true,
      equipment: true,
      preferredStyles: true,
      favoriteExercises: true,
      avoidedExercises: true,
      priorityMuscles: true,
      limitations: true,
      preferredTrainingTimes: true,
      availableDays: true,
      onboardingCompletedAt: true,
    },
  });

  return Response.json({
    ok: true,
    user: updatedUser,
  });
}
