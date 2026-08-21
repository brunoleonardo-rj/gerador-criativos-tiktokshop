import { describe, expect, it } from "vitest";
import { calculateResizeDimensions } from "./resize";

describe("calculateResizeDimensions", () => {
  it("limits landscape, portrait, and square images while retaining proportion", () => {
    expect(calculateResizeDimensions(4000, 3000)).toEqual({ width: 1568, height: 1176 });
    expect(calculateResizeDimensions(3000, 4000)).toEqual({ width: 1176, height: 1568 });
    expect(calculateResizeDimensions(2000, 2000)).toEqual({ width: 1568, height: 1568 });
  });

  it("never enlarges smaller images and rounds dimensions", () => {
    expect(calculateResizeDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(calculateResizeDimensions(1569, 1000)).toEqual({ width: 1568, height: 999 });
  });

  it("rejects invalid source or maximum dimensions", () => {
    expect(() => calculateResizeDimensions(0, 100)).toThrow(/dimensions/i);
    expect(() => calculateResizeDimensions(100, Number.NaN)).toThrow(/dimensions/i);
    expect(() => calculateResizeDimensions(100, 100, 0)).toThrow(/maximum/i);
  });
});
