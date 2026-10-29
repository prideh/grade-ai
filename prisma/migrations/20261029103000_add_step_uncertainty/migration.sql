-- AlterTable
ALTER TABLE "StepCorrection" ADD COLUMN "istUnsicher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unsicherheitsGrund" TEXT;
