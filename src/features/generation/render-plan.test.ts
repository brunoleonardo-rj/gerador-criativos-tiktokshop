import { describe, expect, it } from "vitest";
import { deriveRenderPlan, figurinoInstruction, veoAnchorInstruction, type FormatoUso, type ZonaFoco } from "./render-plan";

describe("deriveRenderPlan", () => {
  it.each([
    ["vestido", "corpo_inteiro", { calcado: false, interacao: false }],
    ["vestido", "pernas_pes", { calcado: true, interacao: false }],
    ["vestido", "tronco", { calcado: false, interacao: false }],
    ["manuseado", "cabeca", { calcado: false, interacao: true }],
    ["aplicado_no_corpo", "cabeca", { calcado: false, interacao: true }],
    ["aplicado_no_corpo", "maos", { calcado: false, interacao: true }],
    ["ambiente", "objeto", { calcado: false, interacao: true }],
    ["consumido", "objeto", { calcado: false, interacao: true }],
  ] as [FormatoUso, ZonaFoco, { calcado: boolean; interacao: boolean }][])("formatoUso=%s zonaFoco=%s", (formatoUso, zonaFoco, esperado) => {
    const plan = deriveRenderPlan({ formatoUso, zonaFoco, detalheCritico: null });
    expect(plan.blocos.calcado).toBe(esperado.calcado);
    expect(plan.blocos.interacaoProduto).toBe(esperado.interacao);
  });

  it("adiciona folga superior quando o braço sobe até a cabeça", () => {
    const plan = deriveRenderPlan({ formatoUso: "manuseado", zonaFoco: "cabeca", detalheCritico: null });
    expect(plan.enquadramentoExtra).toContain("folga acima da cabeça");
  });

  it("não adiciona folga superior quando o produto é vestido na cabeça (sem manuseio)", () => {
    const plan = deriveRenderPlan({ formatoUso: "vestido", zonaFoco: "cabeca", detalheCritico: null });
    expect(plan.enquadramentoExtra).not.toContain("folga acima da cabeça");
  });

  it("mãos livres nunca aparecem em produto manuseado, aplicado ou consumido", () => {
    for (const formato of ["manuseado", "aplicado_no_corpo", "consumido"] as const) {
      const plan = deriveRenderPlan({ formatoUso: formato, zonaFoco: "tronco", detalheCritico: null });
      expect(plan.maos).not.toContain("sem segurar nada");
    }
  });

  it("inclui o detalhe crítico na instrução de enquadramento quando presente", () => {
    const plan = deriveRenderPlan({ formatoUso: "vestido", zonaFoco: "pernas_pes", detalheCritico: "alça sob o pé" });
    expect(plan.enquadramentoExtra).toContain('"alça sob o pé"');
  });

  it("cobre a matriz de produtos reais do documento de validação", () => {
    const casos: [FormatoUso, ZonaFoco, { calcado: boolean; incluiPes: boolean }][] = [
      ["vestido", "corpo_inteiro", { calcado: false, incluiPes: false }],
      ["vestido", "pernas_pes", { calcado: true, incluiPes: true }],
      ["vestido", "tronco", { calcado: false, incluiPes: false }],
      ["manuseado", "cabeca", { calcado: false, incluiPes: false }],
      ["aplicado_no_corpo", "tronco", { calcado: false, incluiPes: false }],
      ["aplicado_no_corpo", "maos", { calcado: false, incluiPes: false }],
      ["manuseado", "cabeca", { calcado: false, incluiPes: false }],
      ["ambiente", "objeto", { calcado: false, incluiPes: false }],
      ["consumido", "objeto", { calcado: false, incluiPes: false }],
      ["vestido", "pernas_pes", { calcado: true, incluiPes: true }],
      ["vestido", "cabeca", { calcado: false, incluiPes: false }],
    ];
    for (const [formatoUso, zonaFoco, esperado] of casos) {
      const plan = deriveRenderPlan({ formatoUso, zonaFoco, detalheCritico: null });
      expect(plan.blocos.calcado).toBe(esperado.calcado);
      expect(plan.crop.incluiPes).toBe(esperado.incluiPes);
    }
  });
});

describe("figurinoInstruction", () => {
  it("usa o wardrobe lock quando o produto é vestido em uma zona do corpo", () => {
    expect(figurinoInstruction({ formatoUso: "vestido", zonaFoco: "corpo_inteiro", detalheCritico: null }, "Vestido midi azul, decote V.")).toBe("Vestido midi azul, decote V.");
  });

  it("ignora o wardrobe lock e usa roupa neutra para produto que não é vestuário", () => {
    const instrucao = figurinoInstruction({ formatoUso: "manuseado", zonaFoco: "cabeca", detalheCritico: null }, "Vestido midi azul, decote V.");
    expect(instrucao).not.toContain("Vestido midi azul");
    expect(instrucao).toContain("neutra");
  });

  it("usa roupa neutra mesmo com formatoUso vestido quando a zona é objeto", () => {
    const instrucao = figurinoInstruction({ formatoUso: "vestido", zonaFoco: "objeto", detalheCritico: null }, "Vestido midi azul, decote V.");
    expect(instrucao).toContain("neutra");
  });
});

describe("veoAnchorInstruction", () => {
  it.each(["manuseado", "aplicado_no_corpo", "consumido"] as FormatoUso[])("trava o produto na mão para formatoUso=%s", (formatoUso) => {
    const anchor = veoAnchorInstruction(formatoUso);
    expect(anchor.bloco).toContain("in her hand");
    expect(anchor.frameFinal).toContain("holding the product");
  });

  it("trava o produto vestido no corpo, não na mão", () => {
    const anchor = veoAnchorInstruction("vestido");
    expect(anchor.bloco).not.toContain("in her hand");
    expect(anchor.bloco).toContain("worn on her body");
    expect(anchor.frameFinal).toContain("still worn");
  });

  it("trava o produto apoiado no ambiente, sem contato com a mão", () => {
    const anchor = veoAnchorInstruction("ambiente");
    expect(anchor.bloco).not.toContain("continuously visible in her hand");
    expect(anchor.bloco).toContain("she never picks it up or touches it");
    expect(anchor.frameFinal).toContain("resting in the exact same spot");
    expect(anchor.frameFinal).not.toContain("holding");
  });
});
