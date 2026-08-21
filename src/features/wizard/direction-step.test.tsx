import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DirectionStep } from "./direction-step";

describe("DirectionStep", () => {
  it("starts with the approved creative direction defaults", () => {
    render(<DirectionStep register={() => ({}) as never} errors={{}} />);
    expect(screen.getByLabelText("Quantidade de criativos")).toHaveValue(5);
    expect(screen.getByLabelText("Duração total")).toHaveValue("20");
    expect(screen.getByLabelText("Máximo de palavras do POV")).toHaveValue(11);
    expect(screen.getByLabelText("Quantidade de hashtags")).toHaveValue(5);
  });
});
