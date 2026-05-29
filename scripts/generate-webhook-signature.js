/**
 * Generate HMAC signature for CRM webhook testing.
 * Usage: node scripts/generate-webhook-signature.js '{"event":"enquiry.synced","enquiryId":"..."}'
 */
const { createHmac } = require('crypto');

const secret = process.env.CRM_WEBHOOK_SECRET || 'change-me-to-a-long-random-secret-in-production';
const payload = process.argv[2] || '{"event":"enquiry.synced"}';
const signature = createHmac('sha256', secret).update(payload).digest('hex');

console.log('Payload:', payload);
console.log('X-Webhook-Signature:', signature);
