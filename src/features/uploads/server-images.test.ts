import { describe, expect, it } from "vitest";
import {
  collectImageFields,
  parseBoundedMultipart,
} from "./server-images";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function imageFile(
  bytes: Uint8Array<ArrayBuffer>,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): File {
  return new File([bytes], "image", { type: mediaType });
}

function imageForm(
  entries: Array<{
    field: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    bytes: Uint8Array<ArrayBuffer>;
  }>,
): FormData {
  const form = new FormData();
  for (const entry of entries) {
    form.append(entry.field, imageFile(entry.bytes, entry.mediaType));
  }
  return form;
}

describe("parseBoundedMultipart", () => {
  it("rejects a declared body larger than the configured limit", async () => {
    const request = new Request("http://local/upload", {
      method: "POST",
      headers: {
        "content-length": "11",
        "content-type": "multipart/form-data; boundary=test",
      },
      body: new Uint8Array([1]),
    });

    await expect(parseBoundedMultipart(request, 10)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("rejects a streamed body as soon as it crosses the configured limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
        controller.close();
      },
    });
    const request = new Request("http://local/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: stream,
      duplex: "half",
    } as RequestInit);

    await expect(parseBoundedMultipart(request, 4)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("rejects non-multipart content before parsing the body", async () => {
    const request = new Request("http://local/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    await expect(parseBoundedMultipart(request, 10)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });
});

describe("collectImageFields", () => {
  it.each([
    ["image/jpeg", jpeg, "/9j/2w=="],
    ["image/png", png, "iVBORw0KGgo="],
    ["image/webp", webp, "UklGRgAAAABXRUJQ"],
  ] as const)("accepts %s only when its magic bytes match", async (mediaType, bytes, data) => {
    const form = imageForm([{ field: "source", mediaType, bytes }]);

    await expect(
      collectImageFields(form, { source: { min: 1, max: 8 } }, []),
    ).resolves.toEqual([{ field: "source", mediaType, data }]);
  });

  it.each([
    ["image/jpeg", png],
    ["image/png", webp],
    ["image/webp", jpeg],
  ] as const)("rejects a %s declaration with mismatched magic bytes", async (mediaType, bytes) => {
    const form = imageForm([{ field: "source", mediaType, bytes }]);

    await expect(
      collectImageFields(form, { source: { min: 1, max: 8 } }, []),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("rejects an unsupported declared MIME type even with valid image magic bytes", async () => {
    const form = new FormData();
    form.append("source", new File([jpeg], "image", { type: "image/gif" }));

    await expect(
      collectImageFields(form, { source: { min: 1, max: 8 } }, []),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it.each(["text", "file"])("rejects an unknown %s field", async (kind) => {
    const form = new FormData();
    if (kind === "text") form.append("unknown", "value");
    else form.append("unknown", imageFile(jpeg, "image/jpeg"));

    await expect(
      collectImageFields(form, { source: { min: 0, max: 8 } }, []),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("allows listed non-file fields", async () => {
    const valid = new FormData();
    valid.append("payload", "{}");
    await expect(
      collectImageFields(valid, { source: { min: 0, max: 8 } }, ["payload"]),
    ).resolves.toEqual([]);
  });

  it("rejects a file under a listed non-file field", async () => {
    const invalid = new FormData();
    invalid.append("payload", imageFile(jpeg, "image/jpeg"));
    await expect(
      collectImageFields(invalid, { source: { min: 0, max: 8 } }, ["payload"]),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("enforces each image field's minimum count", async () => {
    await expect(
      collectImageFields(new FormData(), { source: { min: 1, max: 8 } }, []),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("enforces each image field's maximum count", async () => {
    const form = imageForm([
      { field: "source", mediaType: "image/jpeg", bytes: jpeg },
      { field: "source", mediaType: "image/jpeg", bytes: jpeg },
    ]);

    await expect(
      collectImageFields(form, { source: { min: 0, max: 1 } }, []),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("accepts an image at the 3 MiB limit", async () => {
    const exact = new Uint8Array(3 * 1024 * 1024);
    exact.set(jpeg);
    await expect(
      collectImageFields(
        imageForm([{ field: "source", mediaType: "image/jpeg", bytes: exact }]),
        { source: { min: 1, max: 1 } },
        [],
      ),
    ).resolves.toHaveLength(1);
  });

  it("rejects the first byte over the 3 MiB limit", async () => {
    const oversized = new Uint8Array(3 * 1024 * 1024 + 1);
    oversized.set(jpeg);
    await expect(
      collectImageFields(
        imageForm([{ field: "source", mediaType: "image/jpeg", bytes: oversized }]),
        { source: { min: 1, max: 1 } },
        [],
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});
