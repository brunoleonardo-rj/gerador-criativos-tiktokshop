# Entrada de Produto por Imagens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o formulário inicial por upload de imagens, extração factual via Anthropic e revisão editável antes da geração dos criativos.

**Architecture:** Um novo endpoint autenticado recebe de uma a oito imagens, valida o multipart e chama um serviço de extração isolado por porta. O wizard mantém três etapas; “Produto” alterna entre upload, análise e revisão, persiste a chave da seleção analisada e invalida a revisão quando as imagens mudam.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript 5.9, Zod 4, React Hook Form, Anthropic SDK, IndexedDB/idb, Vitest, Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-08-23-entrada-por-imagens-design.md`

## Global Constraints

- Aceitar de uma a oito imagens JPEG, PNG ou WEBP, com no máximo 3 MiB por arquivo após o redimensionamento.
- Não mostrar campos textuais antes da primeira análise.
- Não inventar informação ausente; campos escalares não identificados retornam `null`.
- Manter fotos UGC no navegador; somente fontes de produto/anúncio são enviadas à Anthropic.
- Preservar rascunhos e imagens após falha, atualização da página ou nova tentativa.
- Exigir nome, categoria e descrição revisados antes de avançar.
- Invalidar a análise sempre que a seleção de imagens mudar.
- Não registrar prompts, imagens, conteúdo extraído, credenciais, senha ou cookie.
- Preservar as alterações locais preexistentes em `next-env.d.ts` e `resources/library/library.default.json`.
- Antes de alterar rotas Next.js, ler integralmente a documentação local relevante em `node_modules/next/dist/docs/`.
- Todo comportamento novo segue RED → GREEN → REFACTOR e cada tarefa termina com commit próprio.

---

### Task 1: Contrato factual e prompt de extração

**Files:**
- Create: `src/features/product-extraction/schema.ts`
- Create: `src/features/product-extraction/schema.test.ts`
- Create: `src/features/product-extraction/prompt.ts`
- Create: `src/features/product-extraction/prompt.test.ts`

**Interfaces:**
- Produces: `productExtractionSchema`, `ProductExtraction`, `ProductSourceImage`, `buildProductExtractionPrompt(images)`.
- `ProductSourceImage` is `{ mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }`.
- `buildProductExtractionPrompt` returns `{ system: TextBlockParam[]; messages: MessageParam[] }`.

- [ ] **Step 1: Write failing schema tests**

```ts
it("accepts unknown facts only as null or empty arrays", () => {
  expect(productExtractionSchema.parse({
    nomeProduto: null, categoria: null, descricaoPdp: null,
    avaliacoes: null, notaMedia: null, quantidadeAvaliacoes: null,
    precoAtual: null, precoAnterior: null,
    especificacoesCriticas: [], publicoAlvo: null, avisos: ["Texto ilegível."],
  }).nomeProduto).toBeNull();
});

it("rejects invented extra properties", () => {
  expect(() => productExtractionSchema.parse({ ...validExtraction, confianca: 0.9 })).toThrow();
});
```

- [ ] **Step 2: Run the schema test and confirm RED**

Run: `pnpm test src/features/product-extraction/schema.test.ts`
Expected: FAIL because `schema.ts` does not exist.

- [ ] **Step 3: Implement the strict Zod schema**

```ts
export const productExtractionSchema = z.object({
  nomeProduto: nullableText(500),
  categoria: nullableText(500),
  descricaoPdp: nullableText(10_000),
  avaliacoes: nullableText(10_000),
  notaMedia: z.number().min(0).max(5).nullable(),
  quantidadeAvaliacoes: z.number().int().nonnegative().max(10_000_000).nullable(),
  precoAtual: nullableText(100),
  precoAnterior: nullableText(100),
  especificacoesCriticas: z.array(z.string().trim().min(1).max(1_000)).max(30),
  publicoAlvo: nullableText(2_000),
  avisos: z.array(z.string().trim().min(1).max(1_000)).max(30),
}).strict();
```

- [ ] **Step 4: Write prompt tests and confirm RED**

```ts
it("sends every source image before the extraction instruction", () => {
  const prompt = buildProductExtractionPrompt([jpegSource, pngSource]);
  const content = prompt.messages[0].content;
  expect(content).toHaveLength(3);
  expect(content[0]).toMatchObject({ type: "image" });
  expect(content[1]).toMatchObject({ type: "image" });
});

it("forbids guessing invisible facts", () => {
  expect(JSON.stringify(buildProductExtractionPrompt([jpegSource]))).toMatch(/não (invente|infira)/i);
});
```

Run: `pnpm test src/features/product-extraction/prompt.test.ts`
Expected: FAIL because `prompt.ts` does not exist.

- [ ] **Step 5: Implement the factual prompt builder**

Build Anthropic image blocks followed by one text instruction. State that visible text is the only source of truth, conflicting values become warnings, and absent facts must be `null`/`[]`. Do not include the creative library or VEO template.

- [ ] **Step 6: Run both tests and commit**

Run: `pnpm test src/features/product-extraction/schema.test.ts src/features/product-extraction/prompt.test.ts`
Expected: PASS.

```bash
git add src/features/product-extraction/schema.ts src/features/product-extraction/schema.test.ts src/features/product-extraction/prompt.ts src/features/product-extraction/prompt.test.ts
git commit -m "feat: define factual product extraction"
```

### Task 2: Porta Anthropic e serviço de extração

**Files:**
- Create: `src/features/generation/anthropic-errors.ts`
- Create: `src/features/generation/anthropic-errors.test.ts`
- Modify: `src/features/generation/anthropic-port.ts`
- Modify: `src/features/generation/anthropic-port.test.ts`
- Create: `src/features/product-extraction/anthropic-port.ts`
- Create: `src/features/product-extraction/anthropic-port.test.ts`
- Create: `src/features/product-extraction/service.ts`
- Create: `src/features/product-extraction/service.test.ts`

**Interfaces:**
- Produces shared `GenerationErrorCode`, `GenerationFailure`, `failureForAnthropic(error, signal)`.
- Produces `ProductExtractionPort.extract(apiKey, request, signal): Promise<ProductExtraction>`.
- `ProductExtractionRequest` is `{ model: string; system: TextBlockParam[]; messages: MessageParam[] }`.
- Produces `ProductExtractionService.extract(images, signal): Promise<ProductExtraction>`.
- Consumes Task 1 `ProductExtraction`, `ProductSourceImage`, and `buildProductExtractionPrompt`.

- [ ] **Step 1: Write failing tests for shared Anthropic error mapping**

```ts
it.each([[401, "INVALID_API_KEY"], [403, "INVALID_API_KEY"], [429, "RATE_LIMITED"]])(
  "maps status %s to %s", (status, code) => {
    expect(failureForAnthropic({ status }, new AbortController().signal)).toMatchObject({ code });
  },
);
```

Run: `pnpm test src/features/generation/anthropic-errors.test.ts`
Expected: FAIL because the shared module does not exist.

- [ ] **Step 2: Extract the error types without behavior change**

Move the existing error code union, failure class and mapping function out of `generation/anthropic-port.ts`. Re-export `GenerationErrorCode` and `GenerationFailure` from the existing module so current imports remain stable. Run:

`pnpm test src/features/generation/anthropic-errors.test.ts src/features/generation/anthropic-port.test.ts src/features/generation/service.test.ts`

Expected: PASS.

- [ ] **Step 3: Write failing adapter tests**

```ts
it("uses a strict JSON schema and parses the single text block", async () => {
  const create = vi.fn().mockResolvedValue(anthropicResponse(JSON.stringify(validExtraction)));
  const result = await new AnthropicProductExtractionAdapter(() => ({ messages: { create } } as never))
    .extract("secret", { model: "claude-test", ...buildProductExtractionPrompt([jpegSource]) }, signal);
  expect(result.nomeProduto).toBe("Garrafa");
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
    output_config: { format: expect.objectContaining({ type: "json_schema" }) },
  }), expect.anything());
});
```

Run: `pnpm test src/features/product-extraction/anthropic-port.test.ts`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement the adapter**

Use `z.toJSONSchema(productExtractionSchema, { target: "draft-07" })`, one `messages.create` call, `max_tokens: 4_000`, the configured model and the shared error mapper. Reject refusal, max-token truncation, multiple/no text blocks, invalid JSON and schema mismatch as `INVALID_MODEL_OUTPUT`.

- [ ] **Step 5: Write failing service tests**

```ts
it("loads the configured key and model without exposing them", async () => {
  const extract = vi.fn().mockResolvedValue(validExtraction);
  const result = await new ProductExtractionService(settings(), { extract }).extract([jpegSource], signal);
  expect(extract).toHaveBeenCalledWith("sk-secret", expect.objectContaining({ model: "claude-test" }), signal);
  expect(JSON.stringify(result)).not.toContain("sk-secret");
});

it("maps missing settings to API_NOT_CONFIGURED", async () => {
  await expect(new ProductExtractionService(missingSettings, port).extract([jpegSource], signal))
    .rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
});
```

- [ ] **Step 6: Implement the service and verify**

The service loads `getGenerationSettings()`, builds the Task 1 prompt and calls the port. It maps unexpected failures to `UPSTREAM_UNAVAILABLE` while preserving `GenerationFailure`.

Run: `pnpm test src/features/generation src/features/product-extraction`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/generation/anthropic-errors* src/features/generation/anthropic-port* src/features/product-extraction/anthropic-port* src/features/product-extraction/service*
git commit -m "feat: add Anthropic product extraction service"
```

### Task 3: Validação multipart compartilhada

**Files:**
- Create: `src/features/uploads/server-images.ts`
- Create: `src/features/uploads/server-images.test.ts`
- Modify: `src/features/generation/generate-handler.ts`
- Modify: `src/features/generation/generate-handler.test.ts`

**Interfaces:**
- Produces `UploadRequestFailure` with code `INVALID_REQUEST | PAYLOAD_TOO_LARGE`.
- Produces `parseBoundedMultipart(request, maxBodyBytes): Promise<FormData>`.
- Produces `collectImageFields(form, specs, allowedNonFileFields): Promise<ValidatedServerImage[]>`.
- `ValidatedServerImage` is `{ field: string; mediaType: ProductSourceImage["mediaType"]; data: string }`.

- [ ] **Step 1: Write failing parser tests**

Cover declared and streamed body limits, invalid content type, JPEG/PNG/WEBP magic bytes, mismatched signatures, unknown fields, per-field count and 3 MiB per-file limit.

```ts
await expect(collectImageFields(formWithFakeJpeg, { source: { min: 1, max: 8 } }, []))
  .rejects.toMatchObject({ code: "INVALID_REQUEST" });
```

Run: `pnpm test src/features/uploads/server-images.test.ts`
Expected: FAIL because the parser does not exist.

- [ ] **Step 2: Implement the bounded parser and collector**

Keep request streaming bounded before calling `request.formData()`. Validate both MIME and magic bytes, encode accepted bytes to base64, and reject any form entry not listed in the specs or `allowedNonFileFields`.

- [ ] **Step 3: Refactor `/api/generate` handler through the shared parser**

Use specs:

```ts
const imageSpecs = {
  product: { min: 0, max: 8 },
  ad: { min: 0, max: 5 },
  ugc: { min: 0, max: 5 },
} as const;
```

Keep `payload` as the only non-file field and continue excluding UGC from `GenerationImage[]`.

- [ ] **Step 4: Verify old and new parser behavior**

Run: `pnpm test src/features/uploads/server-images.test.ts src/features/generation/generate-handler.test.ts`
Expected: PASS with the existing 18-file and oversized-stream regressions intact.

- [ ] **Step 5: Commit**

```bash
git add src/features/uploads/server-images* src/features/generation/generate-handler*
git commit -m "refactor: share secure image multipart parsing"
```

### Task 4: Endpoint autenticado de extração

**Files:**
- Create: `src/features/product-extraction/handler.ts`
- Create: `src/features/product-extraction/handler.test.ts`
- Create: `src/app/api/product-extraction/route.ts`

**Interfaces:**
- Produces `makeProductExtractionHandler(deps): (request: Request) => Promise<Response>`.
- Consumes Task 2 `ProductExtractionService.extract` and Task 3 multipart helpers.
- Route constructs `SettingsService`, `ProductExtractionService` and `AnthropicProductExtractionAdapter` server-side.

- [ ] **Step 1: Read the local Next.js Route Handler documentation**

Find the route handler guide with `rg --files node_modules/next/dist/docs | rg 'route-handler|route\.md'`, then read the selected file fully before creating the route.

- [ ] **Step 2: Write failing handler tests**

```ts
it("authenticates, enforces same origin and forwards one to eight source images", async () => {
  const extract = vi.fn().mockResolvedValue(validExtraction);
  const response = await makeProductExtractionHandler(deps({ extract }))(await multipartSources(2));
  expect(response.status).toBe(200);
  expect(extract).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ mediaType: "image/jpeg" }),
  ]), expect.any(AbortSignal));
});
```

Add separate tests for unauthorized (401), bad origin (403), missing/extra/9th source (422), oversized body (413), unsupported method (405) and every Anthropic error code/status mapping.

Run: `pnpm test src/features/product-extraction/handler.test.ts`
Expected: FAIL because the handler does not exist.

- [ ] **Step 3: Implement handler and route**

Use an 8 × 3 MiB plus multipart overhead body limit and `AbortSignal.timeout(60_000)`. Return only the validated extraction object. Do not include SDK usage, key, model, prompts or image data.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test src/features/product-extraction/handler.test.ts src/features/product-extraction/service.test.ts`
Expected: PASS.

```bash
git add src/features/product-extraction/handler* src/app/api/product-extraction/route.ts
git commit -m "feat: expose authenticated product image extraction"
```

### Task 5: Chave da seleção analisada e rascunho compatível

**Files:**
- Create: `src/features/product-extraction/image-selection.ts`
- Create: `src/features/product-extraction/image-selection.test.ts`
- Modify: `src/features/draft/schema.ts`
- Modify: `src/features/draft/storage.migration.test.ts`
- Modify: `src/features/wizard/generation-wizard.tsx`
- Modify: `src/features/wizard/generation-wizard.test.tsx`

**Interfaces:**
- Produces `getProductSourceImages(images): StoredImage[]` for roles `product | ad`.
- Produces `imageSelectionKey(images): string` based on ordered id, name, type, width, height and size.
- Draft adds optional `productAnalysisKey: string` and `productExtractionWarnings: string[]`.

- [ ] **Step 1: Write failing selection tests**

```ts
it("changes when an image is added, removed, replaced or reordered", () => {
  expect(imageSelectionKey([a])).not.toBe(imageSelectionKey([a, b]));
  expect(imageSelectionKey([a, b])).not.toBe(imageSelectionKey([b, a]));
  expect(imageSelectionKey([a])).not.toBe(imageSelectionKey([{ ...a, size: a.size + 1 }]));
});
```

Run: `pnpm test src/features/product-extraction/image-selection.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 2: Implement deterministic source selection**

Sort only when reading persisted `order`; preserve the displayed order in the key. Include legacy `ad` images as product sources without rewriting or deleting their records.

- [ ] **Step 3: Write failing draft migration tests**

Assert that a v1 draft without the new fields still loads and that the two new optional fields round-trip. Run:

`pnpm test src/features/draft/storage.migration.test.ts src/features/draft/storage.test.ts`

Expected: FAIL on the new round-trip assertion.

- [ ] **Step 4: Extend draft schema and wizard conversion helpers**

Change `toDraft(values, analysis?)` to include the optional key/warnings and add:

```ts
export type ProductAnalysisDraft = {
  productAnalysisKey?: string;
  productExtractionWarnings?: string[];
};
```

Do not send either property through `toInput()`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test src/features/product-extraction/image-selection.test.ts src/features/draft src/features/wizard/generation-wizard.test.ts`
Expected: PASS for storage/conversion tests; UI behavior remains for later tasks.

```bash
git add src/features/product-extraction/image-selection* src/features/draft src/features/wizard/generation-wizard*
git commit -m "feat: persist product image analysis state"
```

### Task 6: Tela Produto com upload, análise e revisão

**Files:**
- Replace: `src/features/wizard/product-step.tsx`
- Replace: `src/features/wizard/product-step.test.tsx`
- Create: `src/features/wizard/product-review-form.tsx`
- Create: `src/features/wizard/product-review-form.test.tsx`
- Modify: `src/features/uploads/upload-field.tsx`
- Modify: `src/features/uploads/upload-field.test.tsx`
- Modify: `src/features/wizard/wizard.module.css`

**Interfaces:**
- `UploadField` gains optional `label` and `help` props while preserving role-based defaults.
- `ProductStep` consumes images, state (`upload | analyzing | review`), warnings/errors, React Hook Form register/errors, and callbacks `onImagesChange`, `onAnalyze`, `onBackToImages`.
- `ProductReviewForm` owns no state; it renders registered fields and validation messages.

- [ ] **Step 1: Replace old product-step expectations with failing image-first tests**

```tsx
it("shows only image upload before analysis", () => {
  render(<ProductStep {...uploadProps} />);
  expect(screen.getByLabelText("Fotos e prints do produto")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Analisar imagens" })).toBeDisabled();
  expect(screen.queryByLabelText("Nome do produto")).not.toBeInTheDocument();
});

it("shows editable extracted fields only in review state", () => {
  render(<ProductStep {...reviewProps} />);
  expect(screen.getByLabelText("Nome do produto")).toHaveValue("Garrafa");
  expect(screen.getByRole("button", { name: "Analisar novamente" })).toBeInTheDocument();
});
```

Run: `pnpm test src/features/wizard/product-step.test.tsx`
Expected: FAIL because the current component is text-first.

- [ ] **Step 2: Write and verify failing UploadField customization test**

Assert that `label="Fotos e prints do produto"` changes both legend and accessible file-input name, while the existing UGC defaults remain unchanged.

- [ ] **Step 3: Implement the three Product states**

Upload state: large dropzone, examples, miniatures and disabled Analyze button until one image exists. Analyzing state: preserve thumbnails, show `role="status"`, disable Analyze and removal. Review state: grouped fields, warnings, **Trocar imagens** and **Analisar novamente**.

- [ ] **Step 4: Implement compact review form**

Groups:

- Produto: nome, categoria, descrição;
- Oferta e prova social: avaliações, nota, quantidade, preço atual/anterior;
- Especificações: lista por linha e público-alvo.

Use the existing `WizardFormValues` names so `toInput()` remains the only final mapping.

- [ ] **Step 5: Verify component tests and commit**

Run: `pnpm test src/features/uploads/upload-field.test.tsx src/features/wizard/product-step.test.tsx src/features/wizard/product-review-form.test.tsx`
Expected: PASS without React accessibility warnings.

```bash
git add src/features/uploads/upload-field* src/features/wizard/product-step* src/features/wizard/product-review-form* src/features/wizard/wizard.module.css
git commit -m "feat: build image-first product review interface"
```

### Task 7: Integrar extração ao wizard e mover perfil UGC

**Files:**
- Modify: `src/features/wizard/generation-wizard.tsx`
- Modify: `src/features/wizard/generation-wizard.test.tsx`
- Modify: `src/features/wizard/references-step.tsx`
- Modify: `src/features/wizard/references-step.test.tsx`
- Modify: `src/features/wizard/wizard.module.css`

**Interfaces:**
- `WizardServices` gains `extractProduct(form: FormData): Promise<ProductExtraction>`.
- Default service POSTs to `/api/product-extraction` with each product/ad source under `source`.
- References step receives register/errors and owns the `perfilUgc` selector plus UGC upload.

- [ ] **Step 1: Write failing end-to-end component tests**

```tsx
it("extracts images, opens review and blocks stale analysis", async () => {
  const extractProduct = vi.fn().mockResolvedValue(validExtraction);
  render(<GenerationWizard services={services({ listImages: async () => [product], extractProduct })} />);
  await user.click(await screen.findByRole("button", { name: "Analisar imagens" }));
  expect(await screen.findByLabelText("Nome do produto")).toHaveValue("Garrafa");
  await user.click(screen.getByRole("button", { name: /trocar imagens/i }));
  await user.click(screen.getByRole("button", { name: /remover product.jpg/i }));
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
});
```

Add tests for duplicate-click prevention, API-not-configured link, retry with thumbnails preserved, required review fields, old draft compatibility, a legacy selection over eight images, profile UGC requirement and final multipart containing reviewed payload plus product/ad images.

Run: `pnpm test src/features/wizard/generation-wizard.test.tsx src/features/wizard/references-step.test.tsx`
Expected: FAIL on the new flow.

- [ ] **Step 2: Implement extraction orchestration**

Build `FormData` from `getProductSourceImages(images)`, set `analyzing`, map the extraction into form values with `form.reset`/`setValue`, store the current `imageSelectionKey`, and show review. Preserve user direction fields when applying extraction.

- [ ] **Step 3: Enforce freshness and validation**

Step 0 can advance only when `productAnalysisKey === imageSelectionKey(currentSources)` and name/category/description validate. Image changes leave extracted values intact but switch back to upload and show that a new analysis is required.

- [ ] **Step 4: Move UGC profile into References**

References renders `perfilUgc` before the UGC upload. `sem_pessoa` makes the upload optional; other values require at least one UGC image. Remove product/ad upload cards from this step because those sources now live in Produto.

- [ ] **Step 5: Style the accessible shell and stepper**

Replace global `landing-page/landing-hero` usage with CSS-module page, container, header, three-item navigation, content card and sticky/non-overlapping actions. Add `aria-current="step"`, visible “Etapa N de 3” and mobile single-column breakpoints.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test src/features/wizard src/features/uploads/upload-field.test.tsx`
Expected: PASS.

```bash
git add src/features/wizard
git commit -m "feat: integrate image extraction into generation wizard"
```

### Task 8: Full regression and browser verification

**Files:**
- Verify: `src/features/wizard/wizard.module.css`
- Verify: tests covering the assembled feature
- Modify: `docs/superpowers/plans/2026-08-23-entrada-por-imagens.md` (check completed boxes)

**Interfaces:**
- No new public interface; this task verifies the assembled behavior.

- [ ] **Step 1: Run focused server and client suites**

Run:

```bash
pnpm test src/features/product-extraction src/features/uploads src/features/wizard src/features/generation
```

Expected: all focused tests PASS with zero unhandled errors.

- [ ] **Step 2: Run the complete quality gate**

Run each command separately and require exit code 0:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

- [ ] **Step 3: Verify desktop layout in the authenticated local app**

Start `pnpm dev`, open `/` using the in-app browser, sign in with the configured local admin credentials, and capture the Product upload state at approximately 1440 × 900. Confirm that only images are requested, the dropzone and actions are aligned, and no content overflows.

- [ ] **Step 4: Verify analysis/review and mobile layout**

Use the fake Anthropic development adapter or a deterministic test fixture to exercise upload → analysis → review without spending a real API call. Inspect review at desktop and approximately 390 × 844. Confirm keyboard focus, readable validation, single-column fields and reachable actions.

- [ ] **Step 5: Add a regression test before fixing any discovered issue**

For every behavioral defect found, first add the smallest failing Vitest/Testing Library test, run it to confirm RED, apply the minimal fix, and rerun to GREEN. Pure visual spacing fixes may be made in CSS after screenshot evidence.

- [ ] **Step 6: Final diff audit and commit**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~1
```

Confirm that `next-env.d.ts` and `resources/library/library.default.json` were not staged by this feature unless the user explicitly requested them.

```bash
git add src docs/superpowers/plans/2026-08-23-entrada-por-imagens.md
git commit -m "test: verify image-first generation flow"
```
