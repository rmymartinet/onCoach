CREATE TYPE "DayExecutionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ADJUSTED', 'SKIPPED');

CREATE TYPE "ExerciseExecutionStatus" AS ENUM ('PLANNED', 'DONE', 'ADJUSTED', 'SKIPPED');

CREATE TABLE "TrainingDayCompletion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "status" "DayExecutionStatus" NOT NULL DEFAULT 'PLANNED',
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingDayCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingDayExerciseCompletion" (
  "id" TEXT NOT NULL,
  "completionId" TEXT NOT NULL,
  "plannedExerciseId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ExerciseExecutionStatus" NOT NULL DEFAULT 'PLANNED',
  "completedSets" INTEGER,
  "completedRepMin" INTEGER,
  "completedRepMax" INTEGER,
  "completedWeight" DOUBLE PRECISION,
  "completedUnit" TEXT,
  "completedRestSeconds" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingDayExerciseCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingDayCompletion_dayId_key" ON "TrainingDayCompletion"("dayId");
CREATE INDEX "TrainingDayCompletion_userId_updatedAt_idx" ON "TrainingDayCompletion"("userId", "updatedAt");
CREATE INDEX "TrainingDayCompletion_planId_updatedAt_idx" ON "TrainingDayCompletion"("planId", "updatedAt");

CREATE UNIQUE INDEX "TrainingDayExerciseCompletion_plannedExerciseId_key" ON "TrainingDayExerciseCompletion"("plannedExerciseId");
CREATE INDEX "TrainingDayExerciseCompletion_completionId_order_idx" ON "TrainingDayExerciseCompletion"("completionId", "order");

ALTER TABLE "TrainingDayCompletion"
ADD CONSTRAINT "TrainingDayCompletion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingDayCompletion"
ADD CONSTRAINT "TrainingDayCompletion_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingDayCompletion"
ADD CONSTRAINT "TrainingDayCompletion_dayId_fkey"
FOREIGN KEY ("dayId") REFERENCES "TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingDayExerciseCompletion"
ADD CONSTRAINT "TrainingDayExerciseCompletion_completionId_fkey"
FOREIGN KEY ("completionId") REFERENCES "TrainingDayCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingDayExerciseCompletion"
ADD CONSTRAINT "TrainingDayExerciseCompletion_plannedExerciseId_fkey"
FOREIGN KEY ("plannedExerciseId") REFERENCES "TrainingDayExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
