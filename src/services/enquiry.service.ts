import { EnquiryStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { CreateEnquiryInput } from '../schemas/enquiry.schema';
import { buildEnquiryFingerprint } from '../utils/fingerprint';
import { sanitizeOptional, sanitizeText } from '../utils/sanitize';
import { ConflictError, NotFoundError } from '../utils/errors';
import { crmSyncQueue, emailQueue, pushNotificationQueue } from '../queues';

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export class EnquiryService {
  private toPublic(enquiry: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    message: string;
    propertyRef: string | null;
    source: string;
    status: EnquiryStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: enquiry.id,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      message: enquiry.message,
      propertyRef: enquiry.propertyRef,
      source: enquiry.source,
      status: enquiry.status,
      createdAt: enquiry.createdAt.toISOString(),
      updatedAt: enquiry.updatedAt.toISOString(),
    };
  }

  async create(input: CreateEnquiryInput) {
    const name = sanitizeText(input.name);
    const email = sanitizeText(input.email).toLowerCase();
    const phone = sanitizeOptional(input.phone);
    const message = sanitizeText(input.message);
    const propertyRef = sanitizeOptional(input.propertyRef);
    const source = sanitizeText(input.source ?? 'web');
    const fingerprint = buildEnquiryFingerprint(email, propertyRef, message);

    const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const duplicate = await prisma.enquiry.findFirst({
      where: {
        fingerprint,
        createdAt: { gte: windowStart },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictError(
        'A similar enquiry was submitted recently. Please wait before resubmitting.'
      );
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        phone,
        message,
        propertyRef,
        source,
        fingerprint,
        status: 'PENDING',
      },
    });

    await Promise.all([
      crmSyncQueue.add('sync', { enquiryId: enquiry.id }, { jobId: `crm-${enquiry.id}` }),
      emailQueue.add('send', { enquiryId: enquiry.id, email }, { jobId: `email-${enquiry.id}` }),
      pushNotificationQueue.add(
        'notify',
        { enquiryId: enquiry.id, propertyRef },
        { jobId: `push-${enquiry.id}` }
      ),
    ]);

    return this.toPublic(enquiry);
  }

  async getById(id: string) {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        propertyRef: true,
        source: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!enquiry) throw new NotFoundError('Enquiry not found');
    return this.toPublic(enquiry);
  }

  async list(params: { page: number; limit: number; status?: EnquiryStatus }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.EnquiryWhereInput = params.status ? { status: params.status } : {};

    const [items, total] = await prisma.$transaction([
      prisma.enquiry.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          propertyRef: true,
          source: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.enquiry.count({ where }),
    ]);

    return {
      data: items.map((e) => this.toPublic(e)),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }
}

export const enquiryService = new EnquiryService();
