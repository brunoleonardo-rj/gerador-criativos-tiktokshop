import { describe, expect, it } from "vitest";
import { renderVeoPovTemplate, validateVeoPovTemplate, type VeoPovVariables } from "./veo-pov-template";

const values: VeoPovVariables = {
  produto: "Garrafa térmica Aurora",
  copy_trecho: "Eu levo essa garrafa comigo o dia todo,",
  ambiente: "cozinha iluminada",
  continuidade: "",
};

describe("VEO POV template", () => {
  it("rejeita variável VEO POV desconhecida", () => {
    expect(validateVeoPovTemplate("Fale {{copy_trecho}} e {{variavel_inventada}}")).toEqual({
      valid: false,
      unknown: ["variavel_inventada"],
    });
  });

  it("renderiza o trecho de fala sem marcadores pendentes", () => {
    const output = renderVeoPovTemplate("Produto {{produto}}\nFala: {{copy_trecho}}", values);

    expect(output).toContain("Fala: Eu levo essa garrafa comigo o dia todo,");
    expect(output).not.toMatch(/{{/);
  });

  it("não renderiza valores ausentes ou marcadores pendentes", () => {
    expect(() => renderVeoPovTemplate("{{produto", values)).toThrow();
    expect(() => renderVeoPovTemplate("{{produto}}", { ...values, produto: undefined } as never)).toThrow();
    expect(() => renderVeoPovTemplate("{{produto}}", { ...values, produto: "{{pendente}}" })).toThrow();
  });
});
