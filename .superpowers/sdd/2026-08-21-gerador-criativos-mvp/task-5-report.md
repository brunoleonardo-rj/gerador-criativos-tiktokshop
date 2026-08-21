# Task 5 — biblioteca determinística

## Fonte e cópia

- Fonte somente leitura: `D:\Projetos\TiktokShop\outputs\copy-library-20260819\Biblioteca_Mestra_Copys_TikTok_Shop.xlsx`
- SHA-256 antes da cópia: `7C829DC17D4BF9EB19B42ACCEE0050F71E1C55AB0D53662468F85D6A5D1DD17D`
- SHA-256 depois da cópia: `7C829DC17D4BF9EB19B42ACCEE0050F71E1C55AB0D53662468F85D6A5D1DD17D`
- SHA-256 da cópia em `resources/library/`: `7C829DC17D4BF9EB19B42ACCEE0050F71E1C55AB0D53662468F85D6A5D1DD17D`

A fonte permaneceu inalterada e a cópia é byte a byte idêntica.

## Contrato e corpus

Foram validadas, na ordem, as oito abas exigidas: `Resumo`, `Catalogo`, `Hooks`, `Corpos`, `CTAs`, `Playbook`, `Hashtags` e `Fontes`. Os cabeçalhos estruturais foram conferidos contra a fonte aprovada, incluindo os 23 cabeçalhos de `Catalogo`; as abas editoriais obrigatórias têm conteúdo não vazio.

- Registros no JSON: 75
- `summary.recordCount`: 75
- SHA-256 do JSON (duas execuções): `9A5D8D384DFE2C2D0FE239674FCFD5783164B624F15CAC73D4958B6069D8CCF6`

O parser normaliza texto para NFC, remove caracteres zero-width apenas do ID, rejeita IDs normalizados duplicados, impõe limites de arquivo/linhas/colunas/células e não executa fórmulas. O JSON é ordenado e serializado sem timestamp; o builder usa arquivo temporário seguido de rename.

## Evidência RED → GREEN

RED:

```text
pnpm test src/features/library/workbook.test.ts src/features/library/serialize.test.ts src/features/library/select.test.ts
FAIL — imports ./workbook, ./serialize e ./select inexistentes.
```

GREEN:

```text
pnpm test src/features/library
PASS — 3 arquivos, 7 testes.
pnpm library:build
PASS — 75 registros; hash da fonte 7c829d...d17d; hash JSON 9a5d8d...ccf6.
```

## Verificação final

```text
pnpm lint
PASS
pnpm build
PASS — prisma generate e next build concluídos.
pnpm library:build (repetido)
PASS — bytes e SHA-256 do JSON idênticos.
```

## Auto-revisão e observações

- Schema Zod é estrito para registros e corpus; os campos editoriais obrigatórios são validados.
- O seletor é puro, determinístico, limitado a 1–24 exemplos, prioriza termos de produto/categoria e aumenta a diversidade de mecanismos antes de completar o conjunto.
- `xlsx` foi acrescentado como dependência direta para ler de forma segura a fonte XLSX aprovada, cuja forma OOXML com namespace prefixado não é aceita pelo leitor ExcelJS presente no projeto. A planilha não é modificada nem fórmulas são executadas.
- Aviso não bloqueante externo: pnpm informa que `pnpm.onlyBuiltDependencies` em `package.json` é uma chave legada; o `pnpm-workspace.yaml` recebeu a configuração de builds sugerida pelo pnpm durante a adição da dependência.

## Fix round 1/5

### Contrato integral e validação

- Os oito nomes de abas e sua ordem são obrigatórios. Cada cabeçalho agora é comparado como vetor completo, incluindo largura exata: `Catalogo` tem precisamente 23 campos; os quatro blocos de cabeçalho de `Playbook` também são conferidos.
- Linhas de cabeçalho e títulos não são conteúdo editorial. `Resumo`, `Playbook` e `Hashtags` requerem ao menos uma linha não vazia posterior a seus cabeçalhos.
- As 23 colunas do `Catalogo` são mapeadas: `numero`, `id`, `autor`, `produto`, `duracao`, status/editoriais e rastreabilidade `arquivoFonte`. O JSON regenerado preserva essa coluna.
- `Hooks`, `Corpos`, `CTAs` e `Fontes` exigem exatamente o mesmo conjunto único de IDs normalizados do catálogo e cada linha compartilhada é validada campo a campo. IDs ausentes, órfãos, duplicados e valores inconsistentes são bloqueados.

### ZIP e dependência

- `xlsx@0.18.5` foi removido. `read-excel-file@9.3.10` leu com sucesso a fonte OOXML com namespace prefixado e é a dependência direta atual.
- Antes do leitor, `preflightXlsx()` verifica assinatura ZIP/local header, EOCD e diretório central, uma única mídia/disco, limites de 256 entradas, 5 MiB expandidos por entrada e 40 MiB total, metadados/tamanhos/offsets, criptografia e caminhos inseguros. O limite comprimido permanece 20 MiB. Fórmulas não são executadas.
- `pnpm audit --prod` resultou em exit 1 por achados preexistentes fora da substituição: alto `deepmerge-ts@7.1.5` via `@prisma/client > prisma > @prisma/config`, e moderado `uuid` via `exceljs`. `pnpm why read-excel-file` mostrou somente `read-excel-file@9.3.10` direto, sem achado alto/crítico introduzido pela troca.

### RED → GREEN e seleção

```text
RED: pnpm test src/features/library/workbook.test.ts src/features/library/zip.test.ts
FAIL — leitor xlsx removido e preflight ainda inexistente; os novos contratos não eram implementados.
GREEN: pnpm test src/features/library
PASS — 4 arquivos, 13 testes.
```

Os testes cobrem largura extra, editoriais vazios, IDs duplicados/ausentes/órfãos, metadados ZIP sobre limite e seleção por sobreposição de produto, moda, casa/cozinha, perfumaria e zero relevância. O seletor agora aplica tiers produto → categoria compatível e não completa o limite com itens sem relevância.

### Verificação repetida

```text
pnpm library:build (duas vezes): PASS — 75 registros
SHA-256 JSON: D6E107069B91C4D81D32EBB5F2136BE20D948F5A58A5449A147AEC5A56345BCB (idêntico)
pnpm lint: PASS
pnpm build: PASS
```

A fonte e a cópia continuam com SHA-256 `7C829DC17D4BF9EB19B42ACCEE0050F71E1C55AB0D53662468F85D6A5D1DD17D`.

## Fix round 2/5

### Preflight ZIP com expansão real

Cada entrada do diretório central agora é reconciliada com o local header referenciado antes de o leitor XLSX receber os bytes: assinatura, nome em bytes e nome NFC seguro, flags, método, CRC, tamanhos comprimido/descomprimido e offsets precisam coincidir. São recusados ZIP64/multi-disco, flags de criptografia/data descriptor/desconhecidas, métodos fora de stored/deflate, nomes normalizados duplicados, caminhos inseguros, tamanhos/offsets inválidos, interseção entre ranges locais/dados e qualquer range que alcance o diretório central.

As entradas deflate são expandidas de seu slice comprimido exato via `inflateRawSync` com `maxOutputLength` explícito de 5 MiB. Entradas stored têm comprimento exato verificado; toda expansão é confrontada com o tamanho declarado e CRC32, e o total efetivo é limitado a 40 MiB. Assim, o leitor posterior não pode expandir um entry maior que o já verificado.

### RED → GREEN e verificação

```text
RED: pnpm test src/features/library/zip.test.ts
FAIL — contradições local/central e expansão real mal declarada ainda eram aceitas.
GREEN: pnpm test src/features/library/zip.test.ts
PASS — 7 testes.
pnpm test src/features/library
PASS — 4 arquivos, 15 testes.
pnpm library:build (duas vezes)
PASS — 75 registros; JSON D6E107069B91C4D81D32EBB5F2136BE20D948F5A58A5449A147AEC5A56345BCB idêntico.
pnpm lint; pnpm build
PASS.
```

Os regressivos agora cobrem contradições de nome/tamanho/flags, data descriptor, criptografia, referências duplicadas/sobrepostas e stream deflate que expande além da declaração/cap. A fonte real de 75 registros continua aceita.

`pnpm audit --prod` permanece com os mesmos achados externos: alto em `deepmerge-ts` pelo caminho Prisma e moderado em `uuid` por `exceljs`; nenhuma dependência desta rodada foi alterada.

## Fix round 3/5

O preflight agora rejeita ZIP64 em todas as formas relevantes para este subconjunto: sentinelas EOCD existentes, locator/record ZIP64 imediatamente antes do EOCD, versão-needed 45+ e versões local/central incompatíveis, além de qualquer extra field `0x0001` nos headers central ou local. Os sequenciadores de campos extras verificam header de 4 bytes e comprimento integral, bloqueando extras truncados/overflow.

```text
RED: pnpm test src/features/library/zip.test.ts
FAIL — extras ZIP64/truncados ainda avançavam até falha estrutural genérica.
GREEN: pnpm test src/features/library/zip.test.ts
PASS — 9 testes.
pnpm test src/features/library
PASS — 4 arquivos, 17 testes.
pnpm library:build (duas vezes)
PASS — 75 registros; JSON D6E107069B91C4D81D32EBB5F2136BE20D948F5A58A5449A147AEC5A56345BCB idêntico.
pnpm lint; pnpm build
PASS.
```

Os testes incluem extra ZIP64 central/local, version-needed 45, ZIP64 locator/record e extra truncado. A fonte real continuou aprovada.

## Fix round 4/5

O preflight agora calcula o fim seguro do diretório central declarado e, depois de consumir exatamente todas as entradas declaradas, exige que esse fim seja exatamente o offset do EOCD comum. Assim, nenhuma estrutura pode ocupar a lacuna antes do EOCD — inclusive record/locator ZIP64 de tamanho variável, assinatura digital ou bytes arbitrários — enquanto comentários normais após o EOCD continuam permitidos.

```text
RED: pnpm test src/features/library/zip.test.ts
FAIL — 2 novos regressivos; um record ZIP64 de 60 bytes com extensible-data sector e EOCD comum com valores não-sentinela, e uma lacuna genérica, eram aceitos.
GREEN: pnpm test src/features/library/zip.test.ts
PASS — 11 testes.
pnpm test src/features/library
PASS — 4 arquivos, 19 testes.
pnpm library:build
PASS — 75 registros; fonte 7c829d...d17d; JSON d6e107...45bc.
pnpm lint; pnpm build
PASS.
```
