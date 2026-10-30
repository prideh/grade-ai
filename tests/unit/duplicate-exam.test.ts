import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Feature: Duplicate Exam with Rubric, Tasks, and Settings', () => {
  it('Prüfungsdetailseite bietet "Prüfung duplizieren" an', () => {
    const detailFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/exams/[id]/page.tsx'),
      'utf-8'
    );
    expect(detailFile).toContain('Prüfung duplizieren');
    expect(detailFile).toContain('openDuplicate');
    expect(detailFile).toContain('/duplicate');
  });

  it('Prüfungsübersichtsseite bietet "Prüfung duplizieren" an und waehlt standardmaessig dieselbe Klasse', () => {
    const listFile = fs.readFileSync(path.resolve(__dirname, '../../app/exams/page.tsx'), 'utf-8');
    expect(listFile).toContain('Prüfung duplizieren');
    expect(listFile).toContain('setCopyTargetClassId(exam.classId)');
    expect(listFile).toContain('/duplicate');
  });

  it('Duplizierungs-API kopiert alle Definitionen (Rubrik, Aufgaben, Einstellungen) und schliesst Abgaben aus', () => {
    const apiFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/exams/[id]/duplicate/route.ts'),
      'utf-8'
    );
    expect(apiFile).toContain('`${sourceExam.title} (Kopie)`');
    expect(apiFile).toContain('examTask.createMany');
    expect(apiFile).toContain('rubricText');
    expect(apiFile).toContain('examTemplateText');
    expect(apiFile).toContain('gradingNotes');
    expect(apiFile).toContain('gradingFormula');
    expect(apiFile).toContain('gradeRounding');
    expect(apiFile).toContain('maxPoints');
    expect(apiFile).toContain('orderIndex');
    // Ensure submissions/corrections/logs are NOT copied
    expect(apiFile).not.toContain('submission.create');
    expect(apiFile).not.toContain('correctionLog.create');
    expect(apiFile).not.toContain('submissionTask.create');
  });

  it('Verwendet kein "ß" in duplizierungsbezogenen Dateien (Schweizer Rechtschreibung)', () => {
    const apiFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/exams/[id]/duplicate/route.ts'),
      'utf-8'
    );
    const detailFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/exams/[id]/page.tsx'),
      'utf-8'
    );
    const listFile = fs.readFileSync(path.resolve(__dirname, '../../app/exams/page.tsx'), 'utf-8');

    expect(apiFile).not.toContain('ß');
    expect(detailFile).not.toContain('ß');
    expect(listFile).not.toContain('ß');
  });
});
