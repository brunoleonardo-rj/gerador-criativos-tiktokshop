export type FormatoUso = "vestido" | "manuseado" | "aplicado_no_corpo" | "consumido" | "ambiente";
export type ZonaFoco = "cabeca" | "tronco" | "corpo_inteiro" | "pernas_pes" | "maos" | "objeto";

export interface ProductProfile {
  formatoUso: FormatoUso;
  zonaFoco: ZonaFoco;
  detalheCritico: string | null;
}

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
  corpo_inteiro: { descricao: "corpo inteiro, da cabeça aos pés", incluiPes: true },
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

export function figurinoInstruction(profile: ProductProfile, wardrobeLock: string): string {
  if (profile.formatoUso === "vestido" && profile.zonaFoco !== "objeto") return wardrobeLock;
  return "Peça neutra e lisa, de cor sólida, sem estampa e sem logotipo, para não competir com o produto. Evite acessórios refletivos e peças chamativas na zona de foco.";
}
