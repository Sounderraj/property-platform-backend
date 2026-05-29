# API Documentation

Base URL: `http://localhost:3000` (local) or `https://your-domain.com` (production)

All successful responses include `"success": true` unless noted.

---

## Health Check

**GET** `/health`

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-29T12:00:00.000Z",
  "services": {
    "database": true,
    "redis": true
  }
}
```

---

## Create Enquiry

**POST** `/api/enquiry`

**Headers:**
- `Content-Type: application/json`
- `Idempotency-Key` (optional) — duplicate POSTs return cached 201 response

**Body:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+441234567890",
  "message": "I would like to arrange a viewing.",
  "propertyRef": "PROP-001",
  "source": "web"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Smith",
    "email": "john@example.com",
    "status": "PENDING",
    "createdAt": "2026-05-29T12:00:00.000Z"
  }
}
```

**Errors:** `400` validation, `409` duplicate, `429` rate limit

---

## Get Enquiry

**GET** `/api/enquiry/:id`

**Response 200:** Single enquiry object in `data`.

**Errors:** `404` not found

---

## List Enquiries

**GET** `/api/enquiries?page=1&limit=20&status=PENDING`

| Query | Type | Default |
|-------|------|---------|
| page | int | 1 |
| limit | int | 20 (max 100) |
| status | enum | optional |

**Response 200:**
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

---

## CRM Webhook

**POST** `/api/webhook/crm`

**Headers:**
- `Content-Type: application/json`
- `X-Webhook-Signature` — HMAC-SHA256 hex of raw body using `CRM_WEBHOOK_SECRET`

**Body:**
```json
{
  "event": "enquiry.synced",
  "enquiryId": "uuid",
  "externalId": "CRM-12345",
  "data": {}
}
```

**Events:** `enquiry.created`, `enquiry.updated`, `enquiry.synced`

**Troubleshooting `Invalid webhook signature`:**
1. The signing secret must be the **exact** `CRM_WEBHOOK_SECRET` from Render (not necessarily your local `.env`).
2. Sign the **exact bytes** sent as the request body (Postman collection does this automatically).
3. Run **Create Enquiry** first so `enquiryId` is set before **CRM Webhook**.
4. Generate a signature manually: `node scripts/generate-webhook-signature.js '{"event":"enquiry.synced","enquiryId":"..."}'`

**Response 202:**
```json
{
  "success": true,
  "data": {
    "accepted": true,
    "jobId": "1",
    "payloadHash": "abc..."
  }
}
```

---

## Properties (WordPress)

**GET** `/api/properties?first=20&refresh=false`

**GET** `/api/properties/:slug?refresh=false`

Returns cached property list from WPGraphQL (mock fallback if WP unavailable).

---

## Invalidate Cache

**POST** `/api/admin/cache/invalidate`

```json
{
  "secret": "your-cache-secret",
  "slug": "optional-property-slug"
}
```

---

## Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {}
  }
}
```
