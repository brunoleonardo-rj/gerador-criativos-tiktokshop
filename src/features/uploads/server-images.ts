import "server-only";
import { Buffer } from "node:buffer";
import type { ProductSourceImage } from "../product-extraction/prompt";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const supportedMediaTypes = new Set<ProductSourceImage["mediaType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadRequestErrorCode = "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE";

export class UploadRequestFailure extends Error {
  constructor(readonly code: UploadRequestErrorCode) {
    super(code);
    this.name = "UploadRequestFailure";
  }
}

export type ValidatedServerImage = {
  field: string;
  mediaType: ProductSourceImage["mediaType"];
  data: string;
};

type ImageFieldSpecs = Readonly<
  Record<string, Readonly<{ min: number; max: number }>>
>;

function fail(code: UploadRequestErrorCode): never {
  throw new UploadRequestFailure(code);
}

async function ensureBoundedBody(
  request: Request,
  maxBodyBytes: number,
): Promise<void> {
  const declared = request.headers.get("content-length");
  if (
    declared &&
    /^\d+$/u.test(declared) &&
    Number(declared) > maxBodyBytes
  ) {
    fail("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) fail("INVALID_REQUEST");

  const reader = request.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        fail("PAYLOAD_TOO_LARGE");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function parseBoundedMultipart(
  request: Request,
  maxBodyBytes: number,
): Promise<FormData> {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.startsWith("multipart/form-data;")) {
    fail("INVALID_REQUEST");
  }

  try {
    await ensureBoundedBody(request.clone(), maxBodyBytes);
    return await request.formData();
  } catch (error) {
    if (error instanceof UploadRequestFailure) throw error;
    fail("INVALID_REQUEST");
  }
}

function isSupportedMediaType(
  mediaType: string,
): mediaType is ProductSourceImage["mediaType"] {
  return supportedMediaTypes.has(mediaType as ProductSourceImage["mediaType"]);
}

function matchesMagicBytes(
  bytes: Uint8Array,
  mediaType: ProductSourceImage["mediaType"],
): boolean {
  if (mediaType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mediaType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      bytes.length >= signature.length &&
      signature.every((byte, index) => bytes[index] === byte)
    );
  }
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export async function collectImageFields(
  form: FormData,
  specs: ImageFieldSpecs,
  allowedNonFileFields: readonly string[],
): Promise<ValidatedServerImage[]> {
  const allowedTextFields = new Set(allowedNonFileFields);
  const counts: Record<string, number> = {};
  const images: ValidatedServerImage[] = [];

  for (const [field, value] of form.entries()) {
    const spec = Object.prototype.hasOwnProperty.call(specs, field)
      ? specs[field]
      : undefined;
    if (!spec) {
      if (allowedTextFields.has(field) && typeof value === "string") continue;
      fail("INVALID_REQUEST");
    }
    if (typeof value === "string") fail("INVALID_REQUEST");

    counts[field] = (counts[field] ?? 0) + 1;
    if (counts[field] > spec.max || value.size > MAX_IMAGE_BYTES) {
      fail("INVALID_REQUEST");
    }
    if (!isSupportedMediaType(value.type)) fail("INVALID_REQUEST");

    const bytes = new Uint8Array(await value.arrayBuffer());
    if (!matchesMagicBytes(bytes, value.type)) fail("INVALID_REQUEST");
    images.push({
      field,
      mediaType: value.type,
      data: Buffer.from(bytes).toString("base64"),
    });
  }

  for (const [field, spec] of Object.entries(specs)) {
    const count = counts[field] ?? 0;
    if (count < spec.min || count > spec.max) fail("INVALID_REQUEST");
  }

  return images;
}
