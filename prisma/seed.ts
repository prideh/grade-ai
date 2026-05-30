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

  // 3. Enroll exactly 2 Students
  const studentNames = ['Max Mustermann', 'Sarah Tobler'];
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
  await prisma.exam.create({
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
  await prisma.exam.create({
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

  // 6. Mock Submissions removed for clean, unseeded student exam states.

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
