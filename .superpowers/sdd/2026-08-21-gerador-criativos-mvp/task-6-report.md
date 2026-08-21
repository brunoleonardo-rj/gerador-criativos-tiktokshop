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
