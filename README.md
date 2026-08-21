# Gerador de Criativos TikTok Shop

Aplicação local autenticada para criar pacotes de criativos, administrar a biblioteca mestra e configurar o Prompt VEO 3.

## Requisitos e instalação

Use Node.js **20.19 ou superior** e pnpm.

```powershell
pnpm install
Copy-Item .env.example .env.local
```

Preencha `.env.local` com credenciais próprias. Gere os segredos sem reutilizar os exemplos:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use, respectivamente, as saídas para `AUTH_SECRET`, `TRUSTED_PROXY_SECRET` e `SETTINGS_ENCRYPTION_KEY`. Defina também `ADMIN_USERNAME`, uma `ADMIN_PASSWORD` com ao menos 12 caracteres e um `DATA_DIR` gravável.

```powershell
pnpm db:migrate
pnpm library:build
pnpm dev
```

Abra `http://localhost:3000`. A primeira consulta à biblioteca a prepara automaticamente a partir da planilha versionada.

## Verificação

```powershell
pnpm test
pnpm e2e
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Os E2E usam Chromium, dados em `test-results/runtime-data`, credenciais de teste e um adaptador Anthropic falso. Eles não chamam a API da Anthropic. Para instalar somente o navegador necessário: `pnpm exec playwright install chromium`.

## Produção standalone

Depois de `pnpm build`, a execução é `node .next/standalone/server.js`. Copie para a pasta de execução o conteúdo de `.next/standalone`, `.next/static` em `.next/standalone/.next/static` e `public` em `.next/standalone/public`.

Compile e instale dependências nativas no Linux do host de destino. Não copie `node_modules`, o cliente Prisma ou binários SQLite gerados no Windows. O guia de aaPanel está em [docs/aaPanel.md](docs/aaPanel.md).

## Limitações do MVP

O resultado e as imagens UGC ficam somente no navegador atual (IndexedDB); não há histórico servidor-side. Fotos UGC não são enviadas ao modelo. A geração de vídeo/imagem, publicação no TikTok, DNS, certificado e a publicação efetiva no aaPanel ficam fora desta entrega.
