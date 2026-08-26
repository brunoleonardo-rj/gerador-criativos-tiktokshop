import type { z } from "zod";
import { renderGeminiTemplate } from "@/features/settings/gemini-template";
import type { formatoUsoSchema, productProfileSchema, zonaFocoSchema } from "./render-plan-schema";
import type { GeminiSlots } from "./schema";

export type FormatoUso = z.infer<typeof formatoUsoSchema>;
export type ZonaFoco = z.infer<typeof zonaFocoSchema>;
export type ProductProfile = z.infer<typeof productProfileSchema>;

interface CropSpec {
  descricao: string;
  incluiPes: boolean;
}

export interface RenderPlan {
  crop: CropSpec;
  maos: string;
  blocos: { calcado: boolean; interacaoProduto: boolean; figurino: boolean };
  enquadramentoExtra: string;
}

const CROP_BY_ZONA: Record<ZonaFoco, CropSpec> = {
  cabeca: { descricao: "plano médio-curto, do busto para cima, com folga acima da cabeça", incluiPes: false },
  tronco: { descricao: "plano médio, da cintura para cima", incluiPes: false },
  corpo_inteiro: { descricao: "corpo inteiro, da cabeça até a altura das canelas, com os pés fora do quadro", incluiPes: false },
  pernas_pes: { descricao: "corpo inteiro, da cabeça aos pés, com os pés e tornozelos totalmente visíveis dentro do quadro", incluiPes: true },
  maos: { descricao: "plano médio, da cintura para cima, com as mãos claramente visíveis e em foco", incluiPes: false },
  objeto: { descricao: "plano médio incluindo a pessoa e o produto no ambiente", incluiPes: false },
};

const MAOS_BY_FORMATO: Record<FormatoUso, string> = {
  vestido: "mãos livres e relaxadas ao lado do corpo, sem segurar nada",
  manuseado: "uma das mãos segura o produto com pegada natural e firme; a outra fica relaxada ao lado do corpo ou apoia levemente",
  aplicado_no_corpo: "uma das mãos segura o produto, a outra executa a aplicação",
  consumido: "uma das mãos segura o produto na altura do peito, de forma natural",
  ambiente: "mãos livres e relaxadas; o produto aparece apoiado em uma superfície da cena",
};

export function deriveRenderPlan(profile: ProductProfile): RenderPlan {
  const crop = CROP_BY_ZONA[profile.zonaFoco];
  const manipulaProduto = profile.formatoUso !== "vestido";
  const extras: string[] = [];
  if (manipulaProduto && profile.zonaFoco === "cabeca") {
    extras.push("Deixe folga acima da cabeça suficiente para que o braço levantado e o produto caibam inteiros no quadro.");
  }
  if (profile.detalheCritico) {
    extras.push(`O detalhe "${profile.detalheCritico}" deve ficar nítido e legível sem precisar ampliar a imagem.`);
  }
  return {
    crop,
    maos: MAOS_BY_FORMATO[profile.formatoUso],
    blocos: { calcado: crop.incluiPes, interacaoProduto: manipulaProduto, figurino: true },
    enquadramentoExtra: extras.join(" "),
  };
}

export function figurinoInstruction(profile: ProductProfile, wardrobeLock: string | null): string {
  if (profile.formatoUso === "vestido" && profile.zonaFoco !== "objeto" && wardrobeLock) return wardrobeLock;
  return "Peça neutra e lisa, de cor sólida, sem estampa e sem logotipo, para não competir com o produto. Evite acessórios refletivos e peças chamativas na zona de foco.";
}

export function buildGeminiPrompt(template: string, slots: GeminiSlots, profile: ProductProfile, plan: RenderPlan): string {
  const blocoCalcado = plan.blocos.calcado
    ? `CALÇADO: ${slots.calcado} IGNORE o calçado das fotos de identidade — o calçado é definido apenas por esta seção.\n\n`
    : "";
  const blocoInteracao = plan.blocos.interacaoProduto
    ? profile.formatoUso === "ambiente"
      ? `AÇÃO E INTERAÇÃO COM O PRODUTO:\n${slots.acao}\n` +
        "O produto permanece apoiado e estável sobre uma superfície da cena — a pessoa não segura nem toca o produto neste quadro, as mãos ficam livres. Um único exemplar do produto na cena, em proporção correta em relação ao ambiente ao redor.\n\n"
      : `AÇÃO E INTERAÇÃO COM O PRODUTO:\n${slots.acao}\n` +
        "O produto aparece em contato real com a superfície ou parte do corpo em que é usado — o material se acomoda ao redor dele, sem atravessar o objeto e sem flutuar. O produto e o rosto ficam nítidos no mesmo plano de foco. Um único exemplar do produto na cena, em proporção correta em relação à mão.\n\n"
    : `AÇÃO:\n${slots.acao}\n\n`;
  return renderGeminiTemplate(template, {
    identidade_ugc: slots.identidadeUgc,
    produto: slots.produto,
    wardrobe_lock: figurinoInstruction(profile, slots.wardrobeLock),
    tecido: slots.tecido,
    evitar: slots.evitar,
    cenario: slots.cenario,
    iluminacao: slots.iluminacao,
    pose: slots.pose,
    maos: plan.maos,
    enquadramento_crop: plan.crop.descricao,
    enquadramento_extra: plan.enquadramentoExtra,
    bloco_calcado: blocoCalcado,
    bloco_interacao: blocoInteracao,
  });
}
