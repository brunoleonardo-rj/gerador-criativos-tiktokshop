# Gerador de Criativos TikTok Shop MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um aplicativo Next.js local, autenticado e pronto para aaPanel que gera pacotes de criativos via Claude, administra configurações seguras e permite atualizar a biblioteca mestra por planilha.

**Architecture:** Um processo Next.js 16 com App Router serve a interface e Route Handlers Node. Prisma 7 com SQLite persiste configurações criptografadas e versões da biblioteca; IndexedDB/localStorage preservam rascunhos e resultados do navegador. A geração usa uma porta Anthropic injetável, saída estruturada, seleção determinística da biblioteca e validação editorial server-side.

**Tech Stack:** Node.js 20.19+, pnpm, Next.js 16+, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zod, React Hook Form, Prisma 7, `@prisma/adapter-better-sqlite3`, ExcelJS, Anthropic TypeScript SDK, jose, idb, Vitest, Testing Library e Playwright.

**Spec:** `docs/superpowers/specs/2026-08-21-gerador-criativos-mvp-design.md`

## Global Constraints

- O app fica em `D:\Projetos\TiktokShop\gerador-criativos` e não altera os materiais criativos no diretório pai.
- O runtime mínimo é Node.js 20.19 e o build deve usar `output: "standalone"`.
- A aplicação é local; publicação e configuração efetiva do aaPanel ficam fora desta implementação.
- A Anthropic API key nunca chega ao cliente, HTML, logs ou respostas HTTP.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET` e `SETTINGS_ENCRYPTION_KEY` vivem apenas no ambiente do servidor.
- Fotos UGC não saem do navegador; somente fotos de produto e prints seguem para a API.
- A biblioteca inicial vem de `D:\Projetos\TiktokShop\outputs\copy-library-20260819\Biblioteca_Mestra_Copys_TikTok_Shop.xlsx`.
- O modelo default é `claude-sonnet-5`, editável em Configurações.
- Saída Anthropic usa `output_config.format` com JSON Schema e validação Zod defensiva.
- Durações são exatamente 15 s = 8+7, 20 s = 10+10, 30 s = 10+10+10.
- Nenhum teste automatizado chama a API real.
- Toda feature e correção segue RED → GREEN → REFACTOR; cada teste deve falhar pelo motivo esperado antes da implementação.
- Commits não incluem `.env`, banco SQLite, uploads staged, chaves ou senhas.

## Mapa de arquivos

### Fundação

- `package.json`: scripts, dependências e allowlist de build nativo do pnpm.
- `next.config.ts`: standalone, tracing de recursos e pacotes server-only.
- `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`: testes.
- `.env.example`: contrato de ambiente sem segredos reais.
- `src/lib/env.ts`: parsing server-only do ambiente.
- `src/app/api/health/route.ts`: health check público mínimo.

### Autenticação

- `src/features/auth/session.ts`: criar e verificar JWT de sessão.
- `src/features/auth/credentials.ts`: comparação constante de credenciais.
- `src/features/auth/rate-limit.ts`: limite de tentativas em memória.
- `src/features/auth/request-guard.ts`: sessão e origem em Route Handlers.
- `src/features/auth/login-handler.ts`: handler injetável de login.
- `src/proxy.ts`: redirecionamento de páginas privadas no Next.js 16.
- `src/app/login/page.tsx`, `src/features/auth/login-form.tsx`: login.
- `src/app/(app)/layout.tsx`, `src/components/app-shell.tsx`: área autenticada.

### Banco e configurações

- `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/**`: schema e migração.
- `src/generated/prisma/**`: cliente gerado no install/build, não editado manualmente.
- `src/lib/db.ts`: singleton Prisma com adapter better-sqlite3.
- `src/features/settings/crypto.ts`: AES-256-GCM.
- `src/features/settings/veo-template.ts`: validação e renderização do template.
- `src/features/settings/repository.ts`: porta e adapter Prisma.
- `src/features/settings/service.ts`: regras de leitura mascarada e atualização.
- `src/app/api/settings/**`: APIs autenticadas.
- `src/app/(app)/configuracoes/page.tsx`, `src/features/settings/settings-form.tsx`: interface.

### Biblioteca mestra

- `resources/library/Biblioteca_Mestra_Copys_TikTok_Shop.xlsx`: fonte inicial copiada.
- `resources/library/library.default.json`: corpus inicial convertido.
- `scripts/build-library.ts`: conversão reprodutível.
- `src/features/library/schema.ts`: tipos e schemas normalizados.
- `src/features/library/workbook.ts`: leitura e validação do XLSX.
- `src/features/library/serialize.ts`: JSON e hash estáveis.
- `src/features/library/select.ts`: filtro determinístico por produto/categoria/mecanismo.
- `src/features/library/storage.ts`: staging e arquivos finais sob `DATA_DIR`.
- `src/features/library/repository.ts`: metadados Prisma.
- `src/features/library/service.ts`: stage, activate, rollback e snapshot ativo.
- `src/app/api/library/**`: APIs autenticadas.
- `src/features/library/library-settings.tsx`: upload, prévia, ativação e rollback.

### Geração

- `src/features/generation/schema.ts`: inputs, output e envelope público.
- `src/features/generation/json-schema.ts`: formato Anthropic derivado do schema Zod.
- `src/features/generation/system-prompt.ts`: prompt do briefing adaptado para structured output.
- `src/features/generation/prompt-builder.ts`: system/user blocks estáveis.
- `src/features/generation/validation.ts`: bloqueios e avisos.
- `src/features/generation/anthropic-port.ts`: porta injetável e adapter SDK.
- `src/features/generation/service.ts`: orquestração completa.
- `src/features/generation/generate-handler.ts`: parsing multipart e mapeamento HTTP.
- `src/app/api/generate/route.ts`: Route Handler fino.

### Navegador e UI

- `src/features/draft/schema.ts`, `src/features/draft/storage.ts`: localStorage e IndexedDB.
- `src/features/uploads/resize.ts`, `src/features/uploads/upload-field.tsx`: redução e referências.
- `src/features/wizard/product-step.tsx`, `references-step.tsx`, `direction-step.tsx`, `generation-wizard.tsx`: formulário.
- `src/features/results/result-card.tsx`, `result-summary.tsx`, `copy-button.tsx`: resultados.
- `src/app/(app)/page.tsx`, `src/app/(app)/resultado/[id]/page.tsx`: páginas.

### Operação e testes

- `tests/fixtures/creative-result.ts`: fixtures coerentes.
- `tests/e2e/auth-settings-generation.spec.ts`: fluxo principal.
- `tests/e2e/library-import.spec.ts`: importação e rollback.
- `README.md`: desenvolvimento e operação local.
- `docs/aaPanel.md`: instruções futuras de publicação.

---

### Task 1: Scaffold, ambiente e health check

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `src/lib/env.ts`, `src/lib/env.test.ts`
- Create: `src/app/api/health/route.ts`, `src/app/api/health/route.test.ts`

**Interfaces:**
- Consumes: nenhuma interface de aplicação anterior.
- Produces: `getServerEnv(source?: NodeJS.ProcessEnv): ServerEnv` e `GET(): Promise<Response>` em `/api/health`.

- [ ] **Step 1: Gerar somente a fundação e instalar dependências**

Use um scaffold temporário para preservar `docs/` e `.git`, copie os arquivos gerados e remova o temporário. Em seguida instale as dependências exatas por nome; o lockfile fixará as versões resolvidas.

```powershell
pnpm dlx create-next-app@latest ..\gerador-criativos-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
Copy-Item ..\gerador-criativos-scaffold\src .\src -Recurse
Copy-Item ..\gerador-criativos-scaffold\public .\public -Recurse
Copy-Item ..\gerador-criativos-scaffold\package.json, ..\gerador-criativos-scaffold\tsconfig.json, ..\gerador-criativos-scaffold\next.config.ts, ..\gerador-criativos-scaffold\postcss.config.mjs, ..\gerador-criativos-scaffold\eslint.config.mjs .
pnpm install
pnpm add @anthropic-ai/sdk @hookform/resolvers @prisma/adapter-better-sqlite3 @prisma/client better-sqlite3 exceljs idb jose lucide-react react-hook-form zod
pnpm add -D @playwright/test @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/better-sqlite3 @types/node @types/react @types/react-dom fake-indexeddb jsdom prisma tsx typescript vitest
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add alert accordion badge button card checkbox dialog input label progress radio-group select separator sonner switch tabs textarea
```

Set `package.json#pnpm.onlyBuiltDependencies` to `["better-sqlite3"]` and scripts to:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node .next/standalone/server.js",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "db:migrate": "prisma migrate deploy",
    "library:build": "tsx scripts/build-library.ts"
  },
  "pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }
}
```

- [ ] **Step 2: Escrever testes falhos para ambiente e health**

```ts
// src/lib/env.test.ts
import { describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

describe("getServerEnv", () => {
  it("rejeita segredos ausentes", () => {
    expect(() => getServerEnv({ NODE_ENV: "test" })).toThrow(/ADMIN_USERNAME/);
  });

  it("aceita uma configuração completa", () => {
    const env = getServerEnv({
      NODE_ENV: "test",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "senha-segura",
      AUTH_SECRET: "a".repeat(32),
      SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      DATA_DIR: "./data-test",
    });
    expect(env.DATA_DIR.endsWith("data-test")).toBe(true);
  });
});
```

```ts
// src/app/api/health/route.test.ts
import { expect, it } from "vitest";
import { GET } from "./route";

it("expõe somente o estado do processo", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
```

- [ ] **Step 3: Rodar RED**

Run: `pnpm test src/lib/env.test.ts src/app/api/health/route.test.ts`

Expected: FAIL porque `env.ts` e a rota health ainda não existem.

- [ ] **Step 4: Implementar ambiente, health e configuração standalone**

```ts
// src/lib/env.ts
import "server-only";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(12),
  AUTH_SECRET: z.string().min(32),
  SETTINGS_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, "base64").length === 32, "deve ter 32 bytes em base64"),
  DATA_DIR: z.string().default("./data"),
  DATABASE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema> & { DATA_DIR: string };

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = schema.parse(source);
  return { ...parsed, DATA_DIR: path.resolve(parsed.DATA_DIR) };
}
```

```ts
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok" });
}
```

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  outputFileTracingIncludes: { "/*": ["./resources/library/**/*"] },
};
export default nextConfig;
```

`.env.example` deve conter nomes e valores seguros de exemplo, inclusive `DATA_DIR=./data`, sem chave Anthropic. `.gitignore` deve ignorar `.env*` exceto `.env.example`, `/data/`, `/src/generated/prisma/`, `/test-results/` e `/playwright-report/`.

Configure Vitest e Testing Library:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], restoreMocks: true },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

Substitua o conteúdo visual do scaffold por um primeiro viewport reconhecível: título “Estúdio de Criativos”, descrição do fluxo e card “Produto → Referências → Direção”. Em `globals.css`, defina fundo `#f7f3ee`, superfície branca, texto `#201a22`, coral `#ef6a5b` e roxo `#6f52d9`, preservando contraste AA e foco visível.

- [ ] **Step 5: Rodar GREEN, lint e build inicial**

Run: `pnpm test src/lib/env.test.ts src/app/api/health/route.test.ts && pnpm lint && pnpm build`

Expected: testes PASS, lint sem erros, build concluído.

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts .env.example .gitignore src public components.json
git commit -m "chore: scaffold secure Next.js application"
```

---

### Task 2: Autenticação de administrador e área protegida

**Files:**
- Create: `src/features/auth/session.ts`, `session.test.ts`
- Create: `src/features/auth/credentials.ts`, `credentials.test.ts`
- Create: `src/features/auth/rate-limit.ts`, `rate-limit.test.ts`
- Create: `src/features/auth/request-guard.ts`, `request-guard.test.ts`
- Create: `src/features/auth/login-handler.ts`, `login-handler.test.ts`
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Create: `src/proxy.ts`, `src/app/login/page.tsx`, `src/features/auth/login-form.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/components/app-shell.tsx`
- Modify: `src/app/page.tsx` → mover para `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `getServerEnv()`.
- Produces: `createSessionToken(input, secret)`, `verifySessionToken(token, secret)`, `requireSession(request)`, `enforceSameOrigin(request)` e `makeLoginHandler(deps)`.

- [ ] **Step 1: Escrever testes falhos da sessão, credenciais e rate limit**

```ts
it("expira a sessão depois de 12 horas", async () => {
  const secret = "s".repeat(32);
  const token = await createSessionToken({ username: "admin", now: new Date("2026-08-21T10:00:00Z") }, secret);
  await expect(verifySessionToken(token, secret, new Date("2026-08-21T22:00:01Z"))).resolves.toBeNull();
});

it("compara credenciais sem revelar qual campo falhou", async () => {
  expect(await authenticateAdmin({ username: "admin", password: "certa" }, { username: "admin", password: "certa" })).toBe(true);
  expect(await authenticateAdmin({ username: "admin", password: "errada" }, { username: "admin", password: "certa" })).toBe(false);
});

it("bloqueia a sexta falha por quinze minutos", () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 });
  for (let index = 0; index < 5; index += 1) limiter.recordFailure("127.0.0.1", index);
  expect(limiter.check("127.0.0.1", 5).allowed).toBe(false);
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/auth`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar o domínio de autenticação**

Use `jose` com HS256 e claims `sub`, `iat`, `exp`; compare hashes SHA-256 com `timingSafeEqual`; mantenha buckets do rate limit em `Map<string, number[]>`.

```ts
export const SESSION_COOKIE = "creative_session";
export type Session = { username: string };
export async function createSessionToken(input: { username: string; now?: Date }, secret: string): Promise<string>;
export async function verifySessionToken(token: string, secret: string, now?: Date): Promise<Session | null>;
export async function requireSession(request: Request): Promise<Session>;
export function enforceSameOrigin(request: Request): void;
```

`enforceSameOrigin` deve aceitar ausência de `Origin` somente em `NODE_ENV=test`; nos demais ambientes, comparar `Origin` com `new URL(request.url).origin`.

- [ ] **Step 4: Testar o handler de login antes da rota**

```ts
it("emite cookie HttpOnly sem expor motivo de falha", async () => {
  const handler = makeLoginHandler({
    expected: { username: "admin", password: "senha-correta" },
    secret: "x".repeat(32),
    limiter: new LoginRateLimiter({ maxAttempts: 5, windowMs: 900_000 }),
    now: () => new Date("2026-08-21T12:00:00Z"),
  });
  const response = await handler(new Request("http://local/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://local" },
    body: JSON.stringify({ username: "admin", password: "senha-correta" }),
  }));
  expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
  expect(response.status).toBe(204);
});
```

Run: `pnpm test src/features/auth/login-handler.test.ts`

Expected: FAIL até `makeLoginHandler` existir.

- [ ] **Step 5: Implementar rotas, proxy e interface**

`POST /api/auth/login` usa o handler com env real. `POST /api/auth/logout` exige origem válida e expira o cookie. `src/proxy.ts` protege `/`, `/resultado/:path*` e `/configuracoes/:path*`; APIs continuam validando sessão dentro dos próprios handlers.

`LoginForm` contém usuário, senha, estado de envio e uma única mensagem “Credenciais inválidas ou acesso temporariamente bloqueado”. `AppShell` fornece links Nova geração, Configurações e Sair, com navegação por teclado.

- [ ] **Step 6: Rodar suíte e build**

Run: `pnpm test src/features/auth && pnpm lint && pnpm build`

Expected: PASS sem logs de senha ou cookie.

- [ ] **Step 7: Commit**

```powershell
git add src/features/auth src/app/api/auth src/app/login src/app/'(app)' src/components/app-shell.tsx src/proxy.ts
git commit -m "feat: add single-admin authentication"
```

---

### Task 3: Prisma, criptografia e domínio de configurações

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/20260821_init/migration.sql`
- Create: `src/lib/db.ts`
- Create: `src/features/settings/crypto.ts`, `crypto.test.ts`
- Create: `src/features/settings/veo-template.ts`, `veo-template.test.ts`
- Create: `src/features/settings/repository.ts`, `repository.integration.test.ts`
- Create: `src/features/settings/service.ts`, `service.test.ts`

**Interfaces:**
- Consumes: `getServerEnv()`.
- Produces: `encryptSecret`, `decryptSecret`, `validateVeoTemplate`, `renderVeoTemplate`, `SettingsRepository`, `PrismaSettingsRepository` e `SettingsService`.

- [ ] **Step 1: Escrever testes falhos de criptografia e template**

```ts
it("cifra com IV distinto e recupera o segredo", () => {
  const key = Buffer.alloc(32, 1);
  const first = encryptSecret("sk-ant-teste", key);
  const second = encryptSecret("sk-ant-teste", key);
  expect(first.ciphertext).not.toBe(second.ciphertext);
  expect(decryptSecret(first, key)).toBe("sk-ant-teste");
});

it("rejeita variável VEO desconhecida", () => {
  expect(validateVeoTemplate("Fale {{copy_completa}} e {{variavel_inventada}}")).toEqual({
    valid: false,
    unknown: ["variavel_inventada"],
  });
});

it("renderiza copy completa sem marcadores pendentes", () => {
  const output = renderVeoTemplate("Produto {{produto}}\nFala: {{copy_completa}}", {
    produto: "Body splash",
    copy_completa: "Trecho um Trecho dois",
    copy_trecho1: "Trecho um",
    copy_trecho2: "Trecho dois",
    pov: "✨ Cheiro de presença",
    ambiente: "Quarto",
    figurino: "Conjunto casual",
    pose: "Em pé",
    prompt_gemini: "PROMPT",
  });
  expect(output).toContain("Fala: Trecho um Trecho dois");
  expect(output).not.toMatch(/{{/);
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/settings/crypto.test.ts src/features/settings/veo-template.test.ts`

Expected: FAIL por exports ausentes.

- [ ] **Step 3: Criar schema Prisma e migração**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db { provider = "sqlite" }

enum LibraryStatus { ACTIVE PREVIOUS STAGED }

model AppSettings {
  id                     String   @id @default("singleton")
  anthropicKeyCiphertext String?
  anthropicKeyIv         String?
  anthropicKeyTag        String?
  anthropicKeyVersion    Int?
  anthropicKeyLastFour   String?
  anthropicModel         String   @default("claude-sonnet-5")
  veoTemplate            String
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

model LibraryVersion {
  id                String        @id @default(cuid())
  sourceFilename    String
  sourceSha256      String
  recordCount       Int
  workbookPath      String
  jsonPath          String
  status            LibraryStatus
  validationSummary Json
  createdAt         DateTime      @default(now())
  activatedAt       DateTime?
  @@index([status])
}
```

`prisma.config.ts` usa `DATABASE_URL` quando definido e, caso contrário, `file:${path.resolve(DATA_DIR ?? "./data", "app.db")}`. Gere a migração com `pnpm prisma migrate dev --name init` e inspecione que ela cria somente as duas tabelas e o índice.

Nesta etapa, altere o script `build` para `prisma generate && next build`, pois o schema Prisma agora existe.

- [ ] **Step 4: Implementar crypto, template e repository**

```ts
export type EncryptedSecret = { ciphertext: string; iv: string; tag: string; version: 1 };
export function encryptSecret(plain: string, key: Buffer): EncryptedSecret;
export function decryptSecret(payload: EncryptedSecret, key: Buffer): string;

export const VEO_VARIABLES = ["produto", "copy_completa", "copy_trecho1", "copy_trecho2", "pov", "ambiente", "figurino", "pose", "prompt_gemini"] as const;
export type VeoVariables = Record<(typeof VEO_VARIABLES)[number], string>;
export function validateVeoTemplate(template: string): { valid: true; unknown: [] } | { valid: false; unknown: string[] };
export function renderVeoTemplate(template: string, values: VeoVariables): string;
```

```ts
export type SettingsRecord = {
  encryptedApiKey: EncryptedSecret | null;
  apiKeyLastFour: string | null;
  model: string;
  veoTemplate: string;
  updatedAt: Date;
};

export interface SettingsRepository {
  getOrCreate(defaultTemplate: string): Promise<SettingsRecord>;
  update(input: { encryptedApiKey?: EncryptedSecret; apiKeyLastFour?: string; model: string; veoTemplate: string }): Promise<SettingsRecord>;
  deleteApiKey(): Promise<void>;
}
```

- [ ] **Step 5: Testar e implementar SettingsService**

```ts
it("nunca devolve a chave completa", async () => {
  const repository = new InMemorySettingsRepository();
  const service = new SettingsService(repository, Buffer.alloc(32, 4));
  await service.update({ apiKey: "sk-ant-1234567890", model: "claude-sonnet-5", veoTemplate: "{{copy_completa}}" });
  expect(await service.getPublic()).toMatchObject({ apiKeyConfigured: true, apiKeyMask: "••••7890" });
  expect(JSON.stringify(await service.getPublic())).not.toContain("sk-ant-");
});
```

`SettingsService` deve expor `getPublic()`, `update(input)`, `deleteApiKey()` e `getGenerationSettings()`; somente o último descriptografa a chave e é server-only.

- [ ] **Step 6: Rodar migração e testes**

Run: `pnpm prisma generate && pnpm test src/features/settings && pnpm prisma migrate deploy`

Expected: PASS; banco de desenvolvimento criado sob `DATA_DIR`, ignorado pelo Git.

- [ ] **Step 7: Commit**

```powershell
git add prisma prisma.config.ts src/lib/db.ts src/features/settings package.json pnpm-lock.yaml
git commit -m "feat: persist encrypted generation settings"
```

---

### Task 4: APIs e interface de configurações

**Files:**
- Create: `src/features/settings/settings-handler.ts`, `settings-handler.test.ts`
- Create: `src/app/api/settings/route.ts`, `src/app/api/settings/api-key/route.ts`
- Create: `src/app/(app)/configuracoes/page.tsx`
- Create: `src/features/settings/settings-form.tsx`, `settings-form.test.tsx`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Consumes: `SettingsService`, `requireSession`, `enforceSameOrigin`.
- Produces: `makeSettingsHandlers(deps)` e `SettingsForm`.

- [ ] **Step 1: Escrever teste falho dos handlers**

```ts
it("GET devolve apenas configuração pública", async () => {
  const handlers = makeSettingsHandlers({ service: fakeService, requireSession: async () => ({ username: "admin" }), enforceSameOrigin: () => undefined });
  const response = await handlers.GET(new Request("http://local/api/settings"));
  expect(await response.json()).toEqual({
    apiKeyConfigured: true,
    apiKeyMask: "••••7890",
    model: "claude-sonnet-5",
    veoTemplate: "{{copy_completa}}",
    updatedAt: "2026-08-21T12:00:00.000Z",
  });
});
```

- [ ] **Step 2: Rodar RED e implementar handler factory**

Run: `pnpm test src/features/settings/settings-handler.test.ts`

Expected: FAIL; depois implemente `GET`, `PUT` e `DELETE_API_KEY` com schemas Zod, status 401/403/422 e sem serializar erros internos.

- [ ] **Step 3: Escrever teste falho da interface**

```tsx
it("mostra chave mascarada e prévia do template", async () => {
  render(<SettingsForm initial={publicSettingsFixture} onSave={vi.fn()} onDeleteKey={vi.fn()} />);
  expect(screen.getByText("••••7890")).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("Template VEO 3"));
  await userEvent.type(screen.getByLabelText("Template VEO 3"), "Fala: {{{{copy_completa}}}}");
  expect(screen.getByText(/Fala:/)).toBeInTheDocument();
});
```

- [ ] **Step 4: Implementar página e formulário**

Organize as tabs “Credencial”, “Modelo”, “Prompt VEO 3” e reserve “Biblioteca” para Task 6. Nunca preencha o campo da chave com o segredo salvo. A prévia usa fixture local e o mesmo `validateVeoTemplate`/`renderVeoTemplate` em código compartilhável sem imports server-only.

- [ ] **Step 5: Rodar testes e build**

Run: `pnpm test src/features/settings && pnpm lint && pnpm build`

Expected: PASS e nenhuma ocorrência de `anthropicKeyCiphertext` em `.next/static`.

- [ ] **Step 6: Commit**

```powershell
git add src/features/settings src/app/api/settings src/app/'(app)'/configuracoes src/components/app-shell.tsx
git commit -m "feat: add secure settings interface"
```

---

### Task 5: Conversor, schema e seleção da biblioteca

**Files:**
- Create: `src/features/library/schema.ts`
- Create: `src/features/library/workbook.ts`, `workbook.test.ts`
- Create: `src/features/library/serialize.ts`, `serialize.test.ts`
- Create: `src/features/library/select.ts`, `select.test.ts`
- Create: `scripts/build-library.ts`
- Create: `resources/library/Biblioteca_Mestra_Copys_TikTok_Shop.xlsx`
- Create: `resources/library/library.default.json`

**Interfaces:**
- Consumes: planilha-base aprovada.
- Produces: `parseLibraryWorkbook(buffer)`, `serializeCorpus(corpus)`, `selectLibraryContext(corpus, query)` e `LibraryCorpus`.

- [ ] **Step 1: Escrever workbook fixture e teste falho**

```ts
it("converte um workbook válido e rejeita ID duplicado", async () => {
  const valid = await buildWorkbookFixture([{ id: "1", produto: "Body splash", mecanismo: "Depoimento pessoal" }]);
  await expect(parseLibraryWorkbook(valid)).resolves.toMatchObject({ creatives: [{ id: "1" }] });

  const duplicate = await buildWorkbookFixture([
    { id: "1", produto: "Body splash", mecanismo: "Depoimento pessoal" },
    { id: "1", produto: "Body splash", mecanismo: "Benefícios" },
  ]);
  await expect(parseLibraryWorkbook(duplicate)).rejects.toThrow(/ID duplicado/);
});
```

O fixture cria as oito abas; `Catalogo` usa exatamente os 23 cabeçalhos da planilha original. `Resumo`, `Playbook` e `Hashtags` precisam conter pelo menos uma linha editorial não vazia.

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/library/workbook.test.ts`

Expected: FAIL por parser ausente.

- [ ] **Step 3: Implementar schema e parser**

```ts
export const libraryCreativeSchema = z.object({
  id: z.string().min(1),
  produto: z.string().min(1),
  status: z.string(),
  confianca: z.string(),
  mecanismo: z.string().min(1),
  tipoHook: z.string(),
  hook: z.string().nullable(),
  corpo: z.string().nullable(),
  prova: z.string().nullable(),
  objecao: z.string().nullable(),
  oferta: z.string().nullable(),
  tipoCta: z.string(),
  cta: z.string().nullable(),
  descricao: z.string().nullable(),
  hashtags: z.array(z.string()),
  formulaAdaptavel: z.string().nullable(),
  risco: z.string(),
  notas: z.string(),
  url: z.string().nullable(),
});

export type LibraryCorpus = {
  schemaVersion: 1;
  sourceSha256: string;
  summary: { recordCount: number; products: Record<string, number>; mechanisms: Record<string, number>; statuses: Record<string, number> };
  playbook: string[];
  hashtagPatterns: string[];
  creatives: LibraryCreative[];
};
```

Não inclua timestamp dentro do conteúdo usado para cache. Normalize Unicode para NFC, remova zero-width chars dos IDs, preserve acentos editoriais e ordene criativos por ID.

- [ ] **Step 4: Testar serialização e seleção determinística**

```ts
it("produz os mesmos bytes para o mesmo corpus", () => {
  expect(serializeCorpus(corpusFixture)).toBe(serializeCorpus(structuredClone(corpusFixture)));
});

it("prioriza o mesmo produto e completa por mecanismo", () => {
  const selected = selectLibraryContext(corpusFixture, { produto: "Kit body splash masculino", categoria: "perfumaria", limit: 12 });
  expect(selected.creatives[0].produto.toLowerCase()).toContain("body splash");
  expect(new Set(selected.creatives.map((item) => item.mecanismo)).size).toBeGreaterThan(1);
});
```

- [ ] **Step 5: Copiar a fonte, gerar JSON e validar 75 registros**

```powershell
Copy-Item 'D:\Projetos\TiktokShop\outputs\copy-library-20260819\Biblioteca_Mestra_Copys_TikTok_Shop.xlsx' 'resources\library\Biblioteca_Mestra_Copys_TikTok_Shop.xlsx'
pnpm library:build
```

O script deve falhar com exit code 1 se o corpus não tiver 75 registros na fonte inicial. O arquivo JSON é salvo por escrita temporária seguida de rename.

- [ ] **Step 6: Rodar testes**

Run: `pnpm test src/features/library && pnpm library:build`

Expected: PASS; saída informa 75 registros e hash SHA-256.

- [ ] **Step 7: Commit**

```powershell
git add src/features/library scripts/build-library.ts resources/library package.json pnpm-lock.yaml
git commit -m "feat: add deterministic creative library corpus"
```

---

### Task 6: Versionamento, importação e rollback da biblioteca

**Files:**
- Create: `src/features/library/storage.ts`, `storage.test.ts`
- Create: `src/features/library/repository.ts`, `repository.integration.test.ts`
- Create: `src/features/library/service.ts`, `service.test.ts`
- Create: `src/features/library/library-handler.ts`, `library-handler.test.ts`
- Create: `src/app/api/library/status/route.ts`
- Create: `src/app/api/library/import/route.ts`
- Create: `src/app/api/library/activate/route.ts`
- Create: `src/app/api/library/rollback/route.ts`
- Create: `src/features/library/library-settings.tsx`, `library-settings.test.tsx`
- Modify: `src/features/settings/settings-form.tsx`

**Interfaces:**
- Consumes: `parseLibraryWorkbook`, `serializeCorpus`, Prisma e guardas de autenticação.
- Produces: `LibraryStorage`, `LibraryRepository`, `LibraryService`, APIs e `LibrarySettings`.

- [ ] **Step 1: Escrever testes falhos de storage e ativação**

```ts
it("não altera a versão ativa quando a planilha falha", async () => {
  const service = makeLibraryServiceWithActive(activeCorpusFixture);
  await expect(service.stage({ filename: "ruim.xlsx", bytes: Buffer.from("não é xlsx") })).rejects.toThrow();
  expect((await service.getStatus()).active?.sourceSha256).toBe(activeCorpusFixture.sourceSha256);
});

it("ativa staged e permite rollback", async () => {
  const service = makeLibraryServiceWithActive(activeCorpusFixture);
  const staged = await service.stage({ filename: "nova.xlsx", bytes: await buildValidWorkbookBytes("2") });
  await service.activate(staged.importId);
  expect((await service.getStatus()).active?.sourceSha256).toBe(staged.preview.sourceSha256);
  await service.rollback();
  expect((await service.getStatus()).active?.sourceSha256).toBe(activeCorpusFixture.sourceSha256);
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/library/storage.test.ts src/features/library/service.test.ts`

Expected: FAIL por classes ausentes.

- [ ] **Step 3: Implementar portas e serviço**

```ts
export interface LibraryStorage {
  writeStaged(input: { importId: string; workbook: Buffer; json: string }): Promise<{ workbookPath: string; jsonPath: string }>;
  promote(importId: string): Promise<{ workbookPath: string; jsonPath: string }>;
  readJson(path: string): Promise<LibraryCorpus>;
  verify(path: string, sha256: string): Promise<boolean>;
  remove(paths: string[]): Promise<void>;
  cleanupStaged(olderThan: Date): Promise<void>;
}

export interface LibraryRepository {
  getStatus(): Promise<{ active: LibraryVersionRecord | null; previous: LibraryVersionRecord | null }>;
  createStaged(input: StagedLibraryRecord): Promise<LibraryVersionRecord>;
  activate(id: string, promoted: { workbookPath: string; jsonPath: string }, now: Date): Promise<{ active: LibraryVersionRecord; obsolete: LibraryVersionRecord[] }>;
  rollback(now: Date): Promise<{ active: LibraryVersionRecord; previous: LibraryVersionRecord }>;
}
```

`LibraryService.stage` limita 20 MB, valida XLSX, calcula diff de IDs e retorna `LibraryImportPreview`. `activate` recalcula hash antes da transação. `getActiveSnapshot` lê uma vez e devolve objeto imutável para toda a geração.

- [ ] **Step 4: Testar handlers autenticados**

```ts
it("import aceita multipart e devolve prévia sem ativar", async () => {
  const form = new FormData();
  form.set("file", new File([validWorkbookBytes], "biblioteca.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const response = await handlers.IMPORT(new Request("http://local/api/library/import", { method: "POST", body: form }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ preview: { recordCount: 1, added: ["2"] } });
});
```

- [ ] **Step 5: Implementar interface de biblioteca**

`LibrarySettings` mostra ativa/anterior, input `.xlsx`, limite de 20 MB, prévia de contagens/diff, botão “Ativar biblioteca” somente após validação e dialog de confirmação para rollback. Erro bloqueante deixa a versão ativa visível e inalterada.

- [ ] **Step 6: Seed inicial e testes completos**

Na primeira chamada de `getStatus`, se não houver ACTIVE, copie os recursos default para `DATA_DIR/library/versions/<hash>/` e crie o registro ACTIVE. Teste concorrência serializando `activate`/`rollback` com um mutex em processo.

Run: `pnpm test src/features/library && pnpm lint && pnpm build`

Expected: PASS; build inclui `resources/library` no trace.

- [ ] **Step 7: Commit**

```powershell
git add src/features/library src/app/api/library src/features/settings/settings-form.tsx
git commit -m "feat: manage versioned library imports"
```

---

### Task 7: Contrato de geração e validador editorial

**Files:**
- Create: `src/features/generation/schema.ts`, `schema.test.ts`
- Create: `src/features/generation/json-schema.ts`, `json-schema.test.ts`
- Create: `src/features/generation/system-prompt.ts`
- Create: `src/features/generation/validation.ts`, `validation.test.ts`
- Create: `tests/fixtures/creative-result.ts`

**Interfaces:**
- Consumes: `renderVeoTemplate`.
- Produces: `generationInputSchema`, `creativeBatchSchema`, `GenerationEnvelope`, `getAnthropicOutputFormat()` e `validateCreativeBatch(input, batch, template)`.

- [ ] **Step 1: Escrever fixture e testes falhos do contrato**

```ts
it.each([
  [15, [8, 7, null]],
  [20, [10, 10, null]],
  [30, [10, 10, 10]],
])("aceita duração %s apenas com segmentos corretos", (duration, seconds) => {
  const input = generationInputFixture({ duracaoTotal: duration });
  const batch = creativeBatchFixture({ segmentSeconds: seconds });
  expect(() => validateCreativeBatch(input, batch, "{{copy_completa}}")).not.toThrow();
});

it("bloqueia preço na política sem preço", () => {
  const report = validateCreativeBatch(
    generationInputFixture({ politicaPreco: "sem_preco" }),
    creativeBatchFixture({ trecho1: "Eu paguei R$ 29,90 e gostei." }),
    "{{copy_completa}}",
  );
  expect(report.creatives[0].issues).toContainEqual(expect.objectContaining({ code: "PRICE_FORBIDDEN", severity: "block" }));
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/generation`

Expected: FAIL por schemas/validador ausentes.

- [ ] **Step 3: Implementar schemas Zod**

```ts
export const copySegmentSchema = z.object({ texto: z.string().min(1), palavras: z.number().int().nonnegative(), segundos: z.number().int() });
export const creativeSchema = z.object({
  id: z.string().min(1), angulo: z.string(), ambiente: z.string(), figurino: z.string(), pose: z.string(), promptGemini: z.string(),
  copy: z.object({ trecho1: copySegmentSchema, trecho2: copySegmentSchema, trecho3: copySegmentSchema.nullable() }),
  descricao: z.string(), hashtags: z.array(z.string()),
  pov: z.object({ texto: z.string(), palavras: z.number().int(), emoji: z.string() }),
  textoNaTela: z.string().nullable(), descartavel: z.boolean(), motivoDescartavel: z.string().nullable(),
});
```

Defina todos os objetos com `.strict()`. `GenerationEnvelope` acrescenta `veoPrompt`, contagens reais, issues por campo, status e `settingsUpdatedAt`, sem incluir segredos.

- [ ] **Step 4: Implementar JSON Schema e prompt do sistema**

Use o helper Zod do SDK quando disponível; teste que o resultado contém `additionalProperties: false` recursivamente e que `trecho3` aceita objeto ou null. `SYSTEM_PROMPT` deve reproduzir o briefing aprovado e terminar com “Retorne somente o objeto que corresponda ao schema configurado em output_config.format.”

- [ ] **Step 5: Implementar validações determinísticas**

Exporte funções puras:

```ts
export function countWords(text: string): number;
export function countEmoji(text: string): number;
export function containsMoney(text: string): boolean;
export function requiredGeminiBlocks(prompt: string): string[];
export function validateCreativeBatch(input: GenerationInput, batch: CreativeBatch, veoTemplate: string): GenerationEnvelope;
```

Teste os nove blocos, termos de remoção de roupa, hashtags, dígitos, emoji, limites 13–20/14–22/18–28, contagem declarada, ambiente repetido e duplicidade simultânea de ambiente+pose+hashtags.

- [ ] **Step 6: Rodar suíte**

Run: `pnpm test src/features/generation`

Expected: PASS com dez fixtures `sem_preco` bloqueando qualquer valor monetário.

- [ ] **Step 7: Commit**

```powershell
git add src/features/generation tests/fixtures/creative-result.ts
git commit -m "feat: validate structured creative packages"
```

---

### Task 8: Gateway Anthropic, prompt e API de geração

**Files:**
- Create: `src/features/generation/anthropic-port.ts`, `anthropic-port.test.ts`
- Create: `src/features/generation/prompt-builder.ts`, `prompt-builder.test.ts`
- Create: `src/features/generation/service.ts`, `service.test.ts`
- Create: `src/features/generation/generate-handler.ts`, `generate-handler.test.ts`
- Create: `src/app/api/generate/route.ts`

**Interfaces:**
- Consumes: `SettingsService.getGenerationSettings`, `LibraryService.getActiveSnapshot`, schemas e validador.
- Produces: `AnthropicPort.generate`, `AnthropicSdkAdapter`, `GenerationService.generate` e `makeGenerateHandler`.

- [ ] **Step 1: Escrever teste falho do prompt cacheável**

```ts
it("mantém biblioteca estável antes dos dados variáveis", () => {
  const prompt = buildAnthropicPrompt({ input: generationInputFixture(), library: libraryContextFixture, images: [] });
  expect(prompt.system[1]).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
  expect(prompt.system[1].text).not.toContain(generationInputFixture().nomeProduto);
  expect(prompt.messages[0].content.at(-1)).toMatchObject({ type: "text" });
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/generation/prompt-builder.test.ts src/features/generation/service.test.ts`

Expected: FAIL por gateway e service ausentes.

- [ ] **Step 3: Implementar porta e adapter**

```ts
export type AnthropicRequest = { model: string; system: Anthropic.TextBlockParam[]; messages: Anthropic.MessageParam[] };
export type AnthropicResult = { batch: CreativeBatch; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } };
export interface AnthropicPort { generate(apiKey: string, request: AnthropicRequest, signal: AbortSignal): Promise<AnthropicResult>; }
```

`AnthropicSdkAdapter` cria cliente por chamada com a chave descriptografada, usa `messages.create({ model, max_tokens: 16000, system, messages, output_config: getAnthropicOutputFormat() }, { signal })`, trata `stop_reason === "refusal"`, extrai o bloco text e valida JSON com Zod.

Um `FakeAnthropicAdapter` só pode ser selecionado quando `NODE_ENV !== "production"` e `E2E_FAKE_ANTHROPIC=1`.

- [ ] **Step 4: Testar orquestração sem chamada real**

```ts
it("gera, valida e renderiza VEO sem expor a chave", async () => {
  const gateway = new FakeAnthropicPort(creativeBatchFixture());
  const result = await new GenerationService(settingsServiceFake("sk-ant-secret"), libraryServiceFake(), gateway)
    .generate({ input: generationInputFixture(), images: [] });
  expect(result.criativos[0].veoPrompt).toContain(result.criativos[0].copy.trecho1.texto);
  expect(JSON.stringify(result)).not.toContain("sk-ant-secret");
});
```

Teste também API ausente, credencial inválida, 429, recusa, timeout e JSON inválido. Mapeie para códigos `API_NOT_CONFIGURED`, `INVALID_API_KEY`, `RATE_LIMITED`, `REFUSAL`, `TIMEOUT`, `INVALID_MODEL_OUTPUT`, `UPSTREAM_UNAVAILABLE`.

- [ ] **Step 5: Testar e implementar multipart handler**

```ts
it("ignora fotos UGC e aceita somente produto/anúncio", async () => {
  const form = new FormData();
  form.set("payload", JSON.stringify(generationInputFixture()));
  form.append("ugc", jpegFile("ugc.jpg"));
  form.append("product", jpegFile("produto.jpg"));
  const response = await handler(new Request("http://local/api/generate", { method: "POST", body: form }));
  expect(service.generate).toHaveBeenCalledWith(expect.objectContaining({ images: [expect.objectContaining({ role: "product" })] }));
  expect(response.status).toBe(200);
});
```

Valide magic bytes de JPEG/PNG/WEBP, máximo de 8 produto + 5 anúncio, máximo de 3 MB por arquivo redimensionado e timeout via `AbortSignal.timeout(100_000)`.

- [ ] **Step 6: Rodar suíte e build**

Run: `pnpm test src/features/generation src/app/api/generate && pnpm lint && pnpm build`

Expected: PASS e nenhuma chamada de rede.

- [ ] **Step 7: Commit**

```powershell
git add src/features/generation src/app/api/generate
git commit -m "feat: generate creatives through Claude"
```

---

### Task 9: Persistência do navegador e redimensionamento de imagens

**Files:**
- Create: `src/features/draft/schema.ts`
- Create: `src/features/draft/storage.ts`, `storage.test.ts`
- Create: `src/features/uploads/resize.ts`, `resize.test.ts`
- Create: `src/features/uploads/upload-field.tsx`, `upload-field.test.tsx`

**Interfaces:**
- Consumes: `GenerationInput`, `GenerationEnvelope`.
- Produces: `draftStorage`, `assetStorage`, `calculateResizeDimensions`, `resizeImage` e `UploadField`.

- [ ] **Step 1: Escrever testes falhos de dimensões e storage**

```ts
it("limita o maior lado a 1568 sem ampliar", () => {
  expect(calculateResizeDimensions(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 });
  expect(calculateResizeDimensions(800, 600, 1568)).toEqual({ width: 800, height: 600 });
});

it("salva texto no localStorage e blobs no IndexedDB", async () => {
  draftStorage.save(draftFixture());
  await assetStorage.putImage({ id: "img-1", role: "product", blob: new Blob(["x"], { type: "image/jpeg" }), name: "p.jpg" });
  expect(draftStorage.load()).toEqual(draftFixture());
  expect((await assetStorage.listImages())[0].role).toBe("product");
});
```

Configure `fake-indexeddb/auto` somente em testes.

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/draft src/features/uploads`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar stores e resize**

`draftStorage` usa chave versionada `creative-generator:draft:v1`. IndexedDB `creative-generator` contém stores `images` e `results`. `resizeImage(file)` corrige orientação via `createImageBitmap`, usa canvas, exporta JPEG/WEBP com qualidade `0.85` e preserva PNG somente quando transparência existir.

- [ ] **Step 4: Implementar UploadField test-first**

Teste limites 1–5 UGC, 1–8 produto e 0–5 anúncio, tipos aceitos, remoção individual e texto acessível de progresso. O componente recebe:

```ts
type UploadFieldProps = {
  role: "ugc" | "product" | "ad";
  min: number;
  max: number;
  items: StoredImage[];
  onChange(items: StoredImage[]): void;
};
```

- [ ] **Step 5: Rodar suíte**

Run: `pnpm test src/features/draft src/features/uploads`

Expected: PASS; nenhum Blob serializado em localStorage.

- [ ] **Step 6: Commit**

```powershell
git add src/features/draft src/features/uploads package.json pnpm-lock.yaml vitest.setup.ts
git commit -m "feat: preserve drafts and resized references"
```

---

### Task 10: Wizard de nova geração

**Files:**
- Create: `src/features/wizard/product-step.tsx`, `product-step.test.tsx`
- Create: `src/features/wizard/references-step.tsx`, `references-step.test.tsx`
- Create: `src/features/wizard/direction-step.tsx`, `direction-step.test.tsx`
- Create: `src/features/wizard/generation-wizard.tsx`, `generation-wizard.test.tsx`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: schemas, stores, `UploadField`, `/api/generate`.
- Produces: `GenerationWizard` que salva `GenerationEnvelope` e navega para `/resultado/[id]`.

- [ ] **Step 1: Escrever teste falho da navegação e preservação**

```tsx
it("não avança sem produto obrigatório e restaura o rascunho", async () => {
  draftStorage.save(draftFixture({ nomeProduto: "Body Splash" }));
  render(<GenerationWizard services={fakeWizardServices} />);
  expect(screen.getByLabelText("Nome do produto")).toHaveValue("Body Splash");
  await userEvent.clear(screen.getByLabelText("Nome do produto"));
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText("Informe o nome do produto")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/wizard`

Expected: FAIL por componentes ausentes.

- [ ] **Step 3: Implementar etapas**

Use React Hook Form com `zodResolver`. Exiba barra “Produto → Referências → Direção”. Salve alterações com debounce de 300 ms. `ReferencesStep` carrega imagens do IndexedDB e exige ao menos uma foto de produto; UGC é opcional quando o perfil for “Sem pessoa”.

- [ ] **Step 4: Testar e implementar submissão**

Monte `FormData` com `payload`, `product` e `ad`; nunca acrescente `ugc`. Em erro, mantenha etapa e dados, mostre código traduzido e ação: Configurações para `API_NOT_CONFIGURED`, tentar novamente para falhas recuperáveis.

```ts
export interface WizardServices {
  saveDraft(value: GenerationDraft): void;
  loadDraft(): GenerationDraft | null;
  listImages(): Promise<StoredImage[]>;
  generate(form: FormData): Promise<GenerationEnvelope>;
  saveResult(id: string, result: GenerationEnvelope): Promise<void>;
  navigate(path: string): void;
}
```

- [ ] **Step 5: Rodar testes, lint e build**

Run: `pnpm test src/features/wizard && pnpm lint && pnpm build`

Expected: PASS; teste confirma que UGC não aparece no FormData.

- [ ] **Step 6: Commit**

```powershell
git add src/features/wizard src/app/'(app)'/page.tsx
git commit -m "feat: add three-step creative wizard"
```

---

### Task 11: Tela de resultados e cópia segura

**Files:**
- Create: `src/features/results/copy-button.tsx`, `copy-button.test.tsx`
- Create: `src/features/results/result-summary.tsx`, `result-summary.test.tsx`
- Create: `src/features/results/result-card.tsx`, `result-card.test.tsx`
- Create: `src/features/results/result-page.tsx`, `result-page.test.tsx`
- Create: `src/app/(app)/resultado/[id]/page.tsx`

**Interfaces:**
- Consumes: `assetStorage.getResult(id)` e `GenerationEnvelope`.
- Produces: painel de fatos/riscos, cards expansíveis e cópia por campo/pacote.

- [ ] **Step 1: Escrever teste falho de bloqueio de cópia**

```tsx
it("desabilita somente o campo bloqueado", () => {
  render(<ResultCard creative={creativeEnvelopeFixture({ blockedField: "descricao" })} />);
  expect(screen.getByRole("button", { name: "Copiar descrição" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Copiar Prompt VEO 3" })).toBeEnabled();
});
```

- [ ] **Step 2: Rodar RED**

Run: `pnpm test src/features/results`

Expected: FAIL por componentes ausentes.

- [ ] **Step 3: Implementar componentes de resultado**

`ResultSummary` exibe fatos, riscos e checklist. `ResultCard` usa Accordion, badges Aprovado/Atenção/Bloqueado, copy por trecho com contagem real, hashtags, POV, Prompt Gemini e Prompt VEO 3 em `<pre>`. `CopyButton` usa `navigator.clipboard.writeText`, feedback via live region e não executa quando `disabled`.

- [ ] **Step 4: Testar pacote completo e resultado ausente**

O pacote completo concatena somente campos copiáveis, com títulos Markdown. Resultado ausente no IndexedDB mostra “Resultado não encontrado neste navegador” e link para Nova geração, sem tentar buscar histórico no servidor.

- [ ] **Step 5: Rodar testes e build**

Run: `pnpm test src/features/results && pnpm lint && pnpm build`

Expected: PASS; navegação de teclado e labels de cópia presentes.

- [ ] **Step 6: Commit**

```powershell
git add src/features/results src/app/'(app)'/resultado
git commit -m "feat: present validated creative results"
```

---

### Task 12: E2E, segurança, documentação e entrega local

**Files:**
- Create: `tests/e2e/auth-settings-generation.spec.ts`
- Create: `tests/e2e/library-import.spec.ts`
- Create: `tests/e2e/error-preservation.spec.ts`
- Create: `README.md`, `docs/aaPanel.md`
- Modify: `playwright.config.ts`, `package.json`

**Interfaces:**
- Consumes: aplicativo completo e `E2E_FAKE_ANTHROPIC=1` fora de produção.
- Produces: suíte de aceite, documentação local e instruções futuras de aaPanel.

- [ ] **Step 1: Escrever E2E falho do fluxo principal**

```ts
test("login, configuração, geração e cópia do VEO", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("admin");
  await page.getByLabel("Senha").fill("senha-local-segura");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.goto("/configuracoes");
  await page.getByLabel("Nova chave Anthropic").fill("sk-ant-e2e-1234");
  await page.getByLabel("Template VEO 3").fill("Fala: {{copy_completa}}");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await page.goto("/");
  await page.getByLabel("Nome do produto").fill("Body Splash E2E");
  await page.getByLabel("Categoria").selectOption("perfumaria");
  await page.getByLabel("Descrição do anúncio").fill("Kit masculino com quatro fragrâncias de 60 ml.");
  await page.getByLabel("Perfil UGC").selectOption("masculino");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Fotos do produto").setInputFiles({
    name: "produto.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Gerar criativos" }).click();
  await expect(page.getByText("Prompt VEO 3")).toBeVisible();
  await expect(page.getByText(/Fala:/)).toBeVisible();
});
```

- [ ] **Step 2: Configurar servidor Playwright e rodar RED**

`playwright.config.ts` inicia `pnpm dev` com banco temporário, credenciais E2E e fake Anthropic. Use diretório `test-results/runtime-data`, removido antes da suíte.

Run: `pnpm e2e tests/e2e/auth-settings-generation.spec.ts`

Expected: FAIL até os seletores finais e seed E2E estarem alinhados.

- [ ] **Step 3: Completar E2E da biblioteca e erros**

`library-import.spec.ts` envia cópia válida da planilha, confere prévia, ativa e faz rollback; também envia texto renomeado para `.xlsx` e confirma que o hash ativo não muda. `error-preservation.spec.ts` força timeout fake, recarrega a página e confirma os campos preservados.

- [ ] **Step 4: Escrever documentação operacional exata**

`README.md` deve conter:

```text
Requisitos: Node 20.19+, pnpm
Instalação: pnpm install
Ambiente: copiar .env.example para .env.local e gerar segredos
Banco: pnpm db:migrate
Biblioteca inicial: pnpm library:build
Desenvolvimento: pnpm dev
Testes: pnpm test; pnpm e2e
Build local: pnpm build
Produção standalone: copiar .next/standalone, .next/static e public; iniciar server.js
```

`docs/aaPanel.md` explica build no Linux, `DATA_DIR` persistente, HTTPS, `client_max_body_size 25m`, `proxy_read_timeout 120s`, migração antes do start e backup de `app.db` + `library/versions`.

- [ ] **Step 5: Executar verificação de segurança**

Run:

```powershell
pnpm test
pnpm e2e
pnpm lint
pnpm build
$secretHits = rg -n "sk-ant-|senha-local-segura" .next/static -g '*.js'
if ($LASTEXITCODE -eq 0) { $secretHits; throw "Segredo encontrado no bundle cliente" }
rg -n "ADMIN_PASSWORD|SETTINGS_ENCRYPTION_KEY" .next/server/app -g '*.js'
```

Expected: testes/lint/build PASS. A busca cliente não encontra valor de segredo; a busca server-side pode listar somente nomes de variáveis, nunca seus valores.

- [ ] **Step 6: Smoke test standalone**

Copie assets que o standalone não copia automaticamente e inicie o servidor:

```powershell
Copy-Item public .next\standalone\public -Recurse -Force
New-Item -ItemType Directory -Force .next\standalone\.next\static | Out-Null
Copy-Item .next\static\* .next\standalone\.next\static -Recurse -Force
$env:PORT = "3100"
node .next\standalone\server.js
```

Em outra sessão, `Invoke-WebRequest http://localhost:3100/api/health` deve devolver 200 e `{"status":"ok"}`. Encerre apenas o processo iniciado para o smoke test.

- [ ] **Step 7: Commit final de documentação e aceite**

```powershell
git add tests README.md docs/aaPanel.md playwright.config.ts package.json pnpm-lock.yaml
git commit -m "test: verify MVP workflows and local deployment"
```

## Self-review do plano

- Cobertura da especificação: Tasks 2–4 cobrem autenticação/configurações; Tasks 5–6 cobrem biblioteca atualizável; Tasks 7–8 cobrem Claude e validação; Tasks 9–11 cobrem rascunho, wizard e resultados; Task 12 cobre aceite e aaPanel.
- Segredos: nenhuma etapa cria `.env` versionado ou fixture com chave real.
- Tipos compartilhados: `GenerationInput` e `GenerationEnvelope` nascem na Task 7 e são consumidos sem renomeação nas Tasks 8–11.
- Biblioteca: `LibraryCorpus`, `LibraryStorage` e `LibraryRepository` mantêm os mesmos nomes entre Tasks 5–8.
- Duração: 15/20/30 segundos usa 8+7, 10+10, 10+10+10 em schema, prompt e validação.
- Escopo: histórico, regeneração isolada, exportação, custo, multiusuário e publicação permanecem excluídos.
