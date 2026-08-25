export const GEMINI_VARIABLES = [
  "identidade_ugc",
  "produto",
  "wardrobe_lock",
  "tecido",
  "evitar",
  "cenario",
  "iluminacao",
  "pose",
  "maos",
  "enquadramento_crop",
  "enquadramento_extra",
  "bloco_calcado",
  "bloco_interacao",
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
Frame-base para vídeo gerado no VEO 3 — precisa parecer uma foto real, não arte de e-commerce. Imagem única, sem painéis múltiplos ou colagem.

ORDEM DAS REFERÊNCIAS: as primeiras imagens anexadas são a MODELO (identity lock). As imagens seguintes são a PEÇA EXATA a ser vestida, quando o produto for vestuário — meça o corte e a textura por essas fotos, não pela descrição escrita.

IDENTITY LOCK:
{{identidade_ugc}}
Não altere feições, maquiagem natural leve nem estrutura corporal. Boca fechada com sorriso leve — o frame será animado para fala depois, não precisa estar falando aqui. A pele deve ser 100% fiel às fotos de referência: NÃO adicione tatuagem, sinal, cicatriz, piercing, mancha ou qualquer marca que não esteja clara e visivelmente presente nas fotos — na dúvida, não desenhe nada, pele limpa é o padrão. Quando uma tatuagem ou marca realmente existir nas fotos de referência, reproduza-a apenas sobre pele exposta, na posição exata mostrada — a roupa cobre a pele normalmente por cima dela, nunca deixe a marca aparecer sobre o tecido ou "vazando" através da roupa. Anatomia correta e real: exatamente dois braços, duas mãos, cinco dedos por mão, uma cabeça — nunca um braço, mão, dedo ou membro extra ou faltando, mesmo parcialmente visível na borda do quadro.

PRODUTO: {{produto}}

FIGURINO:
{{wardrobe_lock}}
Quando o figurino for a própria peça vendida, as imagens do produto são a referência ABSOLUTA de modelagem — copie exatamente o corte, a textura e as proporções, nunca uma versão genérica.

TECIDO:
{{tecido}}

EVITE: {{evitar}}

{{bloco_calcado}}CENÁRIO: {{cenario}}

ILUMINAÇÃO: {{iluminacao}}

{{bloco_interacao}}POSE: {{pose}}

ENQUADRAMENTO: {{enquadramento_crop}}. {{maos}}. Câmera fixa, altura do peito, leve ângulo de baixo para cima, foco nítido no rosto e na peça. {{enquadramento_extra}}

ÁUDIO: sem áudio. Esta é uma imagem estática.

ESTILO: fotografia natural, iluminação realista, sem efeito de estúdio, textura de pele real com poros e brilho natural, cores fiéis sem filtro saturado, estética autêntica de UGC de TikTok Shop.

RESTRIÇÕES UNIVERSAIS (aplicam sempre, sem exceção):
- Nenhum espelho, superfície espelhada ou reflexiva relevante na cena.
- Nenhum tripé, câmera, equipamento de gravação ou smartphone visível na cena, refletido ou não.
- Não é selfie e não é foto de espelho.
- Nenhuma tela de dispositivo exibindo app, fotos, miniaturas ou qualquer interface — telas aparecem apagadas ou pretas.
- Sem sobreposições visuais, sem texto na imagem, sem elementos gráficos, sem marca d'água.
- Nenhum logotipo ou nome de marca legível em nenhuma superfície.
- Não remover, trocar ou substituir peças de roupa. Não alterar proporções corporais. Peça sem amassados, rugas ou vincos, salvo indicação em contrário no bloco TECIDO.`;
