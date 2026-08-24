import { describe, expect, it } from "vitest";
import { getAnthropicOutputFormat } from "./json-schema";

function everyObjectIsClosed(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(everyObjectIsClosed);
  if (!value || typeof value !== "object") return true;
  const record = value as Record<string, unknown>;
  return (record.type !== "object" || record.additionalProperties === false) && Object.values(record).every(everyObjectIsClosed);
}
function findProperty(value: unknown, name: string): unknown {
  if (Array.isArray(value)) return value.map((item) => findProperty(item, name)).find(Boolean);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const properties = record.properties as Record<string, unknown> | undefined;
  if (properties && name in properties) return properties[name];
  return Object.values(record).map((item) => findProperty(item, name)).find(Boolean);
}
describe("Anthropic JSON Schema", () => {
  it("fecha todos os objetos e permite trecho3 nulo", () => {
    const format = getAnthropicOutputFormat();
    expect(everyObjectIsClosed(format.schema)).toBe(true);
    expect(JSON.stringify(format.schema)).not.toMatch(/"(?:minimum|maximum|minLength|maxLength|maxItems)":/);
    expect(JSON.stringify(findProperty(format.schema, "trecho3"))).toContain("null");
    expect(findProperty(format.schema, "geminiSlots")).toBeDefined();
    expect(findProperty(format.schema, "speechBeats")).toBeDefined();
    expect(findProperty(format.schema, "promptGemini")).toBeUndefined();
  });
});
