# EcoLith — Turning Waste Into Opportunity

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Security: AES-256-GCM](https://img.shields.io/badge/Security-AES--256--GCM-blue.svg)](#security--privacy-architecture)
[![Access Model: BYOK](<https://img.shields.io/badge/Access-BYOK%20(Gemini%20Only)-amber.svg>)](#bring-your-own-key-byok-model)
[![Deployment: Vercel](https://img.shields.io/badge/Deploy-Vercel%20Serverless-black.svg)](#vercel-deployment-guide)

**EcoLith** is an AI-powered food waste intelligence and circular resource recovery platform. It converts food residue and surplus food observations into actionable circular recovery pathways (aerated micro-composting, anaerobic biogas digestion, pectin and biopolymer extraction, bakery upcycling, and surplus redistribution) while tracking deterministic diversion analytics and estimated greenhouse gas mitigations.

---

## Table of Contents

1. [Core Architecture & Philosophy](#core-architecture--philosophy)
2. [Bring Your Own Key (BYOK) Model](#bring-your-own-key-byok-model)
3. [Security & Privacy Architecture](#security--privacy-architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure (Vercel Optimized)](#project-structure-vercel-optimized)
6. [Local Development Setup](#local-development-setup)
7. [Database Setup & Supabase Migrations](#database-setup--supabase-migrations)
8. [First Admin Bootstrap](#first-admin-bootstrap)
9. [Vercel Deployment Guide](#vercel-deployment-guide)
10. [Automated Security Testing](#automated-security-testing)

---

## Core Architecture & Philosophy

- **No Frontend Framework Overhead:** Built entirely with semantic HTML5, modern CSS3 (custom properties, responsive grid/flexbox), and vanilla ES module JavaScript. Zero client bundlers, zero framework bloat.
- **Strict Separation of AI vs. Determinism:**
  - **Gemini Handles:** Visual scrap analysis, food classification suggestions, recovery pathway reasoning, recipe upcycling ideas.
  - **Plain JavaScript Handles:** All quantity totals, unit normalizations (g, kg, piece, ml), historical comparisons, recovery rates, and environmental impact estimations. The AI is never asked to perform arithmetic.
- **Defense in Depth:** No single layer failure (stolen token, database leak, malicious client, error log) can compromise user keys or personal information.
- **Ethical AI Disclaimers:** AI output is never treated as a guarantee of food safety or edibility. Environmental metrics are clearly labeled with an **"ESTIMATED"** badge and an expandable methodology breakdown.

---

## Bring Your Own Key (BYOK) Model

EcoLith ships with **zero platform-owned AI keys**. Every user supplies their personal Google Gemini API key obtained from [Google AI Studio](https://aistudio.google.com/):

1. **Write-Only Submission:** Users submit their key exclusively through the hardened `keyvault.html` interface over HTTPS.
2. **Server-Side Verification:** The backend makes a lightweight call to Google Gemini to verify validity before persisting.
3. **AES-256-GCM Encryption at Rest:** The key is encrypted with a server-side 32-byte master secret (`KEY_ENCRYPTION_SECRET`), a fresh 12-byte initialization vector (IV) per encryption, and the user's UUID bound as **Additional Authenticated Data (AAD)**.
4. **Transient In-Memory Decryption:** The key is decrypted in memory only for the duration of a single scan request and immediately discarded.
5. **Zero Key Exposure:** The key is never returned by any endpoint, never placed in cookies or localStorage, never logged, and never accessible to platform administrators. The UI only ever displays `Key ending in ••••1234`.

---

## Security & Privacy Architecture

- **Private Database Schema:** User API keys reside in `private.user_api_keys`. The `private` schema is unexposed in the Supabase Data API, with all public, anon, and authenticated access explicitly revoked.
- **Security Definer Vault Functions:** Key reads and writes can only occur through `public.vault_*` functions with `search_path = ''`, executable exclusively by `service_role`.
- **Default-Deny Database:** All public tables (`profiles`, `food_scans`, `recovery_records`, `recovery_rules`, `audit_logs`, `api_usage_events`) have Row Level Security (RLS) enabled and forced (`FORCE ROW LEVEL SECURITY`). `anon` privileges are completely revoked.
- **Stealth Admin Endpoints:** All `/api/admin/*` endpoints return `404 Not Found` (rather than 401 or 403) to unauthorized callers, completely hiding admin endpoint existence.
- **Self-Suspension Safeguards:** System administrators cannot suspend or demote their own account, and the last remaining active admin cannot be removed.
- **Append-Only Audit Logs:** Every administrative action is automatically written to `public.audit_logs`. The audit log table permits inserts only from the backend; update and delete privileges are revoked.
- **Strict Redaction Middleware:** All outgoing logs and errors pass through `redact.js`, stripping `Authorization`, `x-goog-api-key`, `apiKey`, passwords, and image base64 payloads.

---

## Tech Stack

| Layer               | Technology                                                     |
| ------------------- | -------------------------------------------------------------- |
| **Frontend**        | Semantic HTML5, CSS3 Tokens, Vanilla JavaScript (ES Modules)   |
| **Visual Charts**   | Chart.js 4.4.7 (pinned CDN)                                    |
| **Auth & Database** | Supabase Auth (Email, Google, Microsoft) + Supabase PostgreSQL |
| **Encryption**      | Node.js `crypto` AES-256-GCM with user-ID AAD binding          |
| **Backend & API**   | Node.js Express 4 + Zod schema validation + Helmet             |
| **Serverless Host** | Vercel Serverless Functions (`api/index.js` + `vercel.json`)   |
| **AI Provider**     | Google Gemini (User BYOK via `x-goog-api-key` header)          |

---

## Project Structure (Vercel Optimized)

```
EcoLith/
├── index.html              # Landing page & value proposition
├── login.html              # Authentication (email, password, OAuth)
├── register.html           # New user registration
├── dashboard.html          # Phase 4 analytics & Chart.js visualizations
├── history.html            # Scan records history, search, filters & edits
├── scanner.html            # AI waste scanner (camera preview & upload)
├── recovery.html           # Circular recovery pathways explorer
├── keyvault.html           # Dedicated hardened BYOK Key Vault UI
├── profile.html            # User profile management & security
├── admin.html              # Role-gated administration panel
├── vercel.json             # Vercel serverless routing & security headers
├── package.json            # Root dependencies & test scripts
├── .gitignore              # Meticulous protection for secrets & artifacts
├── .env.example            # Environment variables template
├── api/
│   └── index.js            # Vercel Serverless Function entry point
├── css/
│   ├── global.css          # Design tokens, reset, typography, themes
│   ├── components.css      # Buttons, cards, badges, forms, modals, toasts
│   ├── dashboard.css       # KPI grids, charts layout, impact styling
│   ├── history.css         # Search bar, filter dropdowns, record cards
│   ├── scanner.css         # Camera viewport, retake controls
│   ├── keyvault.css        # Isolated Key Vault security styling
│   └── admin.css           # Admin KPI cards, data tables, audit viewer
├── js/
│   ├── config.js           # Public frontend configuration
│   ├── supabase.js         # Shared Supabase client instance
│   ├── auth.js             # Session guards, profile loader, sign out
│   ├── dashboard.js        # Deterministic math & Chart.js graph rendering
│   ├── history.js          # Record filtering, edit modals & pagination
│   ├── scanner.js          # getUserMedia camera flow & canvas downscaling
│   ├── recovery.js         # Circular recovery mapping & recommendation logic
│   ├── keyvault.js         # Key lifecycle: submit, test, replace, delete
│   └── admin.js            # Admin overview, user suspension & audit trail
├── backend/
│   ├── server.js           # Express API application definition
│   ├── package.json        # Backend package configuration
│   ├── .env.example        # Backend local environment template
│   ├── lib/
│   │   ├── crypto.js       # AES-256-GCM encryption with user-ID AAD
│   │   ├── gemini.js       # Server-side Gemini API client
│   │   ├── supabaseAdmin.js# Service-role database client
│   │   ├── vault.js        # Safe invocation of vault_* database functions
│   │   └── audit.js        # Append-only audit log writer
│   ├── middleware/
│   │   ├── requireAuth.js  # JWT verification & account suspension check
│   │   ├── requireAdmin.js # Admin role verification & stealth 404
│   │   ├── rateLimit.js    # Per-user rate limiting
│   │   └── redact.js       # Automatic credential scrub for logs & errors
│   ├── routes/
│   │   ├── analyze.js      # POST /api/analyze (BYOK AI scan)
│   │   ├── keys.js         # PUT/GET/DELETE /api/keys (BYOK Vault)
│   │   └── admin.js        # Role-gated admin overview, users & audit
│   └── tests/
│       ├── phase2_phase3_test.js # Schema validation & circular rules test
│       └── security_checks.js    # Section 9.4 security audit suite
└── supabase/
    └── migrations/
        ├── 20261121000001_initial_schema.sql       # Tables, RLS & Vault functions
        ├── 20261121000002_seed_recovery_rules.sql   # Seed recovery taxonomy
        └── 20261121000003_vault_admin_helpers.sql  # Safe admin status RPC
```

---

## Local Development Setup

### 1. Prerequisites

- **Node.js**: v20 or higher
- **Supabase Account**: A free project at [supabase.com](https://supabase.com)
- **Google AI Studio Key**: A free Gemini key from [aistudio.google.com](https://aistudio.google.com/)

### 2. Clone and Install Dependencies

```bash
git clone https://github.com/your-org/ecolith.git
cd ecolith
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `backend/.env`:

```bash
cp .env.example backend/.env
```

Generate a cryptographically secure 32-byte base64 encryption key:

```bash
openssl rand -base64 32
```

Edit `backend/.env`:

```env
PORT=3000
KEY_ENCRYPTION_SECRET=<paste_generated_base64_secret>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ALLOWED_ORIGIN=http://localhost:5500
DEFAULT_GEMINI_MODEL=gemini-2.5-flash
```

Update `js/config.js` with your public Supabase URL and anon key:

```js
export const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your_supabase_anon_key',
  API_BASE_URL: 'http://localhost:3000'
};
```

### 4. Run the Development Server

```bash
# Start backend API (with file watcher)
npm run dev

# In a second terminal, serve the frontend
npx serve -l 5500 .
```

Open `http://localhost:5500` in your browser.

---

## Database Setup & Supabase Migrations

In your Supabase project dashboard, navigate to the **SQL Editor** and execute the SQL migrations in order:

1. `supabase/migrations/20261121000001_initial_schema.sql` (Creates core tables, private schema, forced RLS, and security definer functions).
2. `supabase/migrations/20261121000002_seed_recovery_rules.sql` (Seeds circular economy rules for diverse food waste streams).
3. `supabase/migrations/20261121000003_vault_admin_helpers.sql` (Creates safe key status RPC for administrative monitoring).

---

## First Admin Bootstrap

EcoLith intentionally includes **no self-service admin signup** to prevent privilege escalation. To promote your initial user account to administrator:

1. Register an account through `register.html` and confirm your email.
2. In the Supabase Dashboard, open the **SQL Editor**.
3. Run the bootstrap query:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

4. Sign out and sign back in. The **Admin** navigation tab will appear in the top header, granting access to `admin.html`.

---

## Vercel Deployment Guide

Deploying EcoLith to Vercel requires zero complex build configuration.

### 1. Push to GitHub

Ensure all code is committed. (The repository's `.gitignore` guarantees that local `.env` files and credentials remain uncommitted).

### 2. Import Project into Vercel

1. Log in to [vercel.com](https://vercel.com/) and click **Add New > Project**.
2. Select your `ecolith` GitHub repository.
3. In **Framework Preset**, select **Other**.
4. Leave **Root Directory** as `./`.

### 3. Configure Environment Variables in Vercel

Add the following under **Project Settings > Environment Variables**:

| Variable                    | Value                            | Description                                |
| --------------------------- | -------------------------------- | ------------------------------------------ |
| `KEY_ENCRYPTION_SECRET`     | `<32-byte-base64>`               | Master key for AES-256-GCM BYOK encryption |
| `SUPABASE_URL`              | `https://xyz.supabase.co`        | Your Supabase project URL                  |
| `SUPABASE_ANON_KEY`         | `ey...`                          | Public Supabase anon key                   |
| `SUPABASE_SERVICE_ROLE_KEY` | `ey...`                          | Server-only service role secret            |
| `ALLOWED_ORIGIN`            | `https://your-domain.vercel.app` | Your production frontend URL               |
| `DEFAULT_GEMINI_MODEL`      | `gemini-2.5-flash`               | Default Gemini model                       |

### 4. Deploy

Click **Deploy**. Vercel will:

- Serve static HTML, CSS, JS, and assets directly from the root with configured security headers.
- Route `/api/*` requests to the serverless Express function in `api/index.js`.
- Protect all BYOK endpoints with serverless execution.

Update `js/config.js` or configure production API base URL to point to your live deployment origin.

---

## Automated Security Testing

Run the comprehensive security and schema test suites locally:

```bash
npm test
```

### Test Coverage Summary:

- **Client Secrets Leak Scan:** Scans all `.html`, `.js`, and `.css` files to ensure `service_role`, `KEY_ENCRYPTION_SECRET`, and `AIza` keys never leak to clients.
- **Cryptographic Isolation:** Verifies AES-256-GCM encryption with user ID AAD binding (User A cannot decrypt User B's ciphertext; tampered ciphertexts are rejected).
- **Canary Key Leak & Redaction Test:** Confirms that canary keys, auth tokens, and sensitive headers are scrubbed from server logs and error messages.
- **Admin Authorization & Stealth 404:** Confirms unauthenticated or non-admin requests to admin routes return `404 Not Found`.
- **Database Schema Audit:** Verifies default-deny grants and forced RLS policies across all tables.
- **Deterministic Analytics Math:** Validates pure JavaScript quantity conversions and EPA WARM / IPCC environmental impact computations.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
