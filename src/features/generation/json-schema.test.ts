import { describe, expect, it } from "vitest";
import { getAnthropicOutputFormat } from "./json-schema";

function everyObjectIsClosed(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(everyObjectIsClosed);
  if (!value || typeof value !== "object") return true;
  const record = value as Record<string, unknown>;
  return (record.type !== "object" || record.additionalProperties === false) && Object.values(record).every(everyObjectIsClosed);
}
describe("Anthropic JSON Schema", () => {
  it("fecha todos os objetos e permite trecho3 nulo", () => {
    const format = getAnthropicOutputFormat();
    expect(everyObjectIsClosed(format.schema)).toBe(true);
    const root = format.schema as { properties: Record<string, { items: { properties: Record<string, { properties: Record<string, unknown> }> } }> };
    const copy = root.properties.creatives.items.properties.copy.properties.trecho3;
    expect(JSON.stringify(copy)).toContain("null");
  });
});
