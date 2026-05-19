# Admin Editing Requests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an admin area where editors review editing requests, mark which patient materials they used, and lock those stages against future client uploads.

**Architecture:** Persist editor selections in a new `case_stage_usage_locks` table keyed by `case_id + stage_id`. The admin API lists editing requests with patient, client, available stage files, and existing locks; saving a request replaces only that request's own locks and refuses to steal locks from another request. The portal reads locks with cases and disables upload/deletion for locked stages.

**Tech Stack:** Vercel API routes, Supabase service-role queries, React/Vite admin UI, Tailwind utility classes.

---

### Task 1: Supabase Lock Schema

**Files:**
- Modify: `docs/supabase-schema.sql`

Add `case_stage_usage_locks` with references to client, case, stage, and editing request. Add indexes and RLS deny policy.

### Task 2: Admin API Module

**Files:**
- Modify: `api/admin.ts`

Add `module=editing-requests`:
- `GET` returns request cards with client, patient, stage materials, files, and locks.
- `PUT` receives `usedStageIds`, validates ownership, prevents overwriting another request's lock, deletes removed locks for the request, and inserts new locks.

### Task 3: Admin Service + Panel

**Files:**
- Modify: `services/adminPortalService.ts`
- Create: `components/admin/AdminEditingRequestsPanel.tsx`
- Modify: `components/admin/AdminClients.tsx`

Add a new home card for "Pedidos de edição" and a card-based editor workspace with checkboxes for available materials.

### Task 4: Portal Lock Enforcement

**Files:**
- Modify: `types.ts`
- Modify: `api/cases.ts`
- Modify: `api/drive.ts`
- Modify: `components/cases/CaseStageCard.tsx`

Expose usage locks on stages, disable upload/delete in the UI, and reject Drive upload/delete server-side for locked stages.

### Task 5: Verification

Run:
- `npx tsc --noEmit`
- `npm run build`

