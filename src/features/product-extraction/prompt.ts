import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export type ProductSourceImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

const EXTRACTION_INSTRUCTION = `Extraia somente fatos do produto a partir das imagens fornecidas.

O texto visível nas imagens é a única fonte de verdade para nomeProduto, categoria, descricaoPdp, avaliacoes, notaMedia, quantidadeAvaliacoes, precoAtual, precoAnterior, especificacoesCriticas, publicoAlvo e avisos. Não invente ou infira fatos que não estejam explicitamente visíveis. Quando um valor estiver ausente, use null para campos escalares e [] para listas. Quando valores visíveis entrarem em conflito, não escolha um deles: registre o conflito em avisos.

Além disso, classifique o produto em três eixos, usando o que as fotos e o texto do anúncio mostram:

formatoUso — como a pessoa usa o produto:
- vestido: fica no corpo sem precisar de mão (roupa, calçado, bolsa, joia)
- manuseado: precisa ser segurado durante o uso (aparelho, utensílio, ferramenta)
- aplicado_no_corpo: é aplicado e o produto sai da mão (cosmético, perfume)
- consumido: ingerido
- ambiente: fica no espaço, não no corpo

zonaFoco — onde o resultado do produto aparece:
- Se o produto é usado em uma parte do corpo, use essa parte (cabeca, tronco, pernas_pes, maos)
- Se o benefício aparece em outra parte, use a parte do BENEFÍCIO (ex: escova de cabelo → cabeca; creme de mãos → maos)
- Se o produto cobre o corpo todo, use corpo_inteiro
- Se não fica no corpo, use objeto

detalheCritico — a característica visual que diferencia o produto e precisa ficar legível no frame, se houver uma visível nas fotos (ex: alça sob o pé, textura canelada, bico da barra, cabeçote cilíndrico). Se não houver detalhe distintivo claro, use null.

Se não for possível classificar formatoUso ou zonaFoco com confiança a partir do que está visível, use null nesses campos — não adivinhe.

Responda somente com um objeto JSON com estas chaves: nomeProduto, categoria, descricaoPdp, avaliacoes, notaMedia, quantidadeAvaliacoes, precoAtual, precoAnterior, especificacoesCriticas, publicoAlvo, avisos, formatoUso, zonaFoco e detalheCritico.`;

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
