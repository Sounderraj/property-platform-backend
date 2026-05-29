-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "message" TEXT NOT NULL,
    "property_ref" VARCHAR(100),
    "source" VARCHAR(50) NOT NULL DEFAULT 'web',
    "status" "EnquiryStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_webhook_logs" (
    "id" TEXT NOT NULL,
    "enquiry_id" TEXT,
    "payload_hash" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "crm_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiries_email_created_at_idx" ON "enquiries"("email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "enquiries_property_ref_idx" ON "enquiries"("property_ref");

-- CreateIndex
CREATE INDEX "enquiries_fingerprint_created_at_idx" ON "enquiries"("fingerprint", "created_at" DESC);

-- CreateIndex
CREATE INDEX "enquiries_created_at_idx" ON "enquiries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_webhook_logs_payload_hash_key" ON "crm_webhook_logs"("payload_hash");

-- CreateIndex
CREATE INDEX "crm_webhook_logs_enquiry_id_idx" ON "crm_webhook_logs"("enquiry_id");

-- CreateIndex
CREATE INDEX "crm_webhook_logs_status_created_at_idx" ON "crm_webhook_logs"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "crm_webhook_logs" ADD CONSTRAINT "crm_webhook_logs_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
