import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fingerprint = 'seed-sample-fingerprint-001';
  await prisma.enquiry.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+441234567890',
      message: 'Interested in viewing this property.',
      propertyRef: 'PROP-001',
      source: 'web',
      fingerprint,
      status: 'PENDING',
    },
  });
  console.log('Seed data created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
