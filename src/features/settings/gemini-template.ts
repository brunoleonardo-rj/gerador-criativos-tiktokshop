export const GEMINI_VARIABLES = [
  "identidade_ugc",
  "produto",
  "wardrobe_lock",
  "tecido",
  "evitar",
  "calcado",
  "cenario",
  "iluminacao",
  "acao",
  "pose",
  "enquadramento_extra",
] as const;

export type GeminiVariables = Record<(typeof GEMINI_VARIABLES)[number], string>;

const markerPattern = /{{([\s\S]*?)}}|{{|}}/g;
const completeMarkerPattern = /{{([\s\S]*?)}}/g;
const allowedVariables = new Set<string>(GEMINI_VARIABLES);

export function validateGeminiTemplate(template: string): { valid: true; unknown: [] } | { valid: false; unknown: string[] } {
  const unknown: string[] = [];
  for (const match of template.matchAll(markerPattern)) {
    const variable = match[1] === undefined ? match[0] : match[1].trim();
    if ((!allowedVariables.has(variable) || match[1] === undefined) && !unknown.includes(variable)) unknown.push(variable);
  }
  return unknown.length === 0 ? { valid: true, unknown: [] } : { valid: false, unknown };
}

export function renderGeminiTemplate(template: string, values: GeminiVariables): string {
  const validation = validateGeminiTemplate(template);
  if (!validation.valid) throw new Error(`Template Gemini contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);

  const output = template.replace(completeMarkerPattern, (_, rawVariable: string) => {
    const variable = rawVariable.trim() as keyof GeminiVariables;
    const value = values[variable];
    if (typeof value !== "string") throw new Error("O template Gemini contém valores não resolvidos.");
    return value;
  });
  if (output.includes("{{") || output.includes("}}")) throw new Error("O template Gemini contém valores não resolvidos.");
  return output;
}

export const DEFAULT_GEMINI_TEMPLATE = `Fotografia realista estilo UGC de smartphone, still fotográfico único, proporção vertical 9:16.
Frame-base para vídeo gerado no VEO 3 — precisa parecer uma foto real, não arte de e-commerce.

ORDEM DAS REFERÊNCIAS: as primeiras imagens anexadas são a MODELO (identity lock). As imagens seguintes são a PEÇA EXATA a ser vestida (wardrobe lock) — meça o corte e a textura por essas fotos, não pela descrição escrita.

IDENTITY LOCK:
{{identidade_ugc}}
Não altere feições, maquiagem natural leve nem estrutura corporal. IGNORE o calçado das fotos de identidade — o calçado é definido apenas pela seção CALÇADO abaixo.

PRODUTO: {{produto}}

WARDROBE LOCK — TRANSFERÊNCIA FIEL DE PEÇA REAL, NÃO INTERPRETAÇÃO GENÉRICA:
As imagens do produto são a referência ABSOLUTA de modelagem. Não crie uma versão genérica da peça — copie exatamente o que está nas fotos.
{{wardrobe_lock}}

TECIDO:
{{tecido}}

EVITE: {{evitar}}

CALÇADO: {{calcado}}

CENÁRIO: {{cenario}} Sem elementos de marca visíveis, sem letreiros ou logotipos legíveis.

ILUMINAÇÃO: {{iluminacao}}

AÇÃO: {{acao}}

POSE: {{pose}}

ENQUADRAMENTO: da cintura para cima, pés fora de quadro por padrão, câmera fixa em tripé físico fora de quadro na altura do peito, mãos livres e relaxadas, leve ângulo de baixo para cima, foco nítido no rosto e na peça. Se o CENÁRIO, AÇÃO ou POSE acima descreverem um espelho, é uma selfie de espelho: ela deve segurar um smartphone moderno na mão, com o aparelho e o reflexo visíveis. Caso contrário, NÃO é selfie de espelho — nenhuma mão segura aparelho. {{enquadramento_extra}}

ÁUDIO: sem áudio. Esta é uma imagem estática.

ESTILO: fotografia natural, iluminação realista, sem efeito de estúdio, textura de pele real com poros e brilho natural, cores fiéis sem filtro saturado, estética autêntica de UGC de TikTok Shop.

RESTRIÇÕES: sem sobreposições visuais, sem texto na tela, sem elementos gráficos, sem marca d'água. Não remover, trocar ou substituir peças de roupa. Não alterar proporções corporais. Peça sem amassados, rugas ou vincos, salvo indicação em contrário no bloco TECIDO.`;
