export const VEO_VARIABLES = [
  "produto",
  "copy_completa",
  "copy_trecho1",
  "copy_trecho2",
  "pov",
  "ambiente",
  "figurino",
  "pose",
  "prompt_gemini",
] as const;

export type VeoVariables = Record<(typeof VEO_VARIABLES)[number], string>;

const variablePattern = /{{\s*([^{}\s]+)\s*}}/g;
const allowedVariables = new Set<string>(VEO_VARIABLES);

export function validateVeoTemplate(template: string): { valid: true; unknown: [] } | { valid: false; unknown: string[] } {
  const unknown = [...template.matchAll(variablePattern)]
    .map((match) => match[1])
    .filter((variable, index, variables) => !allowedVariables.has(variable) && variables.indexOf(variable) === index);

  return unknown.length === 0 ? { valid: true, unknown: [] } : { valid: false, unknown };
}

export function renderVeoTemplate(template: string, values: VeoVariables): string {
  const validation = validateVeoTemplate(template);
  if (!validation.valid) throw new Error(`Template VEO contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);

  return template.replace(variablePattern, (_, variable: keyof VeoVariables) => values[variable]);
}
