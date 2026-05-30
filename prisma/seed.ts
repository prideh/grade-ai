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
  console.log('🌱 Start seeding simplified high-fidelity database...');

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

  // 2. Create Single Class
  const schoolClass = await prisma.class.create({
    data: {
      name: 'Klasse 9a',
      teacherId: teacher.id,
    },
  });
  console.log(`🏫 Class created: ${schoolClass.name}`);

  // 3. Enroll exactly 3 Students
  const studentNames = ['Max Mustermann', 'Sarah Tobler', 'Lukas Frischknecht'];
  const enrolledStudents: { id: string; name: string }[] = [];

  for (const name of studentNames) {
    const student = await prisma.student.create({
      data: {
        name,
        classId: schoolClass.id,
      },
    });
    enrolledStudents.push(student);
    console.log(`🎓 Student enrolled: ${student.name} in ${schoolClass.name}`);
  }

  // 4. Create 2 Exams
  // Exam 1: Klasse 9a Math 1
  const exam9aMath1 = await prisma.exam.create({
    data: {
      title: 'Mathematik Klassenarbeit 1: Lineare Gleichungen',
      subject: 'Mathematik',
      rubricText:
        'Aufgabe 1: 3x - 5 = 10 -> x = 5. (5 Punkte)\nAufgabe 2: 2(x+3) = 14 -> x = 4. (5 Punkte)\nAufgabe 3: Lineares System x+y=5, x-y=1 -> x=3, y=2. (10 Punkte)',
      maxPoints: 20,
      classId: schoolClass.id,
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
      classId: schoolClass.id,
    },
  });

  console.log('📝 Exams created.');

  // 5. Helper to create a submission with mock tasks/steps for BOTH Aufgabe 1 and Aufgabe 2
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
    exam: { id: string; title: string; maxPoints: number };
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

    const tc2 = await prisma.taskCorrection.create({
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

    const isMath1 = exam.title.includes('Klassenarbeit 1');

    if (isMath1) {
      // StepCorrections for Task 1 (3x - 5 = 10)
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
          begruendung:
            task1Earned === task1Max ? 'Korrekt berechnet.' : 'Rechenfehler bei Division.',
        },
      });

      // StepCorrections for Task 2 (2(x+3) = 14)
      const t2Half = task2Max * 0.5;
      await prisma.stepCorrection.create({
        data: {
          taskCorrectionId: tc2.id,
          schrittIndex: 0,
          schrittText: '2x + 6 = 14',
          istKorrekt: true,
          fehlerTyp: 'KeinFehler',
          erreichtePunkte: t2Half,
          maximalPunkte: t2Half,
          begruendung: 'Klammer korrekt ausmultipliziert.',
        },
      });

      await prisma.stepCorrection.create({
        data: {
          taskCorrectionId: tc2.id,
          schrittIndex: 1,
          schrittText: '2x = 8 -> x = 4',
          istKorrekt: task2Earned > t2Half,
          fehlerTyp: task2Earned === task2Max ? 'KeinFehler' : 'Rechenfehler',
          erreichtePunkte: Math.max(0, task2Earned - t2Half),
          maximalPunkte: t2Half,
          begruendung:
            task2Earned === task2Max
              ? 'Korrekt nach x aufgelöst.'
              : 'Korrektes Vorgehen mit Folgefehler.',
        },
      });
    } else {
      // Quadratische Funktionen (Math 2)
      // StepCorrections for Task 1 (x^2 - 4 = 0)
      await prisma.stepCorrection.create({
        data: {
          taskCorrectionId: tc1.id,
          schrittIndex: 0,
          schrittText: 'x^2 = 4',
          istKorrekt: true,
          fehlerTyp: 'KeinFehler',
          erreichtePunkte: task1Max * 0.5,
          maximalPunkte: task1Max * 0.5,
          begruendung: 'Konstante korrekt auf die rechte Seite gebracht.',
        },
      });

      await prisma.stepCorrection.create({
        data: {
          taskCorrectionId: tc1.id,
          schrittIndex: 1,
          schrittText: 'x = 2 oder x = -2',
          istKorrekt: task1Earned > task1Max * 0.5,
          fehlerTyp: task1Earned === task1Max ? 'KeinFehler' : 'Rechenfehler',
          erreichtePunkte: Math.max(0, task1Earned - task1Max * 0.5),
          maximalPunkte: task1Max * 0.5,
          begruendung:
            task1Earned === task1Max
              ? 'Beide reellen Wurzeln korrekt bestimmt.'
              : 'Negative Wurzel vergessen.',
        },
      });

      // StepCorrections for Task 2 (f(x) = (x-3)^2 + 1)
      const t2Half = task2Max * 0.5;
      await prisma.stepCorrection.create({
        data: {
          taskCorrectionId: tc2.id,
          schrittIndex: 0,
          schrittText: 'x-Koordinate des Scheitelpunkts ablesen: d = 3',
          istKorrekt: true,
          fehlerTyp: 'KeinFehler',
          erreichtePunkte: t2Half,
          maximalPunkte: t2Half,
          begruendung: 'Vorzeichenregel in der Klammer richtig angewendet.',
        },
      });

      await prisma.stepCorrection.create({
        data: {
          taskCorrectionId: tc2.id,
          schrittIndex: 1,
          schrittText: 'y-Koordinate ablesen: e = 1 -> S(3, 1)',
          istKorrekt: task2Earned > t2Half,
          fehlerTyp: task2Earned === task2Max ? 'KeinFehler' : 'Rechenfehler',
          erreichtePunkte: Math.max(0, task2Earned - t2Half),
          maximalPunkte: t2Half,
          begruendung:
            task2Earned === task2Max
              ? 'Scheitelpunkt korrekt angegeben.'
              : 'Koordinaten vertauscht oder Vorzeichenfehler.',
        },
      });
    }
  }

  // 6. Populate Submissions for the 3 Students across the 2 Exams
  // Max Mustermann
  await seedSubmission({
    student: enrolledStudents[0],
    exam: exam9aMath1,
    earnedPoints: 17,
    grade: '5.3',
    strengths: ['Strukturiertes Vorgehen', 'Richtige Anwendung der Lösungsformel'],
    weaknesses: ['Flüchtigkeitsfehler in Aufgabe 1b'],
    helpfulTip: 'Achte auf das Vorzeichen bei der Termvereinfachung.',
    exerciseRecommendation: 'S. 45 Aufgabe 3-5',
  });

  await seedSubmission({
    student: enrolledStudents[0],
    exam: exam9aMath2,
    earnedPoints: 13.5,
    grade: '5.5',
    strengths: ['Hervorragendes Verständnis quadratischer Gleichungen'],
    weaknesses: [],
    helpfulTip: 'Weiter so!',
  });

  // Sarah Tobler
  await seedSubmission({
    student: enrolledStudents[1],
    exam: exam9aMath1,
    earnedPoints: 19,
    grade: '5.8',
    strengths: ['Fehlerfreie Rechnung', 'Sehr saubere Darstellung'],
    weaknesses: [],
    helpfulTip: 'Hervorragende Arbeit. Du kannst dich an Bonusaufgaben wagen.',
    exerciseRecommendation: 'S. 48 Aufgabe 10 (Zusatz)',
  });

  await seedSubmission({
    student: enrolledStudents[1],
    exam: exam9aMath2,
    earnedPoints: 15,
    grade: '6.0',
    strengths: ['Perfekte Punktzahl', 'Elegante Beweisführung'],
    weaknesses: [],
  });

  // Lukas Frischknecht
  await seedSubmission({
    student: enrolledStudents[2],
    exam: exam9aMath1,
    earnedPoints: 12,
    grade: '4.0',
    strengths: ['Gute Ansätze bei Aufgabe 1'],
    weaknesses: ['Folgefehler in Aufgabe 2 durch Rechenfehler in Zeile 2'],
    helpfulTip: 'Rechne jeden Schritt nochmals kurz im Kopf nach.',
    exerciseRecommendation: 'S. 42 Aufgabe 1-4',
  });

  // Let Lukas Frischknecht's second exam be PENDING to test grading queue workflows
  await seedSubmission({
    student: enrolledStudents[2],
    exam: exam9aMath2,
    earnedPoints: 11,
    grade: '4.7',
    status: 'PENDING',
    strengths: ['Starke Verbesserung beim Aufzeichnen von Scheitelpunkten'],
    weaknesses: ['Kleinere Rundungsfehler'],
  });

  console.log('✅ Submissions, task corrections, and step corrections successfully seeded.');
  console.log('🎉 Simplified Database Seeding finished successfully!');
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
