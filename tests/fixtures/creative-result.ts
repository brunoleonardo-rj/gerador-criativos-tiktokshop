import type { CreativeBatch, GenerationInput } from "../../src/features/generation/schema";

export function generationInputFixture(overrides: Record<string, unknown> = {}): GenerationInput {
  return {
    nomeProduto: "Garrafa térmica",
    categoria: "Casa",
    descricaoPdp: "Garrafa de aço para bebidas.",
    perfilUgc: "Pessoa adulta mostrando a rotina.",
    quantidadeCriativos: 1,
    ambientesPermitidos: ["cozinha"],
    politicaPreco: "sem_preco",
    duracaoTotal: 20,
    povComEmoji: true,
    maxPalavrasPov: 11,
    quantidadeHashtags: 5,
    tomVoz: "natural",
    productProfile: { formatoUso: "manuseado", zonaFoco: "maos", detalheCritico: null },
    ...overrides,
  } as GenerationInput;
}

export function creativeBatchFixture(overrides: Record<string, unknown> = {}): CreativeBatch {
  const seconds = (overrides.segmentSeconds as [number, number, number | null] | undefined) ?? [10, 10, null];
  const trecho1 = overrides.trecho1 as Record<string, unknown> | undefined;
  const creative = {
    id: "creative-1",
    angulo: "Rotina prática",
    ambiente: "cozinha",
    figurino: "camiseta bege",
    pose: "segurando a garrafa",
    geminiSlots: {
      identidadeUgc: "Preserve exatamente a pessoa adulta das imagens de referência.",
      produto: "Garrafa térmica",
      wardrobeLock: "Camiseta bege casual sem estampas.",
      tecido: "Malha lisa com caimento natural.",
      evitar: "Não adicionar estampas, logotipos ou acessórios.",
      calcado: "Tênis casual neutro, não usar salto.",
      cenario: "Cozinha clara e residencial.",
      iluminacao: "Luz natural lateral.",
      acao: "A personagem mostra a garrafa sem cobrir o produto.",
      pose: "Em pé, postura relaxada.",
    },
    speechBeats: [{ triggerWord: "água", cameraMove: "quick push-in", gesture: "gesture beside the bottle", visibleResult: "the bottle remains fully visible" }],
    copy: {
      trecho1: { texto: "Eu deixo minha água pronta logo cedo para não esquecer durante a rotina.", palavras: 14, segundos: seconds[0], ...trecho1 },
      trecho2: { texto: "Ela fica comigo na bancada e eu consigo beber mais água sem complicar meu dia.", palavras: 16, segundos: seconds[1] },
      trecho3: seconds[2] === null ? null : { texto: "No fim, é uma escolha simples que deixa minha rotina muito mais organizada todos os dias.", palavras: 17, segundos: seconds[2] },
    },
    descricao: "Uma garrafa prática para acompanhar a rotina.",
    hashtags: ["#rotina", "#casa", "#bemestar", "#organizacao", "#garrafa"],
    pov: { texto: "POV: você finalmente bebe água 💧", palavras: 6, emoji: "💧" },
    textoNaTela: null,
    descartavel: false,
    motivoDescartavel: null,
  };
  const rest = Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "segmentSeconds" && key !== "trecho1"));
  return { produtoNormalizado: "Garrafa térmica", fatos: ["Material conforme PDP."], riscos: [], checklistPublicacao: ["Revisar produto no vídeo."], creatives: [{ ...creative, ...rest }] } as CreativeBatch;
}
