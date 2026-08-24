# Gemini and VEO Template Fast-Track Design

## Goal

Replace the model-authored free-form Gemini prompt with structured `geminiSlots`, render the final Gemini prompt on the server, add structured speech-synchronized product beats, and make both Gemini and VEO templates editable in Settings.

## Approved scope

The source specification is `C:/Users/Lenovo/Downloads/Prompts_Base_Gemini_VEO3_Implementacao.md`. Its supplied Gemini and VEO defaults are accepted as working across the user's products and will be implemented without format-profile expansion.

The fast-track includes template modules, structured generation output, server rendering and validation, SQLite persistence, Settings editing and preview, result display, migration, tests, typecheck, lint, and production build. Template version history, multiple format-specific defaults, and additional creative validators are deferred.

## Architecture

`gemini-template.ts` owns the Gemini whitelist, validation, rendering, and default. `veo-template.ts` continues to own the VEO whitelist and rendering and gains `speech_beats`; the complete default remains exported by the settings service for compatibility.

Anthropic returns `geminiSlots` and `speechBeats`, never the final Gemini prompt. `validateCreativeBatch` renders the Gemini prompt first, validates generated slot content and beat references, then renders the VEO prompt using the rendered Gemini prompt and formatted beats. The returned envelope contains the final `promptGemini` and `veoPrompt` so storage and result pages retain copy-ready text.

`AppSettings` gains a non-null `geminiTemplate`. Repository and service boundaries accept both defaults and return both templates. The authenticated Settings form adds a Gemini tab with whitelist validation and preview. Existing databases are upgraded by a Prisma migration against the real `AppSettings` table.

## Compatibility and failure behavior

Existing API credentials and VEO templates remain untouched. A missing Gemini template is backfilled with the approved default. Unknown or malformed template variables block saving. Unresolved Gemini rendering, orphan speech beats, clothing-removal instructions, and affirmative overlay instructions block a creative. Duplicate trigger phrases remain warnings.

The settings request limit is raised enough for both approved templates while retaining bounded streaming input. Failed rendering never exposes a partial prompt as copyable output.

## Verification

Every production behavior is introduced through a failing Vitest test. Focused suites cover template validation/rendering, schema, generation validation, settings repository/service/handler/form, and results. Completion requires the full Vitest suite, ESLint, TypeScript check, Prisma generation, and Next.js production build.
