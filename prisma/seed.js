const { PrismaClient } = require('../lib/generated/prisma');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Native scrypt hashing identical to lib/auth.ts
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function main() {
  console.log('🌱 Start seeding database...');

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

  console.log(`👤 Default teacher created/found: ${teacher.name} (${teacher.email})`);

  // 2. Create Default Class
  const className = 'Klasse 9b';
  const schoolClass = await prisma.class.create({
    data: {
      name: className,
      teacherId: teacher.id,
    },
  });

  console.log(`🏫 Class created: ${schoolClass.name}`);

  // 3. Create Students
  const students = [
    'Max Mustermann',
    'Sarah Tobler',
    'Lukas Frischknecht',
    'Anna Bieri',
    'David Müller',
  ];

  for (const studentName of students) {
    const student = await prisma.student.create({
      data: {
        name: studentName,
        classId: schoolClass.id,
      },
    });
    console.log(`🎓 Student enrolled: ${student.name}`);
  }

  console.log('✅ Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
