import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadField } from "./upload-field";

vi.mock("./resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resize")>()),
  resizeImage: vi.fn(async (file: File) => ({ id: crypto.randomUUID(), role: "product", blob: new Blob([file], { type: "image/jpeg" }), name: file.name, type: "image/jpeg", width: 10, height: 10, size: 10 })),
}));

afterEach(cleanup);

describe("UploadField", () => {
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
});
