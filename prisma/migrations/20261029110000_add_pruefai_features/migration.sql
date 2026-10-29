-- AlterTable
ALTER TABLE "Exam"
ADD COLUMN "examTemplateText" TEXT,
ADD COLUMN "gradingNotes" TEXT,
ADD COLUMN "gradingFormula" TEXT NOT NULL DEFAULT 'LINEAR_60',
ADD COLUMN "gradeRounding" TEXT NOT NULL DEFAULT '0.1';

-- AlterTable
ALTER TABLE "Submission"
ADD COLUMN "extractedStudentName" TEXT,
ADD COLUMN "suggestedStudentId" TEXT,
ADD COLUMN "isStudentMatchUncertain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isExamMatchUncertain" BOOLEAN NOT NULL DEFAULT false;
