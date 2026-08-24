import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export type ProductSourceImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

const EXTRACTION_INSTRUCTION = `Extraia somente fatos do produto a partir das imagens fornecidas.

O texto visível nas imagens é a única fonte de verdade. Não invente ou infira fatos que não estejam explicitamente visíveis. Quando um valor estiver ausente, use null para campos escalares e [] para listas. Quando valores visíveis entrarem em conflito, não escolha um deles: registre o conflito em avisos.

Responda somente com um objeto JSON com estas chaves: nomeProduto, categoria, descricaoPdp, avaliacoes, notaMedia, quantidadeAvaliacoes, precoAtual, precoAnterior, especificacoesCriticas, publicoAlvo e avisos.`;

export function buildProductExtractionPrompt(images: ProductSourceImage[]): { system: TextBlockParam[]; messages: MessageParam[] } {
  const content: ContentBlockParam[] = images.map((image) => ({
    type: "image",
    source: { type: "base64", media_type: image.mediaType, data: image.data },
  }));
  content.push({ type: "text", text: EXTRACTION_INSTRUCTION });

  return {
    system: [{ type: "text", text: "Você é um extrator factual de dados de produto." }],
    messages: [{ role: "user", content }],
  };
}
