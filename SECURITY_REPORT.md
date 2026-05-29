# Security Report

Property Platform Backend — security review and threat scenario analysis.

## Identified Vulnerabilities

### 1. Missing Webhook Signature (if secret not rotated)

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Unsigned CRM Webhook Acceptance |
| **OWASP Category** | A07:2021 – Identification and Authentication Failures |
| **Severity** | High |
| **Affected File** | `src/routes/webhook.routes.ts` |
| **Description** | If `CRM_WEBHOOK_SECRET` remains at default value, attackers can forge webhooks. |
| **Business Impact** | Fraudulent CRM events could corrupt enquiry statuses and trigger incorrect workflows. |
| **Proof of Concept** | `curl -X POST /api/webhook/crm -d '{"event":"enquiry.synced"}'` without signature when secret is weak. |
| **Recommended Fix** | Use 64+ char random secret in production; rotate periodically; reject missing/invalid HMAC. |

**Status:** Mitigated — HMAC-SHA256 verification implemented in `crm-webhook.service.ts`.

---

### 2. Enquiry Endpoint Flooding

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Enquiry Spam / Resource Exhaustion |
| **OWASP Category** | A04:2021 – Insecure Design |
| **Severity** | High |
| **Affected File** | `src/routes/enquiry.routes.ts`, `src/app.ts` |
| **Description** | Without rate limits, automated scripts can flood the platform with fake enquiries. |
| **Business Impact** | Database bloat, worker queue saturation, degraded service for legitimate users. |
| **Proof of Concept** | Loop `POST /api/enquiry` thousands of times from a script. |
| **Recommended Fix** | Per-route rate limit (10/min), global limit (60/min), fingerprint dedup, Nginx `limit_req`. |

**Status:** Mitigated — Redis-backed rate limiting + duplicate fingerprint window.

---

### 3. Verbose Error Information Disclosure

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Stack Trace / Internal Error Leakage |
| **OWASP Category** | A05:2021 – Security Misconfiguration |
| **Severity** | Medium |
| **Affected File** | `src/middleware/error-handler.ts` |
| **Description** | Unhandled errors may expose stack traces or internal paths in non-production. |
| **Business Impact** | Attackers map internals, dependency versions, and file paths for targeted exploits. |
| **Proof of Concept** | Trigger 500 error in development; observe detailed message. |
| **Recommended Fix** | Generic messages in production (`NODE_ENV=production`); log details server-side only. |

**Status:** Mitigated — production returns generic `INTERNAL_ERROR` message.

---

### 4. SQL Injection via Unvalidated Input

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Potential SQL Injection |
| **OWASP Category** | A03:2021 – Injection |
| **Severity** | Critical (if raw SQL used) |
| **Affected File** | `src/services/enquiry.service.ts` |
| **Description** | User-controlled fields passed to database without parameterisation risk injection. |
| **Business Impact** | Full database compromise, data exfiltration, authentication bypass. |
| **Proof of Concept** | `email: "'; DROP TABLE enquiries; --"` in unprotected raw query (not applicable here). |
| **Recommended Fix** | Prisma ORM with parameterised queries; Zod validation; HTML sanitisation. |

**Status:** Mitigated — Prisma parameterised queries + Zod + `sanitize-html`.

---

### 5. Weak Cache Invalidation Secret

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Unauthorized Cache Purge |
| **OWASP Category** | A01:2021 – Broken Access Control |
| **Severity** | Low |
| **Affected File** | `src/routes/property.routes.ts` |
| **Description** | Cache invalidation endpoint protected only by shared secret in body. |
| **Business Impact** | Attacker forces repeated WordPress fetches, increasing load and latency. |
| **Proof of Concept** | `POST /api/admin/cache/invalidate` with guessed secret. |
| **Recommended Fix** | Strong `CACHE_INVALIDATION_SECRET`; restrict by IP; use admin JWT in production. |

**Status:** Partially mitigated — secret required; strengthen in production.

---

## Threat Scenario Analysis

### Scenario 1: Flood platform with fake enquiries

**How the attack works:** Botnet sends thousands of `POST /api/enquiry` with varied payloads.

**Business impact:** Storage costs, CRM noise, support team overload, SLA breaches.

**Reproduce:**
```bash
for i in $(seq 1 1000); do
  curl -s -X POST http://localhost:3000/api/enquiry \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Bot$i\",\"email\":\"bot$i@test.com\",\"message\":\"spam message here!!!!\"}"
done
```

**Fix:** Rate limit 10/min on enquiry route; fingerprint dedup (5 min window); global 60/min; Nginx rate limiting; optional CAPTCHA at edge.

---

### Scenario 2: Abuse CRM webhook to inject malicious data

**How the attack works:** Attacker sends crafted JSON to `/api/webhook/crm` to inject unexpected fields or statuses.

**Business impact:** Corrupted enquiry records, false CRM sync states, compliance issues.

**Reproduce:**
```bash
curl -X POST http://localhost:3000/api/webhook/crm \
  -H "Content-Type: application/json" \
  -d '{"event":"enquiry.synced","data":{"admin":true}}'
```

**Fix:** HMAC signature required; strict Zod schema (allowlist fields); payload hash deduplication; async validation in worker.

---

### Scenario 3: Overload API with repeated requests (DoS)

**How the attack works:** High-frequency requests to list/create endpoints exhaust CPU, DB connections, Redis.

**Business impact:** API downtime, missed legitimate enquiries, reputational damage.

**Reproduce:** `ab -n 10000 -c 100 http://localhost:3000/api/enquiries`

**Fix:** Redis rate limiter; Nginx `limit_req`; PM2 cluster; connection pooling; body size limit (1MB); health-based autoscaling.

---

### Scenario 4: Retrieve sensitive server info from API errors

**How the attack works:** Trigger errors to leak stack traces, env vars, or SQL errors in JSON responses.

**Business impact:** Exposure of secrets paths, DB hostnames, aiding further attacks.

**Reproduce:** Send malformed UUID to `GET /api/enquiry/not-a-uuid` — should return validation error only, not stack.

**Fix:** Central error handler; `NODE_ENV=production`; never echo `process.env`; Pino logs server-side.

---

### Scenario 5: Inject malicious payloads into database (XSS/stored injection)

**How the attack works:** Submit `<script>alert(1)</script>` or SQL fragments in enquiry fields.

**Business impact:** Stored XSS when data rendered in admin UI; injection if ORM misused.

**Reproduce:**
```bash
curl -X POST http://localhost:3000/api/enquiry \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","email":"x@y.com","message":"test message!!!!!!!!!!"}'
```

**Fix:** `sanitize-html` strips tags; Zod length limits; Prisma parameterised queries; encode on frontend display.

---

## Security Checklist (Production)

- [ ] Rotate all secrets from `.env.example` defaults
- [ ] `NODE_ENV=production`
- [ ] HTTPS only (HSTS header in Nginx)
- [ ] Non-root `deploy` user
- [ ] UFW firewall enabled
- [ ] Postgres/Redis not exposed publicly
- [ ] Regular dependency updates (`npm audit`)
