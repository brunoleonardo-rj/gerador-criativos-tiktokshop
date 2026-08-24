import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadField } from "./upload-field";
import { resizeImage } from "./resize";

vi.mock("./resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resize")>()),
  resizeImage: vi.fn(async (file: File) => ({ id: crypto.randomUUID(), role: "product", blob: new Blob([file], { type: "image/jpeg" }), name: file.name, type: "image/jpeg", width: 10, height: 10, size: 10 })),
}));

afterEach(cleanup);

describe("UploadField", () => {
  it("uses a custom label and help without changing the UGC defaults", () => {
    const onChange = vi.fn();
    const custom = render(<UploadField role="product" min={1} max={8} items={[]} onChange={onChange} label="Fotos e prints do produto" help="Inclua embalagem e detalhes do anúncio." />);

    expect(screen.getByRole("group", { name: "Fotos e prints do produto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fotos e prints do produto")).toHaveAccessibleDescription("Inclua embalagem e detalhes do anúncio.");

    custom.unmount();
    render(<UploadField role="ugc" min={1} max={5} items={[]} onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Fotos da pessoa UGC" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fotos da pessoa UGC")).toHaveAccessibleDescription("Selecione entre 1 e 5 imagens. JPEG, PNG ou WEBP.");
  });

  it("adds valid selected images up to the received limit", async () => {
    const onChange = vi.fn();
    render(<UploadField role="product" min={1} max={1} items={[]} onChange={onChange} />);
    const input = screen.getByLabelText(/fotos do produto/i);
    fireEvent.change(input, { target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(screen.getByText(/máximo de 1/i)).toBeInTheDocument();
  });

  it("reports an unsupported file without discarding a valid one", async () => {
    const onChange = vi.fn();
    render(<UploadField role="ad" min={0} max={5} items={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/prints do anúncio/i), { target: { files: [new File(["a"], "ok.png", { type: "image/png" }), new File(["x"], "bad.gif", { type: "image/gif" })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(/JPEG, PNG ou WEBP/i);
  });

  it("rejects a misleading extension even when its MIME type claims to be valid", async () => {
    const onChange = vi.fn();
    render(<UploadField role="ad" min={0} max={5} items={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/prints do anúncio/i), { target: { files: [new File(["x"], "disfarce.gif", { type: "image/jpeg" })] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/JPEG, PNG ou WEBP/i));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes an individual item with an accessible control", async () => {
    const onChange = vi.fn();
    const item = { id: "image-1", role: "ugc" as const, blob: new Blob(["x"], { type: "image/jpeg" }), name: "pessoa.jpg", type: "image/jpeg" as const, width: 10, height: 10, size: 1 };
    render(<UploadField role="ugc" min={1} max={5} items={[item]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /remover pessoa.jpg/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("serializes selections so late image processing cannot overwrite an earlier selection", async () => {
    const onChange = vi.fn();
    let resolveFirst!: (value: { blob: Blob; name: string; type: "image/jpeg"; width: number; height: number; size: number }) => void;
    let resolveSecond!: (value: { blob: Blob; name: string; type: "image/jpeg"; width: number; height: number; size: number }) => void;
    vi.mocked(resizeImage).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; })).mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<UploadField role="product" min={1} max={2} items={[]} onChange={onChange} />);
    const input = screen.getByLabelText(/fotos do produto/i);
    fireEvent.change(input, { target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] } });
    fireEvent.change(input, { target: { files: [new File(["b"], "b.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    resolveFirst({ blob: new Blob(["a"], { type: "image/jpeg" }), name: "a.jpg", type: "image/jpeg", width: 1, height: 1, size: 1 });
    await waitFor(() => expect(resolveSecond).toBeTypeOf("function"));
    resolveSecond({ blob: new Blob(["b"], { type: "image/jpeg" }), name: "b.jpg", type: "image/jpeg", width: 1, height: 1, size: 1 });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ name: "a.jpg" }), expect.objectContaining({ name: "b.jpg" })])));
    expect(onChange.mock.lastCall?.[0].map((item: { name: string }) => item.name)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("applies a completed resize to the latest external items without resurrecting a removed item", async () => {
    const onChange = vi.fn();
    let resolveResize!: (value: { blob: Blob; name: string; type: "image/jpeg"; width: number; height: number; size: number }) => void;
    vi.mocked(resizeImage).mockImplementationOnce(() => new Promise((resolve) => { resolveResize = resolve; }));
    const removed = { id: "removida", role: "product" as const, blob: new Blob(["old"], { type: "image/jpeg" }), name: "removida.jpg", type: "image/jpeg" as const, width: 1, height: 1, size: 1 };
    const external = { id: "externa", role: "product" as const, blob: new Blob(["new"], { type: "image/jpeg" }), name: "externa.jpg", type: "image/jpeg" as const, width: 1, height: 1, size: 1 };
    const view = render(<UploadField role="product" min={1} max={3} items={[removed]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/fotos do produto/i), { target: { files: [new File(["x"], "processada.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(resolveResize).toBeTypeOf("function"));
    act(() => view.rerender(<UploadField role="product" min={1} max={3} items={[external]} onChange={onChange} />));
    resolveResize({ blob: new Blob(["x"], { type: "image/jpeg" }), name: "processada.jpg", type: "image/jpeg", width: 1, height: 1, size: 1 });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ name: "externa.jpg" }), expect.objectContaining({ name: "processada.jpg" })])));
    expect(onChange.mock.lastCall?.[0].map((item: { name: string }) => item.name)).toEqual(["externa.jpg", "processada.jpg"]);
  });

  it("discards an in-flight resize when the field becomes disabled", async () => {
    const onChange = vi.fn();
    let resolveResize!: (value: { blob: Blob; name: string; type: "image/jpeg"; width: number; height: number; size: number }) => void;
    vi.mocked(resizeImage).mockImplementationOnce(() => new Promise((resolve) => { resolveResize = resolve; }));
    const view = render(<UploadField role="product" min={1} max={3} items={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/fotos do produto/i), { target: { files: [new File(["x"], "processada.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(resolveResize).toBeTypeOf("function"));
    act(() => view.rerender(<UploadField role="product" min={1} max={3} items={[]} disabled onChange={onChange} />));
    resolveResize({ blob: new Blob(["x"], { type: "image/jpeg" }), name: "processada.jpg", type: "image/jpeg", width: 1, height: 1, size: 1 });

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});
