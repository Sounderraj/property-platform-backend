/**
 * End-to-end webhook test against live or local API.
 * Usage: node scripts/test-webhook-e2e.js [baseUrl]
 */
const { createHmac } = require('crypto');
const { config } = require('dotenv');

config();

const baseUrl = process.argv[2] || 'https://property-platform-api.onrender.com';
const secret = process.env.CRM_WEBHOOK_SECRET;

if (!secret) {
  console.error('CRM_WEBHOOK_SECRET not set in .env');
  process.exit(1);
}

async function main() {
  console.log('Testing against:', baseUrl);
  console.log('Secret length:', secret.length);

  const createRes = await fetch(`${baseUrl}/api/enquiry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: 'Webhook Test',
      email: `webhook-test-${Date.now()}@example.com`,
      phone: '+441234567890',
      message: 'Testing CRM webhook signature',
      propertyRef: 'PROP-001',
      source: 'web',
    }),
  });

  const createJson = await createRes.json();
  console.log('Create enquiry:', createRes.status, JSON.stringify(createJson));

  if (!createJson.data?.id) {
    process.exit(1);
  }

  const enquiryId = createJson.data.id;
  const body = JSON.stringify({
    event: 'enquiry.synced',
    enquiryId,
    externalId: 'CRM-12345',
  });

  const signature = createHmac('sha256', secret).update(body).digest('hex');
  console.log('Body:', body);
  console.log('Signature:', signature);

  const webhookRes = await fetch(`${baseUrl}/api/webhook/crm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
  });

  const webhookJson = await webhookRes.json();
  console.log('Webhook:', webhookRes.status, JSON.stringify(webhookJson));

  if (webhookRes.status === 401) {
    console.error('\n401 = secret mismatch. Your .env CRM_WEBHOOK_SECRET must match Render dashboard exactly.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
