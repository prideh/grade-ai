-- AlterEnum
BEGIN;
CREATE TYPE "SubmissionStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TABLE "public"."Submission" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Submission" ALTER COLUMN "status" TYPE "SubmissionStatus_new" USING ("status"::text::"SubmissionStatus_new");
ALTER TYPE "SubmissionStatus" RENAME TO "SubmissionStatus_old";
ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";
DROP TYPE "public"."SubmissionStatus_old";
ALTER TABLE "Submission" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "targetStudentId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "helpfulTip" DROP NOT NULL,
ALTER COLUMN "exerciseRecommendation" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ExamTask" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT,
    "teacherId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "examTitle" TEXT NOT NULL,
    "studentName" TEXT NOT NULL DEFAULT 'Automatische Zuordnung',
    "modelUsed" TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "CorrectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamTask_examId_taskId_key" ON "ExamTask"("examId", "taskId");

-- AddForeignKey
ALTER TABLE "ExamTask" ADD CONSTRAINT "ExamTask_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
