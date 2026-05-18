# Monday Webhooks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Receive real Monday webhook events when editing subitems are marked as edited, then sync the edited status and creative type into Supabase.

**Architecture:** Add a public Vercel API endpoint for Monday webhook challenge/events and an admin-only endpoint action to register the webhook against the production board. Persist raw webhook audit rows plus normalized editing request state in Supabase so the portal/dashboard can stop depending on repeated Monday polling over time.

**Tech Stack:** Vercel serverless functions, Monday GraphQL API, Supabase service role, TypeScript, React/Vite admin service layer.

---

### Task 1: Supabase Schema

**Files:**
- Modify: `docs/supabase-schema.sql`
- Modify: `docs/supabase-admin-dashboard-notifications.sql`

**Steps:**
1. Add columns to `case_editing_requests`: `creative_type`, `edited_material_count`, `monday_webhook_event_id`, `last_webhook_at`.
2. Add a `monday_webhook_events` audit table with normalized IDs and raw JSON payload.
3. Add indexes for `monday_subitem_id`, `parent_item_id`, `created_at`, and `event_type`.

### Task 2: Webhook Endpoint

**Files:**
- Create: `api/monday-webhook.ts`

**Steps:**
1. Accept only `POST`/`OPTIONS`.
2. Reply to Monday validation payloads with `{ challenge }`.
3. Validate `MONDAY_WEBHOOK_SECRET` through query string or `x-webhook-secret`.
4. Normalize event fields from multiple possible Monday payload shapes.
5. Save raw webhook event to Supabase.
6. Fetch the changed subitem from Monday.
7. If the subitem is an editing request and its status is `Editado`, update `case_editing_requests` with `status = edited`, `edited_at`, `creative_type`, material count, and event reference.

### Task 3: Admin Registration Endpoint

**Files:**
- Modify: `api/admin.ts`

**Steps:**
1. Add a `module=monday-webhooks` branch protected by `ADMIN_PASSWORD`.
2. Support `GET` to list current board webhooks.
3. Support `POST` to create the production webhook using the Vercel URL and `MONDAY_WEBHOOK_SECRET`.
4. Prefer the subitem-column event first; return clear Monday errors if permissions or event names fail.

### Task 4: Verification

**Files:**
- No new files.

**Steps:**
1. Run `npm run build`.
2. Run `npx tsc --noEmit`.
3. Confirm `git status --short`.
4. Report required Vercel variable and Supabase SQL to run.
