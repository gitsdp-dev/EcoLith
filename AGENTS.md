# EcoLith — Antigravity Agent Context

> Place this file at the project root as `AGENTS.md` (or `GEMINI.md` / `.agent/rules/ecolith.md`) so Antigravity loads it for every task. Work phase by phase; do not skip ahead.

---

## 1. Role

You are a senior full-stack web developer building **EcoLith**, an AI-powered food waste intelligence and circular resource management platform. Write production-quality code: readable, secure, accessible, mobile-first, and well-commented where logic is non-obvious. Prefer simple, dependable solutions over clever ones.

**Product tagline:** *EcoLith — Turning Waste Into Opportunity.*

**Core concept:** Convert food waste information into actionable resource-recovery opportunities. EcoLith does not physically convert waste. It identifies suitable recovery pathways and helps users track outcomes.

**Access model: BYOK (Bring Your Own Key), Gemini only.** EcoLith ships with **no platform-owned AI key**. Every user supplies their own Google Gemini API key, and all AI scans run on that key. No other AI provider is supported, and the UI must not offer one.

**Operations:** EcoLith includes a secured **Admin Panel** for user management, recovery-rule management, system settings, usage monitoring, and audit logging. Admins never see users' API keys or photos.

---

## 2. Non-Negotiable Rules

1. **No frontend frameworks.** Frontend is HTML5, CSS3, and vanilla JavaScript (ES modules) only. No React, Vue, Tailwind, jQuery, or bundlers.
2. **Approved libraries only:** Supabase JS client, Chart.js, Lucide Icons (all via pinned CDN versions or local copies).
3. **Never expose server secrets in browser code.** The Supabase service-role key, the key-encryption secret, and OAuth client secrets live only in server-side environment variables. The browser may only hold the Supabase **URL** and **anon key**. There is no platform Gemini key anywhere in the system.
4. **Never commit `.env`.** Create `.gitignore` first (`.env`, `node_modules/`, `.DS_Store`) and provide `backend/.env.example` with placeholder values.
5. **Row Level Security on every user-owned table.** No table is "done" until RLS is enabled, policies are written, and isolation is tested with two accounts.
6. **Passwords are never stored in application tables.** Supabase Auth owns all credentials.
7. **Gemini output is untrusted input.** Validate every response against a schema on the backend before it reaches the client or database.
8. **AI is not proof of food safety.** Never present AI output as a safety guarantee. Show a visible disclaimer wherever edibility or redistribution is mentioned.
9. **Estimates must be labeled as estimates.** Any environmental impact figure must show its assumptions and be visibly distinguished from measured data.
10. **Mobile-first.** Design at 360px width first, then scale up. Test camera flow on Android Chrome.
11. **Photos are not retained by default.** Images are processed in memory and discarded unless the user explicitly opts to save one.
12. **Camera permission is requested only when the user taps the scan button**, never on page load.
13. **BYOK, Gemini only.** Each user's Gemini key is **write-only** from the client: it can be submitted, replaced, or deleted, but never read back. The UI only ever shows a masked form (last 4 characters).
14. **User keys are encrypted at rest** (AES-256-GCM, server-side, see section 9.1), are decrypted only in memory for the duration of a single request, and are **never logged, never returned, never placed in URLs, and never captured by error reporters**.
15. **No key, no scan.** If a user has no valid key, the scanner is disabled and an onboarding card explains how to add one. Never fall back to any shared key.
16. **Admin authorization is enforced server-side** (backend middleware plus database rules). Client-side admin checks are cosmetic only.
17. **Admins can never view user API keys, decrypted or otherwise, or user photos.** Admin actions that change data are written to an append-only audit log.
18. **Database is default-deny.** RLS enabled and forced on every table, all `anon` privileges revoked, and the key table lives in a non-exposed `private` schema reachable only through backend-only database functions (section 9.4).
19. **Collect the minimum personal data.** Only email, display name, and avatar URL. No phone, address, or photo retention by default. Never persist raw AI responses beyond the fields the user confirmed.
20. **The Key Vault page is hardened and isolated:** zero third-party scripts, strict CSP, no caching, and no key material ever stored in the browser (section 9.3).
21. **Never claim the system is "unhackable" or "100% secure"** in code comments, UI copy, or docs. Describe the protections honestly.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES modules) |
| AI image analysis | Gemini API via **user-supplied keys (BYOK, Gemini only)**, called server-side |
| Backend API | Node.js + Express (or serverless functions) |
| Auth | Supabase Auth (email/password, Google, Microsoft/Azure) |
| Database | Supabase PostgreSQL with RLS |
| Optional storage | Supabase Storage (opt-in photos only) |
| Key encryption | Node `crypto` AES-256-GCM, master secret from env |
| Admin panel | `admin.html` + `/api/admin/*` routes (service-role, role-checked) |
| Charts | Chart.js |
| Icons | Lucide |
| Hosting | Netlify or Vercel (frontend), serverless or Node host (backend) |

---

## 4. Project Structure

```
EcoLith/
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── scanner.html
├── history.html
├── recovery.html
├── profile.html
├── keyvault.html          # Dedicated Key Vault UI (BYOK): add, test, replace, delete Gemini key
├── settings.html          # General preferences only (no key handling)
├── admin.html             # Admin panel (role-gated)
├── assets/{icons,images,logo}/
├── css/
│   ├── global.css        # tokens, reset, typography, layout
│   ├── components.css    # buttons, cards, modals, toasts, forms
│   ├── auth.css
│   ├── dashboard.css
│   ├── scanner.css
│   ├── keyvault.css
│   └── admin.css
├── js/
│   ├── config.js         # public config only (Supabase URL + anon key, API base URL)
│   ├── supabase.js       # single shared Supabase client
│   ├── auth.js
│   ├── scanner.js
│   ├── gemini.js         # frontend wrapper that calls OUR backend, never Gemini directly
│   ├── keyvault.js         # BYOK UI logic: submit, status, replace, delete (write-only)
│   ├── admin.js          # admin panel logic (talks to /api/admin/*)
│   ├── recovery.js
│   ├── dashboard.js
│   └── history.js
└── backend/
    ├── server.js
    ├── .env              # never committed
    ├── .env.example
    ├── package.json
    ├── lib/
    │   ├── crypto.js     # AES-256-GCM encrypt/decrypt for user keys
    │   ├── gemini.js     # server-side Gemini client (key passed per request)
    │   ├── supabaseAdmin.js  # service-role client (server only)
    │   ├── vault.js          # ONLY module allowed to call the vault_* database functions
    │   └── audit.js      # audit log writer
    ├── middleware/
    │   ├── requireAuth.js    # verifies Supabase JWT, checks account not suspended
    │   ├── requireAdmin.js   # requireAuth + role=admin (+ MFA aal2) check
    │   ├── rateLimit.js
    │   └── redact.js         # strips keys/images from logs and errors
    └── routes/
        ├── analyze.js
        ├── keys.js       # BYOK endpoints
        ├── config.js     # public app settings (maintenance mode, limits)
        └── admin.js      # admin endpoints
```

Keep to this structure. Add files only when they clearly earn their place, and tell me why.

---

## 5. Architecture and Data Flow

1. User opens EcoLith and authenticates through Supabase.
2. **One-time setup (BYOK):** the user adds their own Gemini key in `keyvault.html`. The backend validates it with Google, encrypts it, and stores it. Until this is done, the scanner is locked.
3. User opens the scanner and taps **Scan**; camera permission is requested. Frontend captures an image, downsizes it client-side (max ~1024px long edge, JPEG ~0.8), and sends it with the user's access token to `POST /api/analyze`.
4. Backend verifies the Supabase JWT, checks the account is active and not in maintenance mode, rate-limits, validates the image, **decrypts that user's key in memory**, and calls Gemini with it.
5. Gemini returns structured JSON. Backend validates it against the schema and returns it.
6. User reviews, **edits or corrects**, enters quantity and unit, and confirms.
7. Frontend saves `food_scans` and `recovery_records` rows to Supabase (RLS enforces ownership).
8. Dashboard computes metrics deterministically from stored records.

---

## 6. Database (Supabase PostgreSQL)

Create via SQL migrations in `/supabase/migrations/` so the schema is reproducible.

```sql
-- profiles: mirrors auth.users, no credentials
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Users may edit only their own display fields; role/status are never client-writable.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create table public.food_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  food_category text not null,
  waste_category text not null check (waste_category in
    ('edible_reusable','surplus_redistributable','unavoidable_organic','other_separate')),
  quantity numeric not null check (quantity > 0),
  quantity_unit text not null check (quantity_unit in ('g','kg','piece','ml','l')),
  ai_confidence numeric check (ai_confidence between 0 and 1),
  user_corrected boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recovery_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid not null references public.food_scans(id) on delete cascade,
  recovery_method text not null check (recovery_method in
    ('reuse','redistribution','composting','biogas','pectin_recovery','material_recovery','separate_disposal')),
  recommendation_reason text,
  estimated_resource_value text,
  status text not null default 'suggested' check (status in
    ('suggested','planned','completed','dismissed')),
  created_at timestamptz not null default now()
);

-- optional
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_units text default 'kg',
  preferred_language text default 'en',
  notification_preferences jsonb default '{}'::jsonb
);

create index on public.food_scans (user_id, created_at desc);
create index on public.recovery_records (user_id, created_at desc);
```

**BYOK and admin tables**

```sql
-- Encrypted user Gemini keys live in a PRIVATE schema that is NOT exposed through the Supabase Data API.
-- Never add `private` to the exposed schemas list. Access is only through the vault_* functions (section 9.4).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.user_api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'gemini' check (provider = 'gemini'),
  ciphertext text not null,        -- base64
  iv text not null,                -- base64, unique random 12 bytes per encryption
  auth_tag text not null,          -- base64
  key_version int not null default 1,   -- supports master-secret rotation
  key_last4 text not null,
  status text not null default 'valid' check (status in ('valid','invalid','rate_limited')),
  validated_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.user_api_keys enable row level security;   -- intentionally no policies
alter table private.user_api_keys force row level security;
revoke all on private.user_api_keys from public, anon, authenticated;

-- Admin-editable recovery rules that drive recovery.js and the Gemini prompt context.
create table public.recovery_rules (
  id uuid primary key default gen_random_uuid(),
  material_pattern text not null,     -- e.g. 'citrus peel'
  waste_category text not null,
  recovery_method text not null,
  requirements text,                  -- contamination / facility conditions shown to users
  explanation text,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.recovery_rules enable row level security;
create policy "authenticated read active rules" on public.recovery_rules
  for select to authenticated using (is_active);   -- writes only via backend (service role)

-- Global settings (maintenance mode, limits, allowed models, banner, disclaimers). Backend only.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;  -- no client policies

-- Append-only audit log of admin actions. Backend inserts only; no update/delete anywhere.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,               -- e.g. 'user.suspend', 'rule.update', 'settings.update'
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,   -- never contains keys, images, or user content
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;  -- no client policies

-- Usage events for admin monitoring. No payloads, no images, no keys.
create table public.api_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,           -- 'analyze', 'key_validate'
  status text not null,               -- 'ok', 'invalid_key', 'quota', 'error'
  latency_ms int,
  created_at timestamptz not null default now()
);
alter table public.api_usage_events enable row level security;  -- no client policies
create index on public.api_usage_events (created_at desc);
```

Admin features never query these tables from the browser. They go through `/api/admin/*`, which uses the service-role client **after** `requireAdmin` passes. First admin is bootstrapped manually in the Supabase SQL editor (`update public.profiles set role='admin' where email='...'`); there is no self-service path to admin.

**RLS (apply to every table, shown for `food_scans`):**

```sql
alter table public.food_scans enable row level security;

create policy "own rows select" on public.food_scans
  for select using (auth.uid() = user_id);
create policy "own rows insert" on public.food_scans
  for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.food_scans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on public.food_scans
  for delete using (auth.uid() = user_id);
```

`profiles` uses `auth.uid() = id`. Add a trigger on `auth.users` insert to auto-create the profile row (pull name and avatar from OAuth metadata when available).

---

## 7. Backend API Contract

**`POST /api/analyze`**
- Headers: `Authorization: Bearer <supabase_access_token>`
- Body: `{ "image": "<base64 jpeg>", "mimeType": "image/jpeg" }` (no key in the request; the backend uses the caller's stored key)
- Backend must: verify JWT, reject suspended accounts and honor maintenance mode, enforce size limit (~4 MB, admin-configurable), allow only `image/jpeg|png|webp`, apply per-user rate limiting, load and decrypt the **caller's** Gemini key in memory, call Gemini with the key in the `x-goog-api-key` header (never in the URL), set CORS to the exact frontend origin, use `helmet`, and never log image data or keys.
- If the user has no key: return `409 { "code": "NO_API_KEY" }`. If Gemini rejects the key: mark it `invalid` and return `401 { "code": "API_KEY_INVALID" }`. On quota or rate limit: mark `rate_limited` and return `429 { "code": "QUOTA_EXCEEDED" }`. The frontend maps these codes to friendly messages with a link to `keyvault.html`.

**BYOK endpoints** (all require a valid user JWT)

| Endpoint | Purpose |
|---|---|
| `PUT /api/keys` body `{ "apiKey": "..." }` | Validate the key against Gemini (lightweight models-list call), encrypt, upsert. Returns only `{ hasKey, last4, status, validatedAt }`. |
| `GET /api/keys/status` | Returns `{ hasKey, last4, status, validatedAt }`. Never the key or ciphertext. |
| `POST /api/keys/revalidate` | Re-checks the stored key and updates status. |
| `DELETE /api/keys` | Permanently deletes the stored key. |

**Admin endpoints** (all behind `requireAdmin`; each mutation writes to `audit_logs`)

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/overview` | Aggregate KPIs and chart series |
| `GET /api/admin/users` | Paginated, searchable, filterable user list (key *status* only, never the key) |
| `PATCH /api/admin/users/:id` | Change role or suspend/reactivate (uses Supabase admin API to ban or unban) |
| `POST /api/admin/users/:id/revoke-sessions` | Force sign-out |
| `DELETE /api/admin/users/:id` | Delete account and cascade data (typed confirmation required) |
| `GET/POST/PATCH/DELETE /api/admin/recovery-rules` | Manage recovery rules |
| `GET/PUT /api/admin/settings` | Read and update app settings |
| `GET /api/admin/audit-logs` | Read-only, filterable audit trail |
| `GET /api/admin/health` | Backend, Supabase, and Gemini-error-rate summary |
| `POST /api/admin/security/purge-keys` | **Emergency kill switch:** deletes every stored user key (typed confirmation, MFA, audit-logged). Users are prompted to re-enter keys. |

`GET /api/config` (public to authenticated users) returns only non-sensitive settings: maintenance flag, announcement banner, size limit, disclaimer text.

**Gemini prompt requirements:** instruct the model to return JSON only, to state uncertainty honestly, to never claim food is safe to eat, and to account for contamination and facility availability. Use Gemini's structured output / response schema where available.

**Validated response shape:**

```json
{
  "items": [
    {
      "food_name": "Orange peel",
      "food_category": "fruit",
      "waste_category": "unavoidable_organic",
      "confidence": 0.86,
      "recovery_options": [
        {
          "method": "composting",
          "reason": "Suitable plant-based residue; chop for faster breakdown.",
          "requirements": "Avoid if mixed with oil, meat, or plastic."
        },
        {
          "method": "pectin_recovery",
          "reason": "Citrus peel is a pectin source.",
          "requirements": "Needs a specialized processing facility."
        }
      ],
      "reuse_suggestions": ["Zest for baking", "Infuse in vinegar for cleaning"]
    }
  ],
  "notes": "Contamination cannot be assessed from a photo."
}
```

Reject and retry once (or return a friendly error) if validation fails. Use a schema validator such as `zod` or `ajv`.

**Error handling:** distinct, user-friendly messages for Gemini unavailable, quota exceeded, invalid image, expired session, and Supabase unreachable. Never leak stack traces.

---

## 8. AI vs. Deterministic Logic

| Gemini handles | Plain JavaScript handles |
|---|---|
| Image understanding | Quantity totals |
| Food and waste classification suggestions | Historical comparisons |
| Recovery recommendations | Waste reduction statistics |
| Recipe and reuse ideas | Recovery record counts |
| Natural-language explanations | All dashboard analytics |

Never ask the model to do arithmetic for the dashboard.

---

## 9. Authentication Requirements

- Email + password registration and login, with email confirmation enabled.
- Google OAuth 2.0 and Microsoft (Azure) OAuth through Supabase providers.
- Forgot password and reset flow (`resetPasswordForEmail` plus an update-password page).
- Persistent sessions, secure logout, and an auth guard on all protected pages (redirect to `login.html` if there is no session, and listen to `onAuthStateChange`).
- Profile page: edit display name, show avatar synced from provider metadata when present.
- OAuth redirect and callback URLs explicitly allow-listed in Supabase for local, staging, and production.
- All methods resolve to the same Supabase user identity; handle the case of one email using multiple providers gracefully.

### 9.1 BYOK: Bring Your Own Gemini Key

**Scope:** Gemini API keys only. No other provider, no shared platform key, no free-credit pool.

**Key lifecycle**
1. **Add:** user pastes a key in `keyvault.html` (password-type input, `autocomplete="off"`, `spellcheck="false"`). A soft client-side format hint is fine (Gemini keys usually begin with `AIza`) but it is never the real check.
2. **Validate:** backend makes a lightweight authenticated call to Gemini (e.g. list models) using the key in the `x-goog-api-key` header. Only a successful response is accepted.
3. **Encrypt:** AES-256-GCM using Node `crypto`, a 32-byte master secret from `KEY_ENCRYPTION_SECRET`, a fresh random 12-byte IV per encryption, and the **user's ID as additional authenticated data (AAD)** so a ciphertext cannot be moved to another user's row. Store `ciphertext`, `iv`, `auth_tag`, `key_version`, and `key_last4`.
4. **Use:** on each scan, decrypt in memory, call Gemini, discard. Never cache decrypted keys beyond the request.
5. **Display:** only `Key ending in ••••1234`, status (valid, invalid, rate limited), and last validated time.
6. **Replace or delete:** user can replace the key or delete it permanently at any time. Deleting the account cascades the key row.
7. **Rotate master secret:** support `key_version` so keys can be re-encrypted under a new master secret without user action.

**Hard requirements**
- The key is never returned by any endpoint, never written to logs, never included in error messages, analytics, or admin views, and never sent from the browser to anything except `PUT /api/keys` over HTTPS.
- `redact.js` middleware scrubs `x-goog-api-key`, `apiKey`, and `Authorization` from logs and error reports.
- Use Gemini's structured-output mode with the user's key exactly as with any key; validate responses identically.
- Handle invalid, revoked, quota-exceeded, and billing-disabled keys with clear, non-technical messages and a fix path (re-enter the key, check Google AI Studio).
- Keep per-user rate limiting on `/api/analyze` regardless of key. It protects the user's quota and our server.
- Images are sent to Google under the user's own account and terms. Show a short plain-language notice on the key screen: costs and usage are billed or limited by the user's own Google account, images are sent to Google for analysis, and EcoLith does not keep photos unless the user opts in. Link to Google AI Studio for creating a key and suggest the user set their own quota limits.

**Onboarding UX:** after sign-up, show a 3-step card (create key in Google AI Studio, paste it, test it). Scanner page shows a locked state with a button to `keyvault.html` whenever `hasKey` is false or status is `invalid`.

### 9.2 Admin Panel

**Access control**
- Role stored in `profiles.role` (`user` | `admin`), not client-writable (column grants above).
- `requireAdmin` middleware: verify JWT, load profile with the service-role client, require `role = 'admin'` and `status = 'active'`, and require **MFA (Supabase TOTP, `aal2`)** for admin sessions. Return `404` to non-admins on admin routes to avoid revealing their existence.
- `admin.html` includes a client-side guard for UX only. Real enforcement lives in the backend.
- Safeguards: an admin cannot demote, suspend, or delete themselves, and the last remaining admin can never be removed.

**Panel sections**
1. **Overview:** total users, new users (7 and 30 days), active scanners, total scans, recovery records by method and status, **BYOK adoption** (users with a valid key vs. without), Gemini error rates by type (invalid key, quota, other), waste-category distribution. Aggregates only, rendered with Chart.js.
2. **Users:** searchable, filterable table (email, name, role, status, key status badge, scan count, last seen, joined). Actions: suspend or reactivate, promote or demote, force sign-out, delete account (typed confirmation). Admins see key **status only**, never key material, and do not browse individual scan photos or contents.
3. **Recovery rules:** CRUD for `recovery_rules` (material pattern, waste category, method, requirements, explanation, active toggle). Changes take effect in `recovery.js` and in the context passed to Gemini. Show a preview and require confirmation on delete.
4. **System settings:** maintenance mode, announcement banner, per-user rate limit, max image size, default Gemini model and allowed-model list, disclaimer text. Validate every value server-side and bound it to safe ranges.
5. **Audit log:** read-only, filterable by actor, action, and date. Every admin mutation records who, what, target, and non-sensitive metadata.
6. **System health:** backend status, Supabase connectivity, recent error counts (no payloads).
7. **Security:** suspicious-activity summary (failed-login spikes, repeated invalid-key attempts, admin actions) and the emergency **purge all stored keys** action for incident response.

**Privacy boundaries for admins:** no access to decrypted keys, ciphertext, photos, or full per-user scan content by default. Analytics are aggregated. Any future "view user data" feature must be explicit, justified, and audit-logged.

**Admin UX:** same design system as the main app, desktop-first but usable on tablet, data tables with pagination and empty/loading/error states, destructive actions behind confirmation dialogs, and clear success and failure toasts.

### 9.3 Key Vault UI (separate, dedicated build)

A standalone page, **`keyvault.html` + `css/keyvault.css` + `js/keyvault.js`**, used for nothing except managing the user's Gemini key. It is built and tested independently of the rest of the app (Phase 1B) and is the only place in the product where a key is ever typed.

**Screens and states**
1. **Empty (no key):** explanation of BYOK, a 3-step guide (open Google AI Studio, create a key, paste it here), and the add form.
2. **Validating:** the submit button shows progress and is disabled to prevent double submits; inputs are locked.
3. **Active:** shows `Gemini key ending in ••••1234`, status badge (Valid), last validated and last used times, and actions: **Test key**, **Replace**, **Delete**. The key itself is never shown again.
4. **Invalid or revoked:** clear explanation, link to fix, and Replace button.
5. **Rate limited or quota exceeded:** explains it is the user's own Google quota and what to do.
6. **Delete confirmation:** modal explaining that scanning stops until a new key is added; requires explicit confirmation.
7. **"What we store" panel:** plain-language summary: encrypted at rest, never shown back, never visible to admins, deletable any time, images go to Google under the user's account.

**Input handling rules**
- `<input type="password" autocomplete="off" spellcheck="false" autocapitalize="off" data-lpignore="true" data-1p-ignore>` with a show/hide toggle that only reveals what the user just typed and **auto re-masks after 10 seconds**.
- Never use a `<form>` that can submit via GET or a URL; submit with `fetch` `PUT` and a JSON body over HTTPS only.
- On submit, **immediately clear the input and any JavaScript variable holding the key**, whether the request succeeds or fails. Also clear on `visibilitychange` (tab hidden), on `pagehide`, and after 2 minutes of inactivity.
- The key is **never** written to `localStorage`, `sessionStorage`, `IndexedDB`, cookies, URL, DOM attributes, `console`, error messages, or analytics events. No copy-to-clipboard of any key, and no "reveal saved key" feature, ever.
- **Step-up re-authentication** before add, replace, or delete: require a login within the last 5 minutes, otherwise re-verify via password, OAuth re-login, or MFA code.
- Generic error messages (no hints that reveal whether a key exists in Google's systems beyond valid or invalid).
- Rate-limit client and server (for example 5 validation attempts per hour per user) with a visible cooldown message.

**Page hardening**
- Strict CSP on this page: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' <backend origin> <supabase origin>; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. No inline scripts or styles.
- **No third-party scripts.** The Supabase client (and any icon assets) are self-hosted pinned copies on this page. If CDN scripts are used elsewhere in the app, they must use Subresource Integrity (SRI) and pinned versions.
- Response headers for the page and its API calls: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` with camera disabled on this page.
- All dynamic text is rendered with `textContent` only.
- Accessible (labels, `aria-live` for status changes, focus management in modals) and fully usable at 360px.

### 9.4 Database and Data Security Hardening

**Honest goal:** no system can be guaranteed unhackable. The design target is **defense in depth**: a failure in any one layer (stolen token, SQL bug, database dump, leaked log) must not expose API keys or personal information. Build and verify every layer below.

**Threat model to design against**
| Threat | Primary defenses |
|---|---|
| Attacker reads the database or a backup | Keys are AES-256-GCM ciphertext, master secret is **not in the database**; minimal PII stored |
| Stolen anon key or logged-in user probing other users | Default-deny RLS, forced RLS, ID checks on every query, private schema |
| SQL injection | Parameterized queries or Supabase client only, schema validation, least-privilege roles |
| Stolen session token or XSS | Short-lived JWTs, strict CSP, `textContent` rendering, step-up auth for key actions |
| Malicious insider or compromised admin | Admins cannot decrypt keys, audit log, MFA, least privilege |
| Compromised backend host | Secrets in host secret store, KMS option, per-environment secrets, key purge kill switch |
| Leaky logs and error reporters | `redact.js`, no payload logging, canary tests |
| Supply chain (npm and CDN) | Lockfile, pinned versions, SRI, minimal dependencies, audit in CI |

**1. Default-deny database (apply in migrations)**
```sql
-- Nothing is reachable by anon, and authenticated gets only what policies and grants allow.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Every table: RLS on AND forced (applies even to the table owner).
alter table public.profiles          enable row level security; alter table public.profiles          force row level security;
alter table public.food_scans        enable row level security; alter table public.food_scans        force row level security;
alter table public.recovery_records  enable row level security; alter table public.recovery_records  force row level security;
alter table public.user_preferences  enable row level security; alter table public.user_preferences  force row level security;
-- (then explicit grants + owner-only policies for authenticated, as in section 6)
```
Run the Supabase **Security Advisor** and fix every finding. Every new table in `public` must ship with RLS, policies, and tests in the same migration.

**2. Vault functions (the only path to stored keys)**
```sql
create or replace function public.vault_put_key(
  p_user uuid, p_ct text, p_iv text, p_tag text, p_ver int, p_last4 text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.user_api_keys
    (user_id, ciphertext, iv, auth_tag, key_version, key_last4, status, validated_at, updated_at)
  values (p_user, p_ct, p_iv, p_tag, p_ver, p_last4, 'valid', now(), now())
  on conflict (user_id) do update set
    ciphertext = excluded.ciphertext, iv = excluded.iv, auth_tag = excluded.auth_tag,
    key_version = excluded.key_version, key_last4 = excluded.key_last4,
    status = 'valid', validated_at = now(), last_error_code = null, updated_at = now();
end $$;

create or replace function public.vault_get_key(p_user uuid)
returns table (ciphertext text, iv text, auth_tag text, key_version int, status text)
language sql security definer set search_path = '' as $$
  select ciphertext, iv, auth_tag, key_version, status
  from private.user_api_keys where user_id = p_user;
$$;

create or replace function public.vault_delete_key(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from private.user_api_keys where user_id = p_user;
$$;

-- Add vault_get_status (last4, status, validated_at only) and vault_set_status the same way.

-- CRITICAL: only the backend (service_role) may execute these. Never anon or authenticated.
revoke all on function public.vault_put_key(uuid,text,text,text,int,text)    from public, anon, authenticated;
revoke all on function public.vault_get_key(uuid)                             from public, anon, authenticated;
revoke all on function public.vault_delete_key(uuid)                          from public, anon, authenticated;
grant execute on function public.vault_put_key(uuid,text,text,text,int,text)  to service_role;
grant execute on function public.vault_get_key(uuid)                          to service_role;
grant execute on function public.vault_delete_key(uuid)                       to service_role;
```
The backend derives `p_user` **only from the verified JWT**, never from the request body or URL. All `security definer` functions must set `search_path = ''` and use fully qualified names.

**3. Encryption architecture**
- Minimum: AES-256-GCM with per-record random IV and user-ID AAD (section 9.1); master secret in the hosting platform's secret store, never in the database, repo, or client.
- Recommended for production: **envelope encryption with a cloud KMS** (a per-user data key wrapped by a KMS key). A database dump plus a host-environment leak still cannot decrypt without KMS access, and KMS access can be revoked and audited.
- Support `key_version` rotation, plus a documented, tested rotation procedure.

**4. Backend and API hardening**
- Use only parameterized queries or the Supabase client. Never build SQL with string concatenation.
- Validate every request body, query, and param with a strict schema (`zod` or `ajv`) and reject unknown fields.
- Return explicit response objects (DTOs). Never `select *` into a response and never return raw database rows.
- Authorization on every object: derive identity from the verified JWT, scope every query by that `user_id`, never trust IDs from the client (prevents IDOR).
- Run the backend with a least-privilege configuration. The service-role client is imported only by `supabaseAdmin.js`, `vault.js`, and admin routes. Add a lint rule or CI grep that fails the build if it appears anywhere else.
- Generic auth and key errors to prevent account enumeration and oracle behavior. Rate-limit `/api/keys*`, auth, and password reset aggressively.
- `helmet`, exact-origin CORS, body size limits, request timeouts, and no stack traces in responses.

**5. Authentication and session hardening (Supabase Auth)**
- Email confirmation on, **leaked-password protection** on, strong password policy, CAPTCHA (e.g. Cloudflare Turnstile or hCaptcha) on sign-up, login, and reset.
- Short JWT expiry (about 1 hour), refresh-token rotation with reuse detection, and explicit session timeouts.
- Optional MFA for all users (TOTP), mandatory for admins.
- Strict redirect URL allow-list; separate OAuth apps for dev, staging, and production.
- Step-up re-auth for sensitive actions (key add, replace, delete, email change, account deletion).

**6. Browser-side protections (whole app)**
- Strict CSP, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, and a `Permissions-Policy` that allows the camera only on the scanner page.
- `textContent` or sanitized rendering for all user and AI text; no inline event handlers; Trusted Types where supported.
- Pinned versions plus SRI for any CDN script; prefer self-hosting.

**7. Personal data minimization and lifecycle**
- Store only: email, display name, avatar URL, and the user's own scan records. No public profiles; no user enumeration.
- Photos are never retained by default. If the user opts in, use a **private** Storage bucket with owner-scoped policies on `storage.objects` and short-lived signed URLs only.
- Do not persist raw Gemini responses; store only the fields the user confirmed.
- Account deletion cascades everything (profile, scans, recovery records, preferences, stored key, storage objects). Provide data export.
- Define log and usage-event retention (for example 90 days) and purge on schedule.

**8. Infrastructure and operations**
- Separate Supabase projects for dev, staging, and production. **No production data in dev.** Different secrets per environment.
- Enforce SSL for database connections, restrict database network access where available, and disable direct database access except from allow-listed IPs.
- MFA on the Supabase, hosting, GitHub, and Google accounts used to run the project. Least-privilege team access.
- Secrets live only in the host's secret manager. Add `gitleaks` (pre-commit and CI) and GitHub secret scanning. Rotate secrets on a schedule and immediately after any suspected exposure.
- Enable point-in-time recovery and verify that backups restore; backups remain encrypted.
- `npm audit`, Dependabot or Renovate, lockfile committed, minimal dependency list.

**9. Logging, monitoring, and incident response**
- `redact.js` removes keys, tokens, images, and emails from all logs and error reports. No request-body logging on `/api/keys` or `/api/analyze`.
- Alert on: spikes in failed logins, repeated invalid-key attempts, many password resets, unusual admin actions, and RLS or permission errors.
- **Incident runbook** (write `SECURITY.md`): rotate `KEY_ENCRYPTION_SECRET` or KMS key, run the admin **purge-keys** action, force sign-out of all sessions, notify affected users to rotate their Gemini keys in Google AI Studio, and review the audit log.

**10. Security verification (must pass before launch)**
- Automated two-account tests (SQL or script based): user A cannot read, insert, update, or delete user B's rows in any table; `anon` can read nothing; a user cannot change their own `role` or `status`.
- Confirm `private.user_api_keys` and the `vault_*` functions are **unreachable** through the REST API with the anon key and with a user JWT.
- **Canary test:** submit a recognizable fake key, then search logs, API responses, error output, the database (plaintext), admin endpoints, and network traces; the plaintext must appear nowhere except the single `PUT /api/keys` request.
- Grep the built frontend for `service_role`, `KEY_ENCRYPTION_SECRET`, and any `AIza` pattern; none may appear.
- Run OWASP ZAP (or similar) against a staging deployment, a CSP evaluator on every page, and a header scan.
- Penetration-style checks: IDOR attempts, JWT tampering, expired and suspended-user tokens, oversized and malformed payloads, rate-limit bypass attempts.
- Record results in `SECURITY_TESTING.md`.

---

## 10. Design and UX Standards

- Clean, calm, eco-oriented visual identity: define design tokens (color, spacing, radius, type scale, shadows) as CSS custom properties in `global.css`, with a consistent component library in `components.css`.
- Support light and dark via `prefers-color-scheme`.
- Accessible by default: semantic HTML, labels on all inputs, visible focus states, WCAG AA contrast, `aria-live` for scan results and toasts, touch targets of at least 44px.
- Loading skeletons, empty states, and error states for every data-driven view.
- Respect `prefers-reduced-motion`.
- Scanner UX: live camera preview, capture button, retake, file-upload fallback for devices without camera access, clear permission-denied guidance.
- Confirmation screen: every AI field is editable; track `user_corrected` when the user changes the AI's answer.
- Key Vault screen: see section 9.3. It is a dedicated page, separate from general settings.
- Locked-scanner state: when no valid key exists, show a friendly explanation and one clear call to action, never a raw error.

---

## 11. Code Standards

- ES modules, `const`/`let`, `async/await`, small single-purpose functions, JSDoc on public functions.
- Escape or use `textContent` for any dynamic content; never inject AI or user text with `innerHTML`.
- One Supabase client instance exported from `supabase.js`.
- Centralize fetch calls and error mapping; no scattered `try/catch` duplication.
- No dead code, no console logging of sensitive data, no magic numbers (name constants).
- Lint and format with ESLint and Prettier configs at the root.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).

---

## 12. Development Roadmap

Complete each phase fully, run its acceptance checks, and summarize what was done before starting the next.

### Phase 1 — Foundation
**Tasks**
- Initialize repo, `.gitignore`, folder structure, ESLint and Prettier.
- Build `global.css` tokens and `components.css`, plus a responsive app shell (header, bottom nav on mobile).
- Create Supabase project config, migrations for all tables (including `role`/`status` on profiles, `user_api_keys`, `recovery_rules`, `app_settings`, `audit_logs`, `api_usage_events`), RLS policies, column-level grants, and the profile-creation trigger.
- Implement auth: register, login, Google, Microsoft, forgot and reset password, logout, session guard.
- Build `index.html` landing page and `profile.html`.

**Acceptance**
- A new user can register, confirm email, log in, log out, and reset their password.
- Google and Microsoft sign-in land on the dashboard with name and avatar populated.
- Unauthenticated access to protected pages redirects to login.
- RLS verified: user A cannot read, update, or delete user B's rows.

### Phase 1B — Secure Key Vault and Database Hardening
Build this **before** the scanner so the scanner has a safe place to get keys from.

**Tasks**
- Apply the default-deny database setup, `private` schema, forced RLS, and `vault_*` functions (section 9.4); never expose `private` in the Data API settings.
- `lib/crypto.js` (AES-256-GCM, user-ID AAD, `key_version`), `lib/vault.js`, `routes/keys.js`, `redact.js`, and rate limiting on key routes.
- Build the standalone Key Vault UI: `keyvault.html`, `keyvault.css`, `keyvault.js` with all states from section 9.3, step-up re-authentication, input clearing, and the "What we store" panel.
- Serve the Key Vault page with its strict CSP and security headers; self-host its scripts.
- Configure Supabase Auth hardening (leaked-password protection, CAPTCHA, JWT expiry, refresh rotation, redirect allow-list).
- Write the first automated security tests and the `SECURITY.md` incident runbook.

**Acceptance**
- A user can add, test, replace, and delete a Gemini key; the key is never displayed again and only the masked last 4 characters and status are shown.
- In the database the key exists only as ciphertext, and the master secret is not stored there.
- Neither the anon key nor any user JWT can read `private.user_api_keys` or call `vault_*` functions.
- The canary key appears only in the single `PUT /api/keys` request and nowhere else.
- All checks in section 9.4 item 10 that apply at this stage pass.

### Phase 2 — AI Scanner
**Tasks**
- Camera access through `getUserMedia` with a file-input fallback and image downscaling.
- Integrate the Phase 1B Key Vault: onboarding card, locked-scanner state until a valid key exists, and status checks before each scan.
- Backend `/api/analyze` with JWT verification, suspended-account check, validation, rate limiting, per-request key decryption, and the Gemini integration (key in header only).
- Map Gemini failures (`API_KEY_INVALID`, quota, billing, network) to the error codes in section 7.
- Schema validation of Gemini output; friendly error mapping.
- Confirmation and correction UI with quantity and unit entry; save to `food_scans`.

**Acceptance**
- Scan to confirm to saved row works end to end on Android Chrome.
- No Gemini key appears in frontend code, network responses, logs, or error output; keys are only ever sent on `PUT /api/keys`.
- A user with no key sees the locked scanner; a user with an invalid key is prompted to fix it.
- Stored keys are unreadable ciphertext in the database, and one user's key can never be used for another user's request.
- Malformed Gemini output never breaks the UI.
- No image persists unless the user opts in.

### Phase 3 — Resource Recovery
**Tasks**
- `recovery.js` mapping waste categories and materials to pathways (composting, biogas, material recovery, pectin recovery, redistribution, reuse), accounting for contamination, processing requirements, and facility availability.
- Recommendation explanations and requirements shown on cards.
- Create and update `recovery_records` (status: suggested, planned, completed, dismissed).
- `recovery.html` for browsing and managing pathways.

**Acceptance**
- Each recommendation clearly states why it applies and what conditions it requires.
- Pathways that depend on facilities are labeled as such, with no implied guarantee of conversion.
- Users can change status or dismiss a recommendation.

### Phase 4 — Dashboard
**Tasks**
- `history.html` with search, filters (date, category, method), pagination, edit, and delete.
- `dashboard.js` deterministic analytics: total waste recorded, edible food redirected, organic waste directed to recovery, methods selected, trends over time.
- Chart.js visualizations (trend line, category breakdown, recovery method split).
- Environmental impact section with a visible **"Estimated"** badge and an expandable assumptions panel.
- Personalized suggestions drawn from past records.

**Acceptance**
- All figures reproduce from raw table data by hand.
- Estimates are never worded as measured results.
- Dashboard loads quickly and handles zero-data states gracefully.

### Phase 5 — Admin Panel
**Tasks**
- `requireAdmin` middleware (role, status, MFA `aal2`), `routes/admin.js`, and `audit.js`.
- `admin.html`, `admin.css`, `admin.js` with sections: Overview, Users, Recovery Rules, System Settings, Audit Log, System Health.
- User management actions (suspend and unsuspend via Supabase admin API, role change, revoke sessions, delete with typed confirmation) with self-lockout and last-admin safeguards.
- Wire `recovery_rules` into `recovery.js` and the Gemini prompt context; wire `app_settings` (maintenance mode, limits, allowed models, banner) into the backend and `GET /api/config`.
- Usage event logging for admin analytics (no payloads, no keys, no images).
- Document the manual first-admin bootstrap in `README.md`.

**Acceptance**
- A non-admin (including a logged-out request) cannot reach any `/api/admin/*` route or see admin data; direct API calls fail with `404`/`401`.
- Admin endpoints and UI never expose key material, ciphertext, or photos.
- Every admin mutation creates an audit log entry; the audit log cannot be edited or deleted through any API.
- Suspending a user immediately blocks their scans and signs them out.
- Editing a recovery rule changes the recommendations users see.

### Phase 6 — Testing and Hardening
**Tasks**
- Test a broad set of food categories (fruit, vegetables, cooked food, packaged items, mixed waste, blurry or dark photos, non-food images).
- Validate AI classifications and correction flow.
- Complete the full security verification in section 9.4 item 10 and document it in `SECURITY_TESTING.md`.
- Security pass: BYOK tests (ciphertext not decryptable by clients, user A's key unusable for user B, redaction verified in logs and error paths), admin authorization tests (user, suspended admin, admin without MFA), RLS isolation with two accounts, CORS, rate limits, header checks, dependency audit (`npm audit`), secrets scan.
- Cross-browser and Android device testing; Lighthouse targets of at least 90 for performance, accessibility, and best practices.
- Failure-mode testing: Gemini down, Supabase down, offline, expired session, denied camera permission.
- Write `README.md` (setup, env vars, deploy steps) and a short `TESTING.md` with the results.

**Acceptance**
- No critical or high issues open; all acceptance checks from phases 1 to 5 pass.
- Deployed to Netlify or Vercel with production OAuth redirect URLs configured.

---

## 13. Environment Variables

**`backend/.env.example`**
```
PORT=3000
# No GEMINI_API_KEY: EcoLith is BYOK. Users supply their own Gemini keys.
DEFAULT_GEMINI_MODEL=your_chosen_gemini_model   # admin can override in app_settings
KEY_ENCRYPTION_SECRET=base64_32_byte_secret      # generate with: openssl rand -base64 32
# Recommended for production: envelope encryption with a cloud KMS
# KMS_KEY_ID=your_kms_key_resource_id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # server only, never in js/
ALLOWED_ORIGIN=http://localhost:5500
```

**`js/config.js`** (public values only)
```js
export const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your_anon_key', // safe to expose; protected by RLS
  API_BASE_URL: 'http://localhost:3000'
};
```

Never place the Supabase service-role key, `KEY_ENCRYPTION_SECRET`, OAuth client secrets, or any user's Gemini key in `js/` or in version control. Back up `KEY_ENCRYPTION_SECRET` securely: losing it makes every stored user key unrecoverable (users would simply re-enter their keys).

---

## 14. How to Work (Agent Workflow)

1. **Plan first.** Before coding each phase, produce a short implementation plan listing files to create or change and any assumptions. Wait for approval on anything ambiguous.
2. **Small, verifiable steps.** Implement in increments; run and test after each one (use the browser agent to verify UI flows and the terminal to run the backend).
3. **Verify, don't assume.** Check Supabase and Gemini docs for current API signatures and model names rather than relying on memory.
4. **Report clearly.** After each phase, summarize: what was built, what was tested, what remains, and any risks or deviations from this document.
5. **Flag, don't hide.** If a requirement here conflicts with security, accessibility, or feasibility, stop and raise it instead of working around it silently.
6. **Ask before** adding a dependency, changing the schema, or altering the architecture.

---

## 15. Definition of Done (Every Task)

- Works on a 360px mobile viewport and on desktop.
- Keyboard accessible, with labels and a sensible focus order.
- Loading, empty, and error states handled.
- No secrets in client code or version control; no user Gemini key or personal data in logs, responses, or admin views.
- New tables ship with forced RLS, explicit grants, and an automated isolation test.
- Any admin feature is enforced server-side, audit-logged, and tested with a non-admin account.
- RLS-protected data verified for isolation.
- Code linted, formatted, and free of console noise.
- Acceptance checks for the phase pass and are documented.
