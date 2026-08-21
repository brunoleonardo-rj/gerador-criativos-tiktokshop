# Gerador de Criativos TikTok Shop — Design do MVP

**Data:** 21 de agosto de 2026

**Status:** aprovado em conversa
**Destino:** aplicação local preparada para publicação posterior em servidor aaPanel

## Objetivo

Construir uma aplicação de uso pessoal que recebe dados e referências visuais de um produto do TikTok Shop e devolve de um a oito pacotes de criativos prontos para produção. Cada pacote inclui Prompt Gemini, copy falada, descrição, hashtags, POV e um Prompt VEO 3 renderizado a partir de um template editável.

O MVP prioriza segurança de credenciais, fidelidade factual, validação determinística e uma experiência rápida de copiar e produzir. Ele não gera imagens, vídeos nem publica no TikTok.

## Escopo aprovado

O MVP inclui:

- autenticação de administrador único;
- formulário de nova geração em três etapas;
- upload e redimensionamento local de imagens;
- integração server-side com a Claude API;
- biblioteca mestra versionada em JSON e filtrada por relevância;
- saída estruturada e validada;
- resultados em cards com cópia por campo;
- configurações persistentes para credencial Anthropic, modelo e template VEO 3;
- Prompt VEO 3 preenchido com a copy de cada criativo;
- rascunho e último resultado preservados no navegador;
- build Node.js autônomo compatível com publicação posterior no aaPanel;
- documentação das variáveis de ambiente e da configuração de proxy reverso.

Ficam fora do MVP:

- histórico persistente de gerações;
- banco de produtos;
- regeneração isolada de um criativo;
- exportação Markdown;
- painel de custo;
- CRUD da biblioteca;
- multiusuário e permissões;
- geração de imagem ou vídeo;
- publicação automática;
- integração com a API do TikTok Shop;
- consulta de hashtags em tempo real.

## Arquitetura

A aplicação será criada em `D:\Projetos\TiktokShop\gerador-criativos` usando Next.js 16+, TypeScript, App Router, Tailwind CSS e componentes shadcn/ui. O runtime mínimo de produção será Node.js 20.9, conforme o requisito atual do Next.js, e o build usará `output: "standalone"`.

O projeto não usará servidor customizado. O servidor integrado do Next.js fornecerá páginas, Route Handlers e o arquivo mínimo de produção. A publicação no aaPanel deverá compilar o projeto no próprio host Linux ou em ambiente Linux compatível, para evitar transportar binários nativos de SQLite gerados no Windows.

### Componentes principais

1. **Interface web:** login, navegação, formulário, uploads, configurações e resultados.
2. **Camada de autenticação:** emissão e validação de sessão assinada.
3. **Camada de configurações:** persistência SQLite, criptografia de credenciais e renderização do template VEO 3.
4. **Pipeline de biblioteca:** conversão da planilha mestra para JSON e seleção de exemplos relevantes.
5. **Pipeline de geração:** montagem do prompt, chamada Anthropic, parsing e pós-processamento.
6. **Validação editorial:** regras determinísticas com severidade por campo.
7. **Persistência no navegador:** rascunho textual, imagens redimensionadas e último resultado.

Cada componente terá interfaces próprias e dependências injetáveis onde houver efeitos externos. O cliente Anthropic e o relógio de sessão serão substituíveis em testes.

## Rotas

### Páginas

- `/login`: autenticação do administrador.
- `/`: nova geração em três etapas.
- `/resultado/[id]`: resultado armazenado no navegador atual.
- `/configuracoes`: credencial Anthropic, modelo e template VEO 3.

### APIs

- `POST /api/auth/login`: valida credenciais e cria sessão.
- `POST /api/auth/logout`: encerra a sessão.
- `GET /api/settings`: devolve somente estado mascarado e valores não secretos.
- `PUT /api/settings`: atualiza chave, modelo e template.
- `DELETE /api/settings/api-key`: remove a credencial armazenada.
- `POST /api/generate`: valida a entrada, chama a Anthropic e devolve o pacote processado.
- `GET /api/health`: informa apenas disponibilidade do processo, sem dados privados.

Todas as páginas e APIs, exceto login e health, exigem sessão válida.

## Autenticação e segurança

O app terá um único administrador, sem tabela de usuários. As credenciais de entrada e os segredos de infraestrutura serão definidos no ambiente:

- `ADMIN_USERNAME`;
- `ADMIN_PASSWORD`;
- `AUTH_SECRET`;
- `SETTINGS_ENCRYPTION_KEY`.

Após login bem-sucedido, o servidor emitirá um token de sessão assinado em cookie `HttpOnly`, `SameSite=Strict`, `Path=/` e `Secure` em produção. A sessão expirará após 12 horas. Logout invalida o cookie; alteração de `AUTH_SECRET` invalida todas as sessões existentes.

O endpoint de login limitará tentativas por endereço de origem em uma janela de 15 minutos. Respostas de autenticação não revelarão se o usuário ou a senha estava incorreto. Operações de escrita verificarão sessão, método, `Content-Type` e origem compatível para reduzir risco de CSRF.

A chave Anthropic será enviada somente por HTTPS quando a aplicação estiver publicada. Ela nunca será incluída em props de componentes cliente, HTML, logs, telemetria, mensagens de erro ou respostas da API.

### Criptografia das configurações

A chave Anthropic será criptografada com AES-256-GCM antes de entrar no SQLite. O registro guardará ciphertext, IV, authentication tag e versão do formato. A chave mestra ficará exclusivamente em `SETTINGS_ENCRYPTION_KEY`.

`GET /api/settings` retornará apenas:

- `apiKeyConfigured: boolean`;
- uma máscara com os últimos quatro caracteres, quando houver;
- modelo;
- template VEO 3;
- data da última alteração.

O segredo completo nunca será recuperável pela interface. O administrador poderá substituí-lo ou removê-lo.

## Persistência server-side

O SQLite será usado somente para configurações no MVP. Prisma gerenciará o schema e as migrações.

Modelo lógico:

```text
AppSettings
  id: singleton
  anthropicKeyCiphertext: string | null
  anthropicKeyIv: string | null
  anthropicKeyTag: string | null
  anthropicKeyVersion: integer | null
  anthropicKeyLastFour: string | null
  anthropicModel: string
  veoTemplate: string
  createdAt: datetime
  updatedAt: datetime
```

O arquivo do banco ficará sob `DATA_DIR`, com default local `./data`. O diretório deverá ser persistente e gravável no aaPanel. A aplicação criará o registro singleton com modelo e template padrão na primeira leitura.

## Configurações

A página `/configuracoes` terá três grupos:

1. **Credencial Anthropic:** status, máscara, substituir e remover.
2. **Modelo:** campo editável com default `claude-sonnet-5`.
3. **Template VEO 3:** editor multilinha, lista de variáveis aceitas e prévia com dados fictícios.

Variáveis aceitas no template:

- `{{produto}}`;
- `{{copy_completa}}`;
- `{{copy_trecho1}}`;
- `{{copy_trecho2}}`;
- `{{pov}}`;
- `{{ambiente}}`;
- `{{figurino}}`;
- `{{pose}}`;
- `{{prompt_gemini}}`.

O parser aceitará somente essa lista. Variáveis desconhecidas impedirão o salvamento e serão indicadas no editor. O template padrão conterá `{{copy_completa}}` e instruções para preservar fala natural em português brasileiro. O servidor renderizará um Prompt VEO 3 para cada criativo após a validação da saída Anthropic. Não haverá uma segunda chamada de IA.

O resultado incluirá a data de atualização da configuração usada. Alterar o template não modificará retroativamente resultados já armazenados no navegador.

## Formulário de nova geração

### Etapa 1 — Produto

Campos:

- nome do produto;
- categoria;
- descrição PDP;
- avaliações;
- nota média;
- quantidade de avaliações;
- preço atual;
- preço anterior;
- especificações críticas;
- público-alvo;
- perfil UGC;
- link do produto.

Nome, categoria, descrição PDP e perfil UGC são obrigatórios. Valores numéricos serão validados no cliente e novamente no servidor.

### Etapa 2 — Referências

Slots:

- uma a cinco fotos da pessoa UGC;
- uma a oito fotos do produto;
- zero a cinco prints do anúncio.

Formatos aceitos: JPEG, PNG e WEBP. Cada imagem será redimensionada no navegador para lado máximo de 1568 pixels e qualidade 85, preservando orientação. A interface mostrará miniatura, tamanho final, progresso e remoção individual.

As fotos UGC permanecem no navegador e não são enviadas à Anthropic. Somente fotos do produto e prints do anúncio seguem para `/api/generate` via `multipart/form-data`. O servidor valida tipo real, quantidade e tamanho antes de convertê-las nos blocos base64 da Claude API.

### Etapa 3 — Direção criativa

Configurações:

- quantidade de criativos, de um a oito, default cinco;
- ambientes permitidos;
- política de preço: sem preço, teto folgado ou preço exato com aviso;
- duração: 20 segundos em duas cenas, 15 segundos ou 30 segundos em três cenas;
- POV com emoji;
- máximo de palavras do POV, default 11;
- quantidade de hashtags, default cinco;
- tom de voz.

## Persistência no navegador

Os campos textuais e configurações do rascunho ficarão em `localStorage`. As imagens redimensionadas e o último resultado ficarão em IndexedDB, porque excedem o uso seguro de `localStorage`.

O resultado receberá um UUID gerado no navegador e será aberto em `/resultado/[id]`. O endereço funciona somente no mesmo navegador e perfil, pois o MVP não persiste gerações no servidor.

Falhas de API, logout e atualização da página não apagam o rascunho. Um comando explícito “limpar rascunho” removerá os dados locais após confirmação.

## Biblioteca mestra

A fonte é `outputs/copy-library-20260819/Biblioteca_Mestra_Copys_TikTok_Shop.xlsx`, com 75 vídeos únicos organizados nas abas Resumo, Catalogo, Hooks, Corpos, CTAs, Playbook, Hashtags e Fontes.

Um script reprodutível converterá a planilha para JSON versionado. O JSON conterá somente os campos editoriais necessários; URLs e caminhos de fonte serão mantidos para rastreabilidade, mas não enviados ao modelo quando não ajudarem a geração.

### Seleção de contexto

Cada geração incluirá:

1. playbook geral;
2. exemplos do mesmo produto ou com termos próximos;
3. exemplos da categoria selecionada;
4. mecanismos complementares quando o conjunto relevante for pequeno.

O corpus atual é concentrado em moda, casa e perfumaria. Para categorias com poucos exemplos, o filtro usará mecanismos editoriais — depoimento, benefícios, dor e solução, identidade, demonstração — em vez de preencher o contexto com produtos semanticamente distantes.

O seletor será determinístico e testável. O contexto filtrado será ordenado de forma estável para maximizar cache hits por categoria.

## Integração Anthropic

O servidor usará `@anthropic-ai/sdk`. O modelo default será `claude-sonnet-5`, configurável sem novo build. O Prompt do Sistema fornecido no briefing será preservado, exceto pela instrução final de saída: a versão atual usará `output_config.format` com JSON Schema, em vez de exigir uma chamada de ferramenta.

O contrato estruturado continuará contendo:

- produto normalizado, fatos e riscos;
- lista de criativos;
- Prompt Gemini;
- copy por trecho;
- descrição;
- hashtags;
- POV;
- texto na tela;
- descarte e motivo;
- checklist de publicação.

O schema da resposta terá `additionalProperties: false` em todos os objetos. Zod representará o mesmo contrato no código e fará validação defensiva adicional.

### Caching

O sistema colocará conteúdo estável no início do prompt. O bloco estável da biblioteca filtrada receberá um cache breakpoint explícito com `cache_control: { type: "ephemeral" }`. Dados do produto e imagens virão depois do conteúdo cacheável.

O filtro e a serialização deverão produzir bytes idênticos para entradas equivalentes. Uso de cache será registrado em logs apenas como contagens de tokens, nunca com conteúdo ou segredos.

### Requisição

O endpoint `POST /api/generate`:

1. autentica a sessão;
2. valida formulário e arquivos;
3. carrega e descriptografa a chave Anthropic;
4. seleciona a biblioteca;
5. monta sistema e mensagem do usuário;
6. chama a Messages API com saída estruturada;
7. trata recusa, erro de credencial, limite, timeout e indisponibilidade;
8. valida e normaliza a resposta;
9. renderiza o template VEO 3;
10. devolve resultado e metadados seguros.

A chamada terá timeout de 100 segundos. Não haverá repetição automática, porque uma nova tentativa pode gerar cobrança duplicada. O usuário poderá tentar novamente manualmente com o rascunho intacto.

## Validação editorial

O servidor recalculará todas as contagens. Valores informados pelo modelo são preservados apenas para comparação.

### Bloqueios

- quantidade de hashtags diferente da configuração;
- hashtag contendo dígito;
- valor monetário em copy ou descrição quando a política é `sem_preco`;
- ausência de qualquer um dos nove blocos obrigatórios no Prompt Gemini;
- ocorrência de “remova”, “tire” ou “substitua a roupa” no Prompt Gemini;
- variável desconhecida ou não substituída no Prompt VEO 3;
- schema estrutural inválido;
- dois criativos com ambiente, pose e conjunto de hashtags simultaneamente idênticos.

### Avisos

- POV acima do limite configurado;
- POV sem exatamente um emoji quando o emoji estiver habilitado;
- trecho de copy fora de 18 a 28 palavras;
- divergência relevante entre contagem do modelo e contagem real;
- conjunto de hashtags repetido;
- ambiente repetido;
- especificação ou alegação de risco detectada.

Campos com bloqueio serão exibidos para diagnóstico, mas seus botões de cópia ficarão desabilitados. Campos válidos do mesmo criativo continuarão copiáveis.

### Contagem

A contagem de palavras usará uma função central compartilhada pelo validador e pela exibição. Emoji será contado por segmentos Unicode, e valores monetários reconhecerão `R$`, “real”, “reais” e formatos numéricos brasileiros comuns.

## Resultados

O topo da tela mostrará:

- nome normalizado;
- fatos verificados;
- riscos detectados e mitigação;
- checklist de publicação;
- status geral da geração.

Cada card expansível mostrará:

- ID, ângulo e ambiente;
- figurino e pose;
- copy por trecho com contagem real;
- descrição;
- cinco hashtags;
- POV;
- texto na tela;
- Prompt Gemini;
- Prompt VEO 3 renderizado;
- alertas de validação;
- copiar campo e copiar pacote completo.

O visual será de estúdio criativo: fundo claro levemente quente, tipografia forte, cards brancos e acentos coral e roxo. A interface não copiará marcas ou elementos proprietários do TikTok. Contraste, foco visível, navegação por teclado e alvos de toque serão requisitos.

## Tratamento de erros

- **API não configurada:** mensagem com atalho para Configurações.
- **Credencial inválida:** mensagem específica sem incluir a credencial.
- **Recusa ou resposta incompleta:** resultado não é salvo; ação para tentar novamente.
- **Timeout:** mensagem após 100 segundos; rascunho preservado.
- **Falha de rede:** nova tentativa manual.
- **Violação editorial:** resultado exibido com bloqueios por campo.
- **Banco indisponível:** página segura de erro; nenhuma configuração é substituída.
- **Template inválido:** salvamento rejeitado com indicação das variáveis incorretas.

Erros do SDK serão mapeados para códigos internos estáveis. Logs conterão request ID, duração, modelo e uso de tokens quando disponível; não conterão prompts completos, imagens, chave, senha ou cookie.

## Testes

A implementação seguirá TDD com Vitest, Testing Library e Playwright.

### Unidade

- contagem de palavras e emoji;
- detecção de preço;
- regras de hashtags;
- verificação dos nove blocos;
- diferenciação entre criativos;
- parser e renderizador do template VEO 3;
- seleção determinística da biblioteca;
- criptografia e descriptografia;
- criação e validação da sessão.

### Integração

- login, logout e proteção de rotas;
- limite de tentativas;
- leitura e gravação mascarada das configurações;
- chave cifrada no SQLite;
- montagem da requisição Anthropic;
- recusa, timeout, credencial inválida e resposta válida;
- validação e renderização do resultado.

### Interface e fluxo completo

- navegação pelas três etapas;
- validação de campos obrigatórios;
- redimensionamento e remoção de uploads;
- restauração do rascunho;
- login, configuração e geração com Anthropic simulada;
- exibição e cópia de Prompt Gemini e VEO 3;
- impossibilidade de copiar campo bloqueado;
- preservação após falha.

Os testes não chamarão a API real. O cliente Anthropic será injetável e substituído por um fake determinístico.

## Critérios de aceite

1. Nenhum segredo aparece no bundle cliente, HTML, logs ou respostas HTTP.
2. Páginas e APIs privadas rejeitam acesso sem sessão.
3. A chave Anthropic aparece cifrada no arquivo SQLite e mascarada na interface.
4. Dez fixtures consecutivas com política `sem_preco` não liberam valor monetário.
5. Todo POV é contado no servidor e alertado quando viola o limite.
6. Todo Prompt Gemini contém os nove blocos e nenhuma instrução de remoção de roupa.
7. Nenhum par de criativos compartilha simultaneamente ambiente, pose e conjunto de hashtags.
8. Todo Prompt VEO 3 sai sem variáveis pendentes e contém a copy correta do criativo.
9. Falhas preservam o formulário e oferecem ação clara.
10. O build `standalone` inicia como processo Node sem dependência de Vercel.
11. Uma geração real de cinco criativos é medida separadamente; a meta é menos de 90 segundos, sem tornar o teste automatizado dependente da latência externa.

## Operação no aaPanel

A documentação de implantação posterior deverá exigir:

- Node.js 20.9 ou superior;
- diretório persistente e gravável para `DATA_DIR`;
- todas as variáveis de ambiente de autenticação e criptografia;
- proxy reverso com HTTPS;
- limite de corpo compatível com as imagens redimensionadas;
- timeout do proxy superior a 100 segundos;
- execução das migrações antes de iniciar a nova versão;
- backup do SQLite antes de migrações futuras.

O MVP será entregue localmente. Publicação, DNS, certificado e configuração efetiva do aaPanel não fazem parte desta implementação.

## Referências técnicas verificadas

- Next.js Installation: https://nextjs.org/docs/app/getting-started/installation
- Next.js Deploying: https://nextjs.org/docs/app/getting-started/deploying
- Claude Models Overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Claude Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Claude Prompt Caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
