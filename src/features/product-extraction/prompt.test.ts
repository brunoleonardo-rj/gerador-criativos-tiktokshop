import { describe, expect, it } from "vitest";
import { buildProductExtractionPrompt } from "./prompt";

const jpegSource = { mediaType: "image/jpeg" as const, data: "anBlZw==" };
const pngSource = { mediaType: "image/png" as const, data: "cG5n" };

describe("buildProductExtractionPrompt", () => {
  it("sends every source image before the extraction instruction", () => {
    const prompt = buildProductExtractionPrompt([jpegSource, pngSource]);
    const content = prompt.messages[0].content;

    expect(content).toHaveLength(3);
    expect(content[0]).toMatchObject({ type: "image" });
    expect(content[1]).toMatchObject({ type: "image" });
  });

  it("forbids guessing invisible facts", () => {
    expect(JSON.stringify(buildProductExtractionPrompt([jpegSource]))).toMatch(/não (invente|infira)/i);
  });
});
