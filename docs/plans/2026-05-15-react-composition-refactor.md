# React Composition Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce repeated data fetching and split the largest React surfaces into safer reusable pieces without changing the product flow.

**Architecture:** Add lightweight module-level caches for shared portal data, then move repeated UI units and stage FAQ loading into hooks/components. Keep styling and API contracts intact so the branch remains easy to compare against `main`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Vercel API routes.

---

### Task 1: Shared Ready Testimonials Data

**Files:**
- Create: `components/cases/useReadyTestimonials.ts`
- Modify: `components/cases/ReadyTestimonials.tsx`
- Modify: `components/cases/CasePortal.tsx`

**Steps:**
1. Move demo testimonial data into the hook module.
2. Add a module-level cache keyed by token to deduplicate `fetchReadyTestimonials`.
3. Return `testimonials`, loading state, refresh state, error, `refresh`, and derived counts.
4. Use the hook in both portal summary and “Materiais Prontos”.
5. Run `npm run build`.

### Task 2: Search and Small Components

**Files:**
- Modify: `components/cases/ReadyTestimonials.tsx`
- Modify: `components/cases/CasePatientList.tsx`

**Steps:**
1. Extract inline `FilterChip` from `ReadyTestimonials`.
2. Use `useDeferredValue` for patient and testimonial search.
3. Memoize derived asset totals.
4. Preserve visual output.

### Task 3: Stage FAQ and Upload Composition

**Files:**
- Create: `components/cases/useStageFaqs.ts`
- Modify: `components/cases/CaseStageCard.tsx`

**Steps:**
1. Move FAQ fetching into a cached hook keyed by stage type aliases.
2. Replace duplicated hidden file inputs with one shared input per card.
3. Keep current FAQ popup, lightbox, upload, and delete behavior.
4. Run `npm run build`.

### Task 4: Verification

**Files:**
- All touched files.

**Steps:**
1. Run `npm run build`.
2. Run `git diff --check`.
3. Review diff for accidental UI/API changes.
