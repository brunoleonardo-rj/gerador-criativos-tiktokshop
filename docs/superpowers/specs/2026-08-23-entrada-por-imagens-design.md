# Entrada de produto por imagens — Design

**Data:** 23 de agosto de 2026
**Status:** aprovado em conversa
**Projeto:** Gerador de Criativos TikTok Shop

## Objetivo

Substituir o formulário textual inicial por uma entrada orientada a imagens. O usuário envia fotos do produto e prints da página do anúncio/PDP, a Anthropic extrai os fatos visíveis e o usuário revisa esses dados antes de continuar. A revisão humana permanece obrigatória para evitar que texto ilegível ou ausente vire uma afirmação inventada no criativo.

Esta especificação altera somente o fluxo de nova geração. Autenticação, Configurações, Biblioteca Mestra, validação editorial, resultado e implantação no aaPanel continuam como definidos no design do MVP.

## Experiência aprovada

O assistente continuará com três etapas visíveis:

1. **Produto:** upload, análise e revisão.
2. **Referências:** fotos da pessoa UGC e demais referências visuais.
3. **Direção:** volume, duração, ambientes e regras do criativo.

A etapa Produto terá três estados internos:

### Upload

- Um único campo aceita de uma a oito fotos do produto ou prints do anúncio/PDP.
- Formatos aceitos: JPEG, PNG e WEBP.
- O navegador redimensiona cada imagem para o limite já adotado pelo app antes de armazená-la.
- A tela apresenta miniaturas, remoção individual e o botão **Analisar imagens**.
- Nenhum campo textual de produto aparece antes da análise.

### Análise

- Ao clicar em **Analisar imagens**, as imagens são enviadas a um endpoint autenticado.
- A interface bloqueia envios duplicados, mostra progresso indeterminado e explica que a IA está lendo os dados do produto.
- As imagens continuam armazenadas no IndexedDB e não são descartadas após a análise.

### Revisão

- O retorno preenche uma tela compacta e editável com nome, categoria, descrição, avaliações, nota, quantidade de avaliações, preços, especificações críticas e público-alvo.
- Campos que a IA não conseguiu identificar ficam vazios e destacados.
- Nome, categoria e descrição precisam estar preenchidos para avançar.
- O usuário pode corrigir qualquer valor, voltar às imagens ou executar nova análise.
- Alterar ou remover uma imagem marca a análise anterior como desatualizada e exige nova análise antes de avançar.

As escolhas de perfil UGC e link do produto deixam de fazer parte do formulário inicial. O perfil UGC ficará na etapa Referências, pois determina se uma foto de pessoa é obrigatória. O link do produto fica fora deste incremento porque não pode ser obtido com segurança a partir de uma imagem e não é necessário para a geração.

## Abordagem técnica

Será criada uma chamada de extração separada da geração final. Esta opção tem uma chamada adicional à Anthropic, mas permite que o usuário corrija os fatos antes que eles entrem no prompt criativo.

Alternativas rejeitadas:

- extrair e gerar na mesma chamada, porque impede a revisão prévia;
- OCR somente no navegador, porque perde contexto visual e tem menor confiabilidade para layouts variados de marketplace.

### Novo endpoint

`POST /api/product-extraction` receberá `multipart/form-data` com uma a oito imagens no campo `source`.

O endpoint:

1. exige sessão válida;
2. valida mesma origem;
3. limita tamanho total, quantidade, tamanho individual, MIME declarado e assinatura real do arquivo;
4. carrega a credencial e o modelo configurados;
5. chama a Anthropic com instrução exclusiva de extração factual e saída estruturada;
6. valida o resultado com Zod;
7. devolve somente os dados extraídos, avisos e metadados seguros.

A chamada terá timeout e não fará repetição automática, evitando cobrança duplicada. O usuário poderá tentar novamente manualmente.

### Contrato da extração

O retorno terá este formato lógico:

```text
ProductExtraction
  nomeProduto: string | null
  categoria: string | null
  descricaoPdp: string | null
  avaliacoes: string | null
  notaMedia: number | null
  quantidadeAvaliacoes: number | null
  precoAtual: string | null
  precoAnterior: string | null
  especificacoesCriticas: string[]
  publicoAlvo: string | null
  avisos: string[]
```

Campos escalares ausentes serão `null`, nunca texto inventado. Listas ausentes serão vazias. A instrução do modelo proibirá inferir preço, nota, quantidade, composição, medida, benefício ou público que não esteja visível. O campo `publicoAlvo` só será preenchido quando houver indicação explícita nas imagens; caso contrário ficará vazio para revisão.

### Componentes e responsabilidades

- **ProductImagesStep:** controla os estados upload, analisando e revisão.
- **ProductReviewForm:** exibe e edita somente os dados extraídos.
- **ProductExtractionService:** monta a requisição factual e converte a saída validada.
- **ProductExtractionPort:** isola o SDK Anthropic para testes.
- **ProductExtractionHandler:** autentica, valida os arquivos e mapeia erros HTTP.
- **GenerationWizard:** coordena os três passos, persiste o rascunho e invalida a análise quando as fontes mudam.

A implementação reutilizará as funções existentes de redimensionamento, IndexedDB, validação de imagens e mapeamento de falhas sempre que os contratos forem compatíveis. Validação compartilhada será extraída para uma unidade pequena, evitando duplicar regras entre `/api/product-extraction` e `/api/generate`.

## Fluxo de dados

```text
Imagens no navegador
  -> redimensionamento
  -> IndexedDB
  -> POST /api/product-extraction
  -> Anthropic com saída estruturada
  -> revisão editável
  -> rascunho local
  -> referências UGC
  -> direção criativa
  -> POST /api/generate com dados revisados + imagens-fonte
```

As imagens analisadas também serão enviadas na geração final para continuarem sendo a fonte visual de verdade. Fotos UGC permanecem locais e não são enviadas à Anthropic, como no MVP atual.

## Persistência e compatibilidade

- Imagens continuam no IndexedDB.
- Dados revisados continuam no rascunho do navegador.
- O schema do rascunho ganhará o estado da análise e uma impressão estável da lista de imagens analisadas.
- Rascunhos antigos permanecem carregáveis. Se possuírem dados textuais sem uma análise de imagens correspondente, o assistente abre no estado de upload e preserva os valores para a futura tela de revisão, sem considerá-los analisados.
- Imagens antigas com papéis `product` e `ad` serão reunidas visualmente como fontes do produto, respeitando o novo limite de oito itens. Nenhum dado local será apagado automaticamente.

## Estados de erro

- **API não configurada:** mensagem com acesso a Configurações.
- **Credencial inválida:** mensagem específica sem revelar o segredo.
- **Imagem inválida ou limite excedido:** erro junto ao campo de upload.
- **Nada legível:** a revisão abre com campos vazios e avisos claros; o usuário pode trocar as imagens ou preencher os campos.
- **Resposta inválida, recusa, limite, timeout ou rede:** a tela preserva as imagens e oferece **Tentar novamente**.
- **Imagem alterada após análise:** revisão marcada como desatualizada e avanço bloqueado até nova análise.

Prompts, imagens, credenciais e conteúdo extraído não serão gravados em logs. Respostas de erro usarão códigos estáveis já conhecidos pelo frontend quando possível.

## Layout

O visual seguirá o estúdio criativo já aprovado: fundo claro quente, cards brancos, tipografia forte e acentos roxo/coral.

- O upload será o foco principal da primeira tela, com área grande de arrastar/selecionar e exemplos do que enviar.
- As miniaturas usarão grade responsiva.
- A revisão usará campos compactos agrupados em “Produto”, “Oferta e prova social” e “Especificações”.
- O progresso mostrará **Produto**, **Referências** e **Direção**, com estado atual acessível por `aria-current`.
- Em telas pequenas, cards e ações passam para uma coluna; o botão principal permanece fácil de alcançar sem cobrir conteúdo.
- Estados de foco, erro, carregamento e desabilitado terão contraste e texto, sem depender apenas de cor.

## Testes

A implementação seguirá TDD.

### Unidade

- schema de extração aceita campos ausentes como `null` e rejeita propriedades inesperadas;
- prompt proíbe inferências e descreve todas as fontes enviadas;
- impressão das imagens muda quando a seleção, ordem ou conteúdo muda;
- conversão da extração para valores editáveis preserva zero e listas;
- alteração das imagens invalida uma análise anterior.

### Integração

- handler exige sessão e mesma origem;
- rejeita método, tipo, assinatura, quantidade e tamanho inválidos;
- mapeia credencial ausente, inválida, recusa, limite, timeout e saída inválida;
- não chama a Anthropic quando a requisição é inválida;
- geração final recebe os dados revisados e as imagens-fonte.

### Interface

- primeira tela mostra somente upload de imagens, sem formulário textual;
- análise exibe carregamento e impede clique duplicado;
- retorno abre a revisão com valores editáveis;
- campos obrigatórios ausentes impedem avanço;
- trocar uma imagem exige nova análise;
- erros preservam as miniaturas e permitem nova tentativa;
- perfil sem pessoa elimina a obrigatoriedade de foto UGC;
- layout é verificado no navegador em desktop e viewport móvel.

## Critérios de aceite

1. A primeira tela não solicita digitação de dados do produto.
2. Uma a oito imagens podem ser enviadas e removidas sem recarregar a página.
3. **Analisar imagens** preenche uma revisão editável usando a chave Anthropic configurada.
4. Informação não visível não é fabricada; aparece vazia ou como aviso.
5. Nome, categoria e descrição são validados antes de avançar.
6. Alterar as imagens invalida a análise anterior.
7. Falhas preservam imagens e rascunho.
8. A geração final usa os dados revisados e mantém as imagens como fonte visual.
9. O fluxo funciona por teclado e em telas desktop e móveis.
10. Testes, lint, verificação de tipos e build terminam sem falhas antes da entrega.
