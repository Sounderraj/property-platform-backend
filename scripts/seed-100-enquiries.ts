import { PrismaClient, EnquiryStatus } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const firstNames = [
  'John', 'Jane', 'James', 'Emma', 'Oliver', 'Sophia', 'William', 'Charlotte',
  'George', 'Amelia', 'Harry', 'Isabella', 'Thomas', 'Mia', 'Jack', 'Emily',
];

const lastNames = [
  'Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans',
  'Thomas', 'Roberts', 'Johnson', 'Walker', 'Wright', 'Patel', 'Khan', 'Singh',
];

const messages = [
  'I would like to arrange a viewing for this property.',
  'Please send me more details about the price and availability.',
  'Is this property still available? I am a cash buyer.',
  'Can we schedule a virtual tour this week?',
  'Interested in making an offer. Please call me back.',
  'Looking for a family home in this area. When can I visit?',
  'What are the council tax and service charges for this listing?',
  'Please email the floor plan and EPC rating if available.',
];

const sources = ['web', 'web', 'mobile', 'partner'];
const statuses: EnquiryStatus[] = ['PENDING', 'PROCESSING', 'SYNCED', 'SYNCED', 'SYNCED'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fingerprint(email: string, propertyRef: string, message: string): string {
  const normalized = [email.toLowerCase(), propertyRef.toLowerCase(), message.slice(0, 500)].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

async function main() {
  const count = Number(process.env.COUNT ?? 100);
  const rows = Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const name = `${pick(firstNames)} ${pick(lastNames)}`;
    const email = `enquiry${pad(num)}@example.com`;
    const propertyRef = `PROP-${pad(1 + (num % 50))}`;
    const message = `${pick(messages)} (Entry #${num})`;
    const createdAt = new Date(Date.now() - num * 3600_000);

    return {
      name,
      email,
      phone: `+447${String(900000000 + num).slice(0, 9)}`,
      message,
      propertyRef,
      source: pick(sources),
      fingerprint: fingerprint(email, propertyRef, message),
      status: pick(statuses),
      createdAt,
    };
  });

  const result = await prisma.enquiry.createMany({ data: rows, skipDuplicates: true });
  console.log(`Created ${result.count} enquiries (${count} requested)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
