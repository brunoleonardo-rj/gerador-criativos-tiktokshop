import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibrarySettings } from "./library-settings";
describe("LibrarySettings", () => { afterEach(() => { cleanup(); vi.unstubAllGlobals(); }); it("keeps the active version visible when loading status fails", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false })); render(<LibrarySettings />); expect(await screen.findByText(/não foi possível carregar a biblioteca ativa/i)).toBeInTheDocument(); }); });
