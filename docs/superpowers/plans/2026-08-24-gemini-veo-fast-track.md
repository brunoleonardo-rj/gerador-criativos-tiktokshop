# Gemini and VEO Template Fast-Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Gemini and VEO prompts from configurable server templates using structured generation slots and speech beats.

**Architecture:** Anthropic emits variable fields only. The server validates those fields, renders a final Gemini prompt, formats speech beats, renders the final VEO prompt, and persists copy-ready output together with the generation result. Settings stores and previews both templates.

**Tech Stack:** Next.js 16, TypeScript, Zod, Anthropic structured output, Prisma 7, SQLite, React Testing Library, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-gemini-veo-templates-design.md`

## Global Constraints

- Use the exact default Gemini and VEO prompt bodies from the approved source specification.
- Keep current authentication, API-key encryption, product extraction, library import, and upload behavior unchanged.
- Preserve existing VEO template values during migration and backfill only the new Gemini template.
- Keep request bodies bounded and reject unknown template variables.
- Follow RED → GREEN → REFACTOR for every production behavior.

---

### Task 1: Gemini template module and VEO speech-beat variable

**Files:**
- Create: `src/features/settings/gemini-template.ts`
- Create: `src/features/settings/gemini-template.test.ts`
- Modify: `src/features/settings/veo-template.ts`
- Modify: `src/features/settings/veo-template.test.ts`
- Modify: `src/features/settings/service.ts`

**Interfaces:**
- Produces: `GEMINI_VARIABLES`, `GeminiVariables`, `validateGeminiTemplate(template)`, `renderGeminiTemplate(template, values)`, and `DEFAULT_GEMINI_TEMPLATE`.
- Extends: `VeoVariables` with `speech_beats` and supplies the approved complete `DEFAULT_VEO_TEMPLATE`.

- [ ] **Step 1: Write failing template tests**

Add tests proving that all approved Gemini variables render, unknown and malformed markers are rejected, unresolved slot markers throw, and `speech_beats` renders through the VEO template.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/settings/gemini-template.test.ts src/features/settings/veo-template.test.ts`

Expected: FAIL because the Gemini module and VEO `speech_beats` variable do not exist.

- [ ] **Step 3: Implement the minimal template modules**

Mirror the existing safe marker parser, use the exact whitelists from the approved specification, and copy the approved default prompt bodies without modifying their wording.

- [ ] **Step 4: Verify GREEN**

Run the focused template tests and require all to pass.

- [ ] **Step 5: Commit**

Commit message: `feat: add configurable Gemini and VEO templates`

### Task 2: Structured generation contract and prompt rendering

**Files:**
- Modify: `src/features/generation/schema.ts`
- Modify: `src/features/generation/schema.test.ts`
- Modify: `src/features/generation/system-prompt.ts`
- Modify: `src/features/generation/system-prompt.test.ts`
- Modify: `src/features/generation/validation.ts`
- Modify: `src/features/generation/validation.test.ts`
- Modify: `src/features/generation/json-schema.test.ts`
- Modify: `src/features/generation/anthropic-port.ts`
- Modify: generation fixtures that construct creatives.

**Interfaces:**
- Produces: `geminiSlotsSchema`, `speechBeatSchema`, `SpeechBeat`, and `renderSpeechBeats(beats)`.
- Changes: `creativeSchema.promptGemini` becomes `creativeSchema.geminiSlots`; `creativeSchema.speechBeats` accepts one to four strict beat objects.
- Changes: `validateCreativeBatch(input, batch, veoTemplate, geminiTemplate, settingsUpdatedAt)` returns each creative with rendered `promptGemini` and `veoPrompt`.

- [ ] **Step 1: Write failing schema and validation tests**

Cover strict slot parsing, strict beat parsing, orphan trigger phrases as blocks, duplicate triggers as warnings, final Gemini rendering, slot-level overlay/clothing checks, formatted VEO beats, and a Gemini rendering failure.

- [ ] **Step 2: Verify RED**

Run the focused schema, system-prompt, JSON-schema, and validation suites. Expect failures caused by the absent structured contract.

- [ ] **Step 3: Implement the contract and rendering pipeline**

Update the system prompt with the approved slot instructions, render the Gemini values using the snake-case mapping, format each beat as `- On "trigger": camera + gesture → result`, and render VEO with the final Gemini prompt plus beats.

- [ ] **Step 4: Update deterministic fixtures and fake Anthropic output**

Replace every fixture `promptGemini` field with complete `geminiSlots` and one beat whose trigger appears literally in the fixture's spoken copy.

- [ ] **Step 5: Verify GREEN and commit**

Run focused generation tests. Commit message: `feat: generate prompts from structured creative slots`

### Task 3: Persist and edit the Gemini template

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260824000000_gemini_template/migration.sql`
- Modify: `src/features/settings/repository.ts`
- Modify: `src/features/settings/repository.integration.test.ts`
- Modify: `src/features/settings/service.ts`
- Modify: `src/features/settings/service.test.ts`
- Modify: `src/features/settings/settings-handler.ts`
- Modify: `src/features/settings/settings-handler.test.ts`
- Modify: `src/features/settings/settings-form.tsx`
- Modify: `src/features/settings/settings-form.test.tsx`

**Interfaces:**
- Adds: `AppSettings.geminiTemplate: String`.
- Changes: public and generation settings include `geminiTemplate`.
- Changes: repository `getOrCreate(defaultVeoTemplate, defaultGeminiTemplate)` and update input contain both templates.

- [ ] **Step 1: Write failing repository, service, handler, and form tests**

Prove default backfill, round-trip persistence, invalid Gemini rejection, the larger bounded request, a separate accessible Gemini tab, preview rendering, and saving both templates.

- [ ] **Step 2: Verify RED**

Run the focused settings suites and expect failures because the field and UI are absent.

- [ ] **Step 3: Add schema migration and backend plumbing**

Alter `AppSettings`, backfill the approved default, update repository/service types, validate both templates, and raise the bounded JSON maximum to 65,536 bytes while retaining streaming cancellation.

- [ ] **Step 4: Add the Settings tab**

Add `Prompt Gemini` beside `Prompt VEO 3`, show its accepted variables and fictitious preview, validate before save, and preserve existing credential/model/library tabs.

- [ ] **Step 5: Verify GREEN and commit**

Run Prisma generation plus focused settings tests. Commit message: `feat: manage Gemini template in settings`

### Task 4: Wire generation and copy-ready results

**Files:**
- Modify: `src/features/generation/service.ts`
- Modify: `src/features/generation/service.test.ts`
- Modify: generation handler and result fixtures as required by the new envelope.
- Modify: `src/features/results/result-card.tsx`
- Modify: `src/features/results/result-card.test.tsx`

**Interfaces:**
- Consumes: `GenerationSettings.geminiTemplate` and the rendered `promptGemini` returned by validation.
- Preserves: result fields and existing per-field copy buttons.

- [ ] **Step 1: Write failing service and result tests**

Prove generation passes both templates into validation and the result displays and copies the rendered Gemini prompt rather than raw slots.

- [ ] **Step 2: Verify RED**

Run focused service/result tests and expect contract failures.

- [ ] **Step 3: Wire generation and results**

Pass the Gemini template through generation settings and keep the rendered prompt in the stored envelope. Do not expose raw slots as the primary copy action.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests. Commit message: `feat: expose rendered creative prompts`

### Task 5: Migration and production verification

**Files:**
- Modify only files required by failures discovered during verification, with a regression test first for behavioral defects.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run static verification**

Run: `npm run lint` and `npm run typecheck`.

Expected: both exit zero.

- [ ] **Step 3: Run production build**

Run: `npm run build`.

Expected: Prisma generation and all Next.js routes build successfully.

- [ ] **Step 4: Verify migration against a copied legacy database**

Apply migrations to a temporary copy of the existing SQLite database and prove the existing VEO template remains unchanged while `geminiTemplate` is populated.

- [ ] **Step 5: Commit verification fixes**

Use a focused commit only if verification required code changes.
