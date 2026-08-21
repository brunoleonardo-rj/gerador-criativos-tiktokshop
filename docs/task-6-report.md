# Task 6 report

## Fix round 4/5

RED: added adversarial filesystem tests after storage initialization. On the pre-fix implementation, a replaced `staged` junction/symlink let `promote` proceed and a symlinked UUID entry was silently skipped by cleanup (`storage.test.ts`: 2 failures). The tests use Windows junctions and only skip when the operating system explicitly reports link creation unsupported (`EPERM`, `EOPNOTSUPP`, `ENOSYS`, or `EINVAL`), while preserving an outside sentinel.

GREEN: storage now caches only canonical expected paths and re-lstats/re-realpaths the lexical library root, `staged`, and `versions` before every filesystem operation. It rejects links and non-directories, revalidates immediately before temp creation/writes/renames, reads/hashes/verifies, readdir, and recursive removal; cleanup rejects a linked or non-directory UUID entry and rechecks immediately before removal. The redundant recursive mkdir during promotion was removed.

Migration/backfill proof: `repository.integration.test.ts` creates SQLite with the actual initial migration SQL, inserts a legacy `ACTIVE` row with valid on-disk workbook/corpus, applies the actual nullable-JSON-hash migration SQL, and calls `getActiveSnapshot()` using `FileLibraryStorage`, `PrismaLibraryRepository`, and `LibraryService`. It asserts the corpus succeeds and the DB is updated with the exact 64-character SHA-256 of the JSON file. The fresh-migration staged-row non-null proof remains. The memory repository now persists a backfill and has a service-level legacy-null test.

Verification (2026-08-21):

- `pnpm vitest run src/features/library/storage.test.ts src/features/library/repository.integration.test.ts src/features/library/service.test.ts` — 12 passed.
- `pnpm prisma validate` — valid.
- `pnpm prisma generate` — generated Prisma Client 7.9.1.
- `pnpm lint` — exit 0.
- `pnpm test` — 26 files, 103 tests passed.
- `pnpm build` — exit 0; Prisma generation, compilation, type checking, static-page generation, and the Next.js route/resource trace completed.
