# aaPanel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the verified TikTok Shop creative generator on `studio.misotechsolutions.com` without losing the production database, library, settings, or secrets.

**Architecture:** Keep Nginx/aaPanel as the HTTPS reverse proxy and run the Next.js standalone server on `127.0.0.1:3000`. Deploy from the GitHub `main` branch, keep persistent data outside the release directory, and preserve the server-side environment file across releases.

**Tech Stack:** Next.js 16, Node.js 20.19+, pnpm, Prisma, SQLite, Nginx, aaPanel.

**Spec:** `docs/aaPanel.md`

## Global Constraints

- Do not upload Windows `node_modules`, generated Prisma binaries, or local `.env.local`.
- Preserve the existing production `DATA_DIR`, database, library versions, and server-side secrets.
- Back up persistent data before migration or process replacement.
- Bind Node to `127.0.0.1:3000`; expose only Nginx over HTTPS.
- Never print credentials or secret environment values in command output.

---

### Task 1: Inspect the existing host

**Files:**
- Read: `docs/aaPanel.md`
- Read remotely: aaPanel site configuration, process configuration, application directory, environment file names, and persistent data path

**Interfaces:**
- Consumes: SSH access to `root@109.199.116.80`
- Produces: confirmed release path, process manager, Node/pnpm versions, and data path

- [ ] **Step 1: Connect over SSH without storing the password in the repository**
- [ ] **Step 2: Inspect the domain configuration and active listener on port 3000**
- [ ] **Step 3: Identify the deployed application, environment file, and persistent data directory without printing secret values**
- [ ] **Step 4: Confirm available disk space and required Node/pnpm versions**

### Task 2: Publish the verified source revision

**Files:**
- Modify: `src/features/draft/storage.ts`
- Modify: `src/features/draft/storage.test.ts`
- Modify: `src/features/results/result-page.tsx`
- Modify: `src/features/results/result-page.test.tsx`
- Create: `docs/superpowers/plans/2026-08-25-aapanel-deployment.md`

**Interfaces:**
- Consumes: the four already verified local fixes
- Produces: a reviewable commit on `origin/main`

- [ ] **Step 1: Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`**
- [ ] **Step 2: Review the diff and stage only the four fix files plus this deployment plan**
- [ ] **Step 3: Commit with a descriptive message**
- [ ] **Step 4: Push the commit to `origin/main` and verify the remote revision**

### Task 3: Back up and deploy on the VPS

**Files:**
- Preserve remotely: production environment file
- Back up remotely: `$DATA_DIR/app.db`
- Back up remotely: `$DATA_DIR/library/versions`

**Interfaces:**
- Consumes: published Git revision and inspected server paths
- Produces: migrated, built standalone Next.js release

- [ ] **Step 1: Create a timestamped backup with restrictive permissions**
- [ ] **Step 2: Fetch and fast-forward the application to the published revision**
- [ ] **Step 3: Install locked Linux dependencies with `pnpm install --frozen-lockfile`**
- [ ] **Step 4: Run `pnpm db:migrate`, `pnpm build`, and `pnpm standalone:prepare` with the production environment loaded**
- [ ] **Step 5: Restart the existing aaPanel-managed process and confirm it listens only on `127.0.0.1:3000`**

### Task 4: Verify production

**Files:**
- Read remotely: application and Nginx logs

**Interfaces:**
- Consumes: deployed standalone release
- Produces: evidence that HTTPS, authentication, persistence, and result routes are operational

- [ ] **Step 1: Check the local application endpoint from the VPS**
- [ ] **Step 2: Check `https://studio.misotechsolutions.com` and its TLS response**
- [ ] **Step 3: Confirm there are no startup, migration, database-path, or proxy-secret errors in recent logs**
- [ ] **Step 4: Record the deployed Git revision and backup location for rollback**
