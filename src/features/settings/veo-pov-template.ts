export const VEO_POV_VARIABLES = ["produto", "copy_trecho", "ambiente", "continuidade"] as const;

export type VeoPovVariables = Record<(typeof VEO_POV_VARIABLES)[number], string>;

const markerPattern = /{{([\s\S]*?)}}|{{|}}/g;
const completeMarkerPattern = /{{([\s\S]*?)}}/g;
const allowedVariables = new Set<string>(VEO_POV_VARIABLES);

export function validateVeoPovTemplate(template: string): { valid: true; unknown: [] } | { valid: false; unknown: string[] } {
  const unknown: string[] = [];
  for (const match of template.matchAll(markerPattern)) {
    const variable = match[1] === undefined ? match[0] : match[1].trim();
    if ((!allowedVariables.has(variable) || match[1] === undefined) && !unknown.includes(variable)) unknown.push(variable);
  }

  return unknown.length === 0 ? { valid: true, unknown: [] } : { valid: false, unknown };
}

export function renderVeoPovTemplate(template: string, values: VeoPovVariables): string {
  const validation = validateVeoPovTemplate(template);
  if (!validation.valid) throw new Error(`Template VEO POV contém variáveis não permitidas: ${validation.unknown.join(", ")}.`);

  const output = template.replace(completeMarkerPattern, (_, rawVariable: string) => {
    const variable = rawVariable.trim() as keyof VeoPovVariables;
    const value = values[variable];
    if (typeof value !== "string") throw new Error("O template VEO POV contém valores não resolvidos.");
    return value;
  });
  if (output.includes("{{") || output.includes("}}")) throw new Error("O template VEO POV contém valores não resolvidos.");
  return output;
}
