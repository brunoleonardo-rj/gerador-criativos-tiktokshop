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

const markerPattern = /{{([\s\S]*?)}}|{{|}}/g;
const completeMarkerPattern = /{{([\s\S]*?)}}/g;
const allowedVariables = new Set<string>(VEO_VARIABLES);

export function validateVeoTemplate(template: string): { valid: true; unknown: [] } | { valid: false; unknown: string[] } {
  const unknown: string[] = [];
  for (const match of template.matchAll(markerPattern)) {
    const variable = match[1] === undefined ? match[0] : match[1].trim();
    if ((!allowedVariables.has(variable) || match[1] === undefined) && !unknown.includes(variable)) unknown.push(variable);
  }

  return unknown.length === 0 ? { valid: true, unknown: [] } : { valid: false, unknown };
}

export function renderVeoTemplate(template: string, values: VeoVariables): string {
  const validation = validateVeoTemplate(template);
  if (!validation.valid) throw new Error(`Template VEO contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);

  const output = template.replace(completeMarkerPattern, (_, rawVariable: string) => {
    const variable = rawVariable.trim() as keyof VeoVariables;
    const value = values[variable];
    if (typeof value !== "string") throw new Error("O template VEO contém valores não resolvidos.");
    return value;
  });
  if (output.includes("{{") || output.includes("}}")) throw new Error("O template VEO contém valores não resolvidos.");
  return output;
}
