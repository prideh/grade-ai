/* eslint-disable no-console */
import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import crypto from 'crypto';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/grade_ai?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Native scrypt hashing identical to lib/auth.ts
function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function main() {
  console.log('🌱 Start seeding expanded database...');

  // 1. Create Default Teacher
  const email = 'lehrer@schule.ch';
  const name = 'Frau Meier';
  const passwordHash = await hashPassword('password123');

  const teacher = await prisma.teacher.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash,
    },
  });

  console.log(`👤 Default teacher: ${teacher.name} (${teacher.email})`);

  // Clean existing classes for this teacher to prevent primary key / unique constraint failures on re-run
  const existingClasses = await prisma.class.findMany({
    where: { teacherId: teacher.id },
  });

  for (const c of existingClasses) {
    await prisma.class.delete({ where: { id: c.id } });
  }
  console.log('🧹 Cleaned existing class data for seed freshness.');

  // 2. Create Classes
  const classNames = ['Klasse 9a', 'Klasse 9b', 'Klasse 10a'];
  const createdClasses: Record<string, { id: string; name: string }> = {};

  for (const name of classNames) {
    const schoolClass = await prisma.class.create({
      data: {
        name,
        teacherId: teacher.id,
      },
    });
    createdClasses[name] = schoolClass;
    console.log(`🏫 Class created: ${schoolClass.name}`);
  }

  // 3. Enroll Students
  const studentsMap: Record<string, string[]> = {
    'Klasse 9a': [
      'Max Mustermann',
      'Sarah Tobler',
      'Lukas Frischknecht',
      'Anna Bieri',
      'David Müller',
    ],
    'Klasse 9b': ['Peter Keller', 'Julia Kaufmann', 'Simon Meier', 'Laura Schweizer'],
    'Klasse 10a': ['Marc Steiner', 'Elena Roth', 'Nico Graf'],
  };

  const createdStudents: Record<string, { id: string; name: string }[]> = {
    'Klasse 9a': [],
    'Klasse 9b': [],
    'Klasse 10a': [],
  };

  for (const [className, studentNames] of Object.entries(studentsMap)) {
    const classId = createdClasses[className].id;
    for (const name of studentNames) {
      const student = await prisma.student.create({
        data: {
          name,
          classId,
        },
      });
      createdStudents[className].push(student);
      console.log(`🎓 Student enrolled: ${student.name} in ${className}`);
    }
  }

  // 4. Create Exams
  // Exam 1: Klasse 9a Math 1
  const exam9aMath1 = await prisma.exam.create({
    data: {
      title: 'Mathematik Klassenarbeit 1: Lineare Gleichungen',
      subject: 'Mathematik',
      rubricText:
        'Aufgabe 1: 3x - 5 = 10 -> x = 5. (5 Punkte)\nAufgabe 2: 2(x+3) = 14 -> x = 4. (5 Punkte)\nAufgabe 3: Lineares System x+y=5, x-y=1 -> x=3, y=2. (10 Punkte)',
      maxPoints: 20,
      classId: createdClasses['Klasse 9a'].id,
    },
  });

  // Exam 2: Klasse 9a Math 2
  const exam9aMath2 = await prisma.exam.create({
    data: {
      title: 'Mathematik Klassenarbeit 2: Quadratische Funktionen',
      subject: 'Mathematik',
      rubricText:
        'Aufgabe 1: x^2 - 4 = 0 -> x = ±2. (5 Punkte)\nAufgabe 2: Scheitelpunkt bestimmen f(x)=(x-3)^2 + 1 -> S(3,1). (10 Punkte)',
      maxPoints: 15,
      classId: createdClasses['Klasse 9a'].id,
    },
  });

  // Exam 3: Klasse 9a Physik 1
  await prisma.exam.create({
    data: {
      title: 'Physik Test 1: Mechanik & Beschleunigung',
      subject: 'Physik',
      rubricText: 'Aufgabe 1: Formel v = a * t herleiten und berechnen. Max 10 Punkte.',
      maxPoints: 10,
      classId: createdClasses['Klasse 9a'].id,
    },
  });

  // Exam 4: Klasse 9b Math 1
  const exam9bMath1 = await prisma.exam.create({
    data: {
      title: 'Mathematik Klassenarbeit 1: Lineare Gleichungen',
      subject: 'Mathematik',
      rubricText:
        'Aufgabe 1: 3x - 5 = 10 -> x = 5. (5 Punkte)\nAufgabe 2: 2(x+3) = 14 -> x = 4. (5 Punkte)\nAufgabe 3: Lineares System x+y=5, x-y=1 -> x=3, y=2. (10 Punkte)',
      maxPoints: 20,
      classId: createdClasses['Klasse 9b'].id,
    },
  });

  // Exam 5: Klasse 10a Chemie 1
  const exam10aChemie1 = await prisma.exam.create({
    data: {
      title: 'Chemie Prüfung 1: Periodensystem & Atome',
      subject: 'Chemie',
      rubricText:
        'Aufgabe 1: Elektronenkonfiguration zeichnen. Max 10 Punkte.\nAufgabe 2: Chemische Bindung erklären. Max 10 Punkte.\nAufgabe 3: Stöchiometrische Berechnungen. Max 10 Punkte.',
      maxPoints: 30,
      classId: createdClasses['Klasse 10a'].id,
    },
  });

  console.log('📝 Exams created across all classes.');

  // 5. Helper to create a submission with mock tasks/steps
  async function seedSubmission({
    student,
    exam,
    earnedPoints,
    grade,
    status = 'COMPLETED',
    strengths = [],
    weaknesses = [],
    helpfulTip = '',
    exerciseRecommendation = '',
  }: {
    student: { id: string; name: string };
    exam: { id: string; maxPoints: number };
    earnedPoints: number;
    grade: string;
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    strengths?: string[];
    weaknesses?: string[];
    helpfulTip?: string;
    exerciseRecommendation?: string;
  }) {
    const raw = parseFloat(grade);
    const sub = await prisma.submission.create({
      data: {
        examId: exam.id,
        studentId: student.id,
        status,
        earnedPoints,
        gradeRaw: raw,
        gradeRounded: grade,
        strengths,
        weaknesses,
        helpfulTip,
        exerciseRecommendation,
        studentExamUrl: null,
      },
    });

    // Create 2 mock TaskCorrections
    const task1Max = exam.maxPoints * 0.4;
    const task1Earned = Math.min(task1Max, earnedPoints * 0.4);
    const task2Max = exam.maxPoints * 0.6;
    const task2Earned = Math.max(0, earnedPoints - task1Earned);

    const tc1 = await prisma.taskCorrection.create({
      data: {
        submissionId: sub.id,
        taskId: '1',
        title: 'Aufgabe 1',
        studentAnswer: 'Schülerantwort für Aufgabe 1. Rechnungen durchgeführt.',
        erzieltePunkte: task1Earned,
        maximalPunkte: task1Max,
        status: task1Earned === task1Max ? 'Korrekt' : task1Earned > 0 ? 'Folgefehler' : 'Fehler',
        lehrerKommentar:
          task1Earned === task1Max ? 'Hervorragend gelöst!' : 'Ein kleiner Rechenfehler.',
        orderIndex: 0,
      },
    });

    await prisma.taskCorrection.create({
      data: {
        submissionId: sub.id,
        taskId: '2',
        title: 'Aufgabe 2',
        studentAnswer: 'Schülerantwort für Aufgabe 2. Formeln aufgestellt.',
        erzieltePunkte: task2Earned,
        maximalPunkte: task2Max,
        status: task2Earned === task2Max ? 'Korrekt' : task2Earned > 0 ? 'Folgefehler' : 'Fehler',
        lehrerKommentar:
          task2Earned === task2Max ? 'Perfekt.' : 'Folgeschritte korrekt durchgeführt.',
        orderIndex: 1,
      },
    });

    // Create StepCorrections for Task 1
    await prisma.stepCorrection.create({
      data: {
        taskCorrectionId: tc1.id,
        schrittIndex: 0,
        schrittText: '3x - 5 = 10',
        istKorrekt: true,
        fehlerTyp: 'KeinFehler',
        erreichtePunkte: task1Max * 0.5,
        maximalPunkte: task1Max * 0.5,
        begruendung: 'Gleichung korrekt abgeschrieben.',
      },
    });

    await prisma.stepCorrection.create({
      data: {
        taskCorrectionId: tc1.id,
        schrittIndex: 1,
        schrittText: '3x = 15 -> x = 5',
        istKorrekt: task1Earned > task1Max * 0.5,
        fehlerTyp: task1Earned === task1Max ? 'KeinFehler' : 'Rechenfehler',
        erreichtePunkte: Math.max(0, task1Earned - task1Max * 0.5),
        maximalPunkte: task1Max * 0.5,
        begruendung: task1Earned === task1Max ? 'Korrekt berechnet.' : 'Rechenfehler bei Division.',
      },
    });
  }

  // 6. Populate Submissions
  // Klasse 9a - Exam 1 (Math 1)
  const class9a = createdStudents['Klasse 9a'];
  await seedSubmission({
    student: class9a[0], // Max Mustermann
    exam: exam9aMath1,
    earnedPoints: 17,
    grade: '5.3',
    strengths: ['Strukturiertes Vorgehen', 'Richtige Anwendung der Lösungsformel'],
    weaknesses: ['Flüchtigkeitsfehler in Aufgabe 1b'],
    helpfulTip: 'Achte auf das Vorzeichen bei der Termvereinfachung.',
    exerciseRecommendation: 'S. 45 Aufgabe 3-5',
  });

  await seedSubmission({
    student: class9a[1], // Sarah Tobler
    exam: exam9aMath1,
    earnedPoints: 19,
    grade: '5.8',
    strengths: ['Fehlerfreie Rechnung', 'Sehr saubere Darstellung'],
    weaknesses: [],
    helpfulTip: 'Hervorragende Arbeit. Du kannst dich an Bonusaufgaben wagen.',
    exerciseRecommendation: 'S. 48 Aufgabe 10 (Zusatz)',
  });

  await seedSubmission({
    student: class9a[2], // Lukas Frischknecht
    exam: exam9aMath1,
    earnedPoints: 12,
    grade: '4.0',
    strengths: ['Gute Ansätze bei Aufgabe 1'],
    weaknesses: ['Folgefehler in Aufgabe 2 durch Rechenfehler in Zeile 2'],
    helpfulTip: 'Rechne jeden Schritt nochmals kurz im Kopf nach.',
    exerciseRecommendation: 'S. 42 Aufgabe 1-4',
  });

  await seedSubmission({
    student: class9a[3], // Anna Bieri
    exam: exam9aMath1,
    earnedPoints: 9,
    grade: '3.3',
    strengths: ['Aufgabe 1 korrekt gelöst'],
    weaknesses: ['Verständnisprobleme bei linearen Systemen', 'Fehlende Lösungswege bei Aufgabe 2'],
    helpfulTip: 'Nutze die Nachhilfestunde, um lineare Gleichungssysteme zu wiederholen.',
    exerciseRecommendation: 'Arbeitsblatt "Lineare Systeme" Grundstufe',
  });

  await seedSubmission({
    student: class9a[4], // David Müller
    exam: exam9aMath1,
    earnedPoints: 14,
    grade: '4.5',
    status: 'PENDING', // Keep one as pending to test status badges!
    strengths: ['Gute mathematische Intuition'],
    weaknesses: ['Unvollständige Begründungen bei Beweisen'],
    helpfulTip: 'Schreibe jeden mathematischen Zwischenschritt explizit auf.',
    exerciseRecommendation: 'S. 44 Aufgabe 6-8',
  });

  // Klasse 9a - Exam 2 (Math 2) - to show progress metrics!
  await seedSubmission({
    student: class9a[0], // Max Mustermann
    exam: exam9aMath2,
    earnedPoints: 13.5,
    grade: '5.5', // Improved from 5.3!
    strengths: ['Hervorragendes Verständnis quadratischer Gleichungen'],
    weaknesses: [],
    helpfulTip: 'Weiter so!',
  });

  await seedSubmission({
    student: class9a[1], // Sarah Tobler
    exam: exam9aMath2,
    earnedPoints: 15,
    grade: '6.0', // Improved from 5.8!
    strengths: ['Perfekte Punktzahl', 'Elegante Beweisführung'],
    weaknesses: [],
  });

  await seedSubmission({
    student: class9a[2], // Lukas Frischknecht
    exam: exam9aMath2,
    earnedPoints: 11,
    grade: '4.7', // Improved from 4.0!
    strengths: ['Starke Verbesserung beim Aufzeichnen von Scheitelpunkten'],
    weaknesses: ['Kleinere Rundungsfehler'],
  });

  await seedSubmission({
    student: class9a[3], // Anna Bieri
    exam: exam9aMath2,
    earnedPoints: 7.5,
    grade: '3.5', // Improved from 3.3!
    strengths: ['Basisberechnungen funktionieren gut'],
    weaknesses: ['Probleme beim Anwenden der PQ-Formel'],
    helpfulTip: 'Lerne die Formel auswendig.',
  });

  // Klasse 9b - Exam 4 (Math 1)
  const class9b = createdStudents['Klasse 9b'];
  await seedSubmission({
    student: class9b[0], // Peter Keller
    exam: exam9bMath1,
    earnedPoints: 16,
    grade: '5.0',
    strengths: ['Konzentriertes Arbeiten'],
  });
  await seedSubmission({
    student: class9b[1], // Julia Kaufmann
    exam: exam9bMath1,
    earnedPoints: 18,
    grade: '5.5',
    strengths: ['Exzellentes logisches Denken'],
  });

  // Klasse 10a - Exam 5 (Chemie 1)
  const class10a = createdStudents['Klasse 10a'];
  await seedSubmission({
    student: class10a[0], // Marc Steiner
    exam: exam10aChemie1,
    earnedPoints: 25,
    grade: '5.2',
    strengths: ['Hervorragende Atombindungs-Skizzen'],
  });

  await seedSubmission({
    student: class10a[1], // Elena Roth
    exam: exam10aChemie1,
    earnedPoints: 28,
    grade: '5.7',
    strengths: ['Exzellente Stöchiometrie-Berechnungen', 'Klar strukturierter Lösungsweg'],
  });

  await seedSubmission({
    student: class10a[2], // Nico Graf
    exam: exam10aChemie1,
    earnedPoints: 16,
    grade: '3.7',
    strengths: ['Konfigurationen teilweise korrekt'],
    weaknesses: ['Verständnisfehler bei Elektronenpaarbindungen'],
    helpfulTip: 'Sieh dir Kapitel 4 im Lehrbuch nochmals an.',
  });

  console.log('✅ Submissions, task corrections, and step corrections successfully seeded.');
  console.log('🎉 Expanded Database Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
