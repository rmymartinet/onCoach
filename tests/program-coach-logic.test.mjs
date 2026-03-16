import test from "node:test";
import assert from "node:assert/strict";

import {
  appendProgramDayContext,
  extractRequestedDayCount,
  extractRollingSplitConfig,
  extractRequestedWeekCount,
  resolveProgramDayReference,
  shouldGenerateNextDay,
  shouldRefineExistingProgram,
} from "../lib/program-coach-logic.js";

const trainingPlan = {
  weeks: [
    {
      weekNumber: 1,
      days: [
        { id: "d1", dayLabel: "Mon", title: "Upper A" },
        { id: "d2", dayLabel: "Tue", title: "Lower A" },
      ],
    },
    {
      weekNumber: 2,
      days: [
        { id: "d3", dayLabel: "Thu", title: "Upper B" },
        { id: "d4", dayLabel: "Fri", title: "Lower B" },
      ],
    },
  ],
};

test("extractRequestedWeekCount respects explicit duration", () => {
  assert.equal(extractRequestedWeekCount("Build me a 6 week plan"), 6);
  assert.equal(extractRequestedWeekCount("Je veux un programme sur 3 semaines"), 3);
  assert.equal(extractRequestedWeekCount("No duration given"), null);
});

test("extractRequestedDayCount respects explicit weekly/session count", () => {
  assert.equal(extractRequestedDayCount("Make it a 5 day split"), 5);
  assert.equal(extractRequestedDayCount("Je veux 2 jours par semaine"), 2);
  assert.equal(
    extractRequestedDayCount("Push pull legs on 5 weeks with 1 day of rest and then repeat"),
    null,
  );
  assert.equal(
    extractRequestedDayCount("Push pull legs sur 5 semaines avec 1 jour de repos"),
    null,
  );
  assert.equal(
    extractRequestedDayCount("Je veux 3 entraînements, 1 jour de repos et on répète"),
    null,
  );
  assert.equal(extractRequestedDayCount("No session count here"), null);
});

test("extractRollingSplitConfig detects repeated train/rest cycles", () => {
  assert.deepEqual(
    extractRollingSplitConfig(
      "je veux un entrainement de type push pull leg sur 5 semaine 3 entrainement 1 jour de repos et on repete",
    ),
    { trainingDays: 3, restDays: 1 },
  );
  assert.deepEqual(
    extractRollingSplitConfig("3 trainings, 1 day of rest, repeat"),
    { trainingDays: 3, restDays: 1 },
  );
  assert.equal(extractRollingSplitConfig("5 day split over 6 weeks"), null);
});

test("shouldGenerateNextDay only returns true for explicit continuation asks", () => {
  assert.equal(shouldGenerateNextDay("Generate the next workout"), true);
  assert.equal(shouldGenerateNextDay("Quelle est la suite du programme ?"), true);
  assert.equal(
    shouldGenerateNextDay("Transform this program into 6 weeks with more leg focus"),
    false,
  );
});

test("shouldRefineExistingProgram catches global program edits", () => {
  assert.equal(
    shouldRefineExistingProgram("Add supersets where it makes sense", null),
    true,
  );
  assert.equal(
    shouldRefineExistingProgram("Replace lunges everywhere in the plan", null),
    true,
  );
});

test("resolveProgramDayReference ignores whole-program requests", () => {
  assert.equal(
    resolveProgramDayReference(
      "Transform this program into 6 weeks and 5 days per week",
      trainingPlan,
      null,
    ),
    null,
  );
});

test("resolveProgramDayReference requests selection for ambiguous day-level asks", () => {
  const result = resolveProgramDayReference("Change this session", trainingPlan, null);
  assert.ok(result);
  assert.equal(result.type, "needs_selection");
  assert.equal(result.options.length, 4);
});

test("resolveProgramDayReference resolves direct day names", () => {
  const result = resolveProgramDayReference("Modify Lower B", trainingPlan, null);
  assert.ok(result);
  assert.equal(result.type, "selected");
  assert.equal(result.option.id, "d4");
});

test("appendProgramDayContext prefixes the selected day cleanly", () => {
  const text = appendProgramDayContext("Add supersets here", {
    id: "d4",
    label: "Week 2 · Fri · Lower B",
    weekIndex: 1,
    dayIndex: 1,
    weekNumber: 2,
    dayLabel: "Fri",
    dayTitle: "Lower B",
  });

  assert.match(text, /Selected training day: Week 2 · Fri · Lower B\./);
  assert.match(text, /Add supersets here/);
});
