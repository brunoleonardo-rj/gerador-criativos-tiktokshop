# Task 6 — Biblioteca versionada: relatório

## Evidência RED/GREEN

- RED: `pnpm test src/features/library/service.test.ts` falhou porque `./service` não existia.
- GREEN: depois da implementação, o mesmo teste passou com 2 testes.
- Os testes de armazenamento, repositório Prisma isolado, handlers e interface foram adicionados e executados juntamente com a suíte da biblioteca.

## Atomicidade, falhas e concorrência

- `stage` só grava metadata após parser e escrita staged; parser inválido não altera ACTIVE.
- Staging escreve para diretório temporário e promove com `rename`; a ativação verifica o SHA-256 imediatamente antes da promoção e só depois atualiza metadata em transação Prisma. Se a transação falhar, a promoção é restaurada para staging para uma nova tentativa.
- ACTIVE/PREVIOUS são trocados na transação; versões PREVIOUS obsoletas são removidas apenas após a transação. Falha prévia não toca ACTIVE.
- `activate` e `rollback` usam mutex estático em processo. Rollback verifica o arquivo da versão PREVIOUS antes da troca.
- Os limites multipart contam bytes do stream inclusive requests sem `Content-Length` antes de chamar `formData()`.

## Verificações

- `pnpm test src/features/library` — 8 arquivos, 25 testes aprovados.
- `pnpm test` — 25 arquivos, 93 testes aprovados.
- `pnpm lint` — aprovado.
- `pnpm build` — aprovado, com as quatro rotas de biblioteca presentes.
- `Test-Path .next\\standalone\\resources\\library\\Biblioteca_Mestra_Copys_TikTok_Shop.xlsx` — `True`; o recurso inicial está no trace standalone.
- `repository.integration.test.ts` executa Prisma com SQLite `:memory:` e confirma ACTIVE/PREVIOUS após duas ativações.

## Auto-revisão e preocupações

- Caminhos são derivados exclusivamente de `DATA_DIR/library`, IDs aceitam somente UUID/segmentos sanitizados, e nenhum caminho de cliente é aceito.
- A semente padrão ocorre na primeira leitura de status por processo. Como o mutex é em processo, múltiplas instâncias de servidor ainda dependem da serialização SQLite; o MVP local não tem coordenação distribuída.

## Fix round 1/5

- RED: o teste de limpeza pós-commit reproduziu `Error: cleanup`, que antes rejeitava uma ativação já confirmada.
- GREEN: limpeza de versões obsoletas é best-effort depois da transação; a ativação e o snapshot continuam disponíveis.
- O JSON agora recebe SHA-256 persistido (`jsonSha256`) via migração Prisma e é validado contra schema e SHA do XLSX antes de ativação, rollback e snapshot.
- Promoção/restauração são idempotentes e, se a restauração após erro transacional falhar, os caminhos finais são reconciliados no STAGED para uma ativação posterior.
- Multipart aceita uma única parte `file`, MIME XLSX/octet-stream/vazio e continua limitado antes de `formData()`.
- A storage valida formato estrito de caminhos, IDs UUID, `realpath` e rejeita links simbólicos nos componentes acessados.
- Verificação desta rodada: `pnpm test` (26 arquivos, 97 testes), `pnpm lint`, `pnpm build` e `prisma generate` aprovados; o recurso inicial também foi encontrado no trace standalone.

## Fix round 2/5

- RED: a promoção removia o staging no fake e o retry dependia da escrita imediata de metadata; o teste de falha dupla mostrou a dependência.
- GREEN: `locate(importId)` identifica exatamente uma cópia íntegra em staging ou versions a cada ativação; `promote` permanece idempotente para a cópia já promovida e o retry não exige reconciliação no banco.
- `jsonSha256` agora é nullable em migrações legadas. Ao encontrar valor vazio, a leitura validada confirma o XLSX e schema/sha do corpus, calcula o hash real do JSON e persiste o backfill antes de continuar.
- A raiz e os containers são criados em modo privado quando suportado e validados por `lstat`/`realpath`; containers linkados ou não-diretórios são recusados antes de operações de escrita, promoção e cleanup.
- Verificações focadas: `pnpm test src/features/library/service.test.ts src/features/library/repository.integration.test.ts src/features/library/storage.test.ts` (6 testes), `pnpm lint`, `pnpm build` e Prisma generate aprovados.
- Após corrigir o trace dinâmico do Turbopack, `pnpm test` voltou a passar integralmente: 26 arquivos e 97 testes.
