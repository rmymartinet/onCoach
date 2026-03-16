export function normalizeScopeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function buildProgramDaySelectionOptions(trainingPlan) {
  if (!trainingPlan?.weeks) return [];

  return trainingPlan.weeks.flatMap((week, weekIndex) =>
    (week.days ?? []).map((day, dayIndex) => ({
      id: day.id,
      label: `Week ${week.weekNumber} · ${day.dayLabel} · ${day.title}`,
      weekIndex,
      dayIndex,
      weekNumber: week.weekNumber,
      dayLabel: day.dayLabel,
      dayTitle: day.title,
    })),
  );
}

export function resolveProgramDayReference(requestText, trainingPlan, currentSelection) {
  if (!trainingPlan || !requestText?.trim()) return null;

  const options = buildProgramDaySelectionOptions(trainingPlan);
  if (options.length <= 1) return null;

  const normalizedRequest = normalizeScopeText(requestText);
  const refersToWholeProgram = /\b(program|programme|plan|block|bloc)\b/.test(
    normalizedRequest,
  );
  if (refersToWholeProgram) {
    return null;
  }

  const mentionsAmbiguousReference =
    /\b(this session|that session|this workout|that workout|this day|that day)\b/.test(
      normalizedRequest,
    ) ||
    /\b(ce|cet|cette|celle|celui)\s+(jour|seance|entrainement|workout|session)\b/.test(
      normalizedRequest,
    );

  const matches = options.filter((option) => {
    const title = normalizeScopeText(option.dayTitle);
    const dayLabel = normalizeScopeText(option.dayLabel);
    return normalizedRequest.includes(title) || normalizedRequest.includes(dayLabel);
  });

  if (matches.length === 1) {
    return { type: "selected", option: matches[0] };
  }

  if (matches.length > 1) {
    return { type: "needs_selection", options: matches };
  }

  if (mentionsAmbiguousReference && currentSelection) {
    return { type: "selected", option: currentSelection };
  }

  if (mentionsAmbiguousReference) {
    return { type: "needs_selection", options };
  }

  return null;
}

export function appendProgramDayContext(value, selectedProgramDay) {
  if (!selectedProgramDay) {
    return value;
  }

  const prefix = `Selected training day: Week ${selectedProgramDay.weekNumber} · ${selectedProgramDay.dayLabel} · ${selectedProgramDay.dayTitle}.`;
  return value?.trim() ? `${prefix}\n\n${value}` : prefix;
}

export function shouldRefineExistingProgram(userMessage, selectedProgramDay) {
  if (selectedProgramDay) return true;
  const raw = normalizeScopeText(userMessage ?? "");
  return /(change|edit|adjust|update|replace|swap|move|remove|add|modify|superset|drop set|tempo|myo|rest pause|structure|reorganize|reorganise|remplace|ajoute|modifie|bouge|enleve)/.test(
    raw,
  );
}

export function shouldGenerateNextDay(userMessage) {
  const raw = normalizeScopeText(userMessage ?? "");
  return /\b(next day|next workout|next session|continue the program|continue this plan|what comes next|prochain jour|prochaine seance|prochain entrainement|suite du programme)\b/.test(
    raw,
  );
}

function parseCountToken(value) {
  const normalized = value.toLowerCase();
  const dictionary = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
  };
  return dictionary[normalized] ?? null;
}

export function extractRequestedWeekCount(userMessage) {
  const raw = userMessage?.toLowerCase() ?? "";
  const match = raw.match(
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:week|weeks|semaine|semaines)\b/,
  );
  if (!match?.[1]) return null;
  return parseCountToken(match[1]);
}

export function extractRequestedDayCount(userMessage) {
  const raw = userMessage?.toLowerCase() ?? "";
  const restDayMatch = raw.match(
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s+(?:day|days|jour|jours)\s+(?:of\s+)?(?:rest|repos)\b/,
  );
  if (restDayMatch) {
    return null;
  }

  const repeatCycleMatch =
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:training|trainings|entrainement|entrainements|séances|seances|sessions)\b.*\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s+(?:day|days|jour|jours)\s+(?:of\s+)?(?:rest|repos)\b.*\b(repeat|repete|répète|repeat it|on repeat)\b/;
  if (repeatCycleMatch.test(raw)) {
    return null;
  }

  const patterns = [
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*-\s*(?:day|days)\s+split\b/,
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:day|days|jour|jours|session|sessions|workout|workouts)\s+(?:per|a)\s+week\b/,
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:jours?|sessions?)\s+par\s+semaine\b/,
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:day|days|jour|jours|session|sessions|workout|workouts)\s+split\b/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return parseCountToken(match[1]);
    }
  }

  return null;
}

export function extractRollingSplitConfig(userMessage) {
  const raw = normalizeScopeText(userMessage ?? "");

  const match = raw.match(
    /\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s*(?:training|trainings|entrainement|entrainements|seances|sessions)\b.*\b(\d+|one|two|three|four|five|six|un|une|deux|trois|quatre|cinq|six)\s+(?:day|days|jour|jours)\s+(?:of\s+)?(?:rest|repos)\b.*\b(repeat|repete|repeat it|on repeat|on recommence|et on repete|et on recommence)\b/,
  );

  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const trainingDays = parseCountToken(match[1]);
  const restDays = parseCountToken(match[2]);

  if (!trainingDays || !restDays) {
    return null;
  }

  return {
    trainingDays,
    restDays,
  };
}
