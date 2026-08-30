export const GEMINI_POV_VARIABLES = ["produto", "cenario", "acao", "evitar"] as const;

export type GeminiPovVariables = Record<(typeof GEMINI_POV_VARIABLES)[number], string>;

const markerPattern = /{{([\s\S]*?)}}|{{|}}/g;
const completeMarkerPattern = /{{([\s\S]*?)}}/g;
const allowedVariables = new Set<string>(GEMINI_POV_VARIABLES);

export function validateGeminiPovTemplate(template: string): { valid: true; unknown: [] } | { valid: false; unknown: string[] } {
  const unknown: string[] = [];
  for (const match of template.matchAll(markerPattern)) {
    const variable = match[1] === undefined ? match[0] : match[1].trim();
    if ((!allowedVariables.has(variable) || match[1] === undefined) && !unknown.includes(variable)) unknown.push(variable);
  }
  return unknown.length === 0 ? { valid: true, unknown: [] } : { valid: false, unknown };
}

export function renderGeminiPovTemplate(template: string, values: GeminiPovVariables): string {
  const validation = validateGeminiPovTemplate(template);
  if (!validation.valid) throw new Error(`Template Gemini POV contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);

  const output = template.replace(completeMarkerPattern, (_, rawVariable: string) => {
    const variable = rawVariable.trim() as keyof GeminiPovVariables;
    const value = values[variable];
    if (typeof value !== "string") throw new Error("O template Gemini POV contém valores não resolvidos.");
    return value;
  });
  if (output.includes("{{") || output.includes("}}")) throw new Error("O template Gemini POV contém valores não resolvidos.");
  return output;
}

export const DEFAULT_GEMINI_POV_TEMPLATE = `Imagem hiper-realista estilo POV no formato 9:16, como um frame de vídeo UGC gravado com a câmera traseira do celular. Mostrar apenas uma mão e parte do antebraço de uma pessoa jovem, sem rosto e sem celular visível, segurando ou interagindo com o produto em {{cenario}}.

Luz natural ou luz ambiente comum, enquadramento espontâneo, aparência de gravação real de celular — sem cara de estúdio, sem pose de still de produto.

Sem texto na imagem, sem interface, sem ícones, sem botão de play.

PRODUTO: {{produto}}
Use a imagem enviada como referência exata do produto — preserve exatamente o mesmo formato, proporções, cores, textos, marca, tampa, acabamento, material, brilho e qualquer outro detalhe visual. Não redesenhar, não substituir e não reinterpretar o produto.

AÇÃO: {{acao}}

EVITE: {{evitar}}. Mãos deformadas, dedos extras, produto instável, aparência de estúdio ou de imagem gerada por IA, rosto visível, celular visível, qualquer outra pessoa ou produto na cena.`;
