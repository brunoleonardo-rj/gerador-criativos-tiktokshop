# Design QA — geração e resultados

## Fontes e condições

- Referência da geração: `C:\Users\Lenovo\.codex\generated_images\01a02517-0f65-7213-acd7-8181647d1927\exec-25cc3a48-d269-4971-a4df-c837eceefd38.png`
- Referência dos resultados: `C:\Users\Lenovo\.codex\generated_images\01a02517-0f65-7213-acd7-8181647d1927\exec-ad45c145-b44b-4522-ba4c-4af4a39b9917.png`
- Captura da geração: `.next/design-qa/generation-desktop.png`
- Captura dos resultados: `.next/design-qa/results-desktop.png`
- Captura da aba Gemini: `.next/design-qa/gemini-desktop.png`
- Captura responsiva dos resultados: `.next/design-qa/results-mobile.png`
- Viewport desktop: 1280 × 720; viewport móvel: 390 × 844.

## Regiões verificadas

- Navegação principal e hierarquia do título.
- Trilho de etapas da geração, painel de upload e ações.
- Resumo compacto da geração e divulgação da validação.
- Lista de criativos, estado selecionado e painel de detalhe.
- Abas Copy, VEO 3, Gemini e Publicação.
- Conteúdo longo do prompt Gemini e ações de cópia.
- Empilhamento e ausência de estouro horizontal no breakpoint móvel.

## Histórico de correções

1. O formulário extenso foi substituído por uma área de trabalho com trilho lateral e revisão em duas colunas.
2. O input nativo de arquivo foi ocultado visualmente; o controle acessível continua associado ao botão de upload.
3. Os resultados passaram a exibir um criativo por vez, com seleção na lista e conteúdo separado por abas.
4. O prompt Gemini ganhou aba própria e rolagem interna para não aumentar a página indefinidamente.
5. No móvel, lista e detalhe são empilhados; abas e botões permanecem utilizáveis sem overflow horizontal.

## Resultado final

- P0: nenhum.
- P1: nenhum.
- P2: nenhum.
- A implementação mantém os dados reais do produto; as fotos dos mockups não foram incorporadas ao app.
