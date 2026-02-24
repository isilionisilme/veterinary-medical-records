import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetchBlob, apiFetchJson } from "./utils";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetchJson", () => {
  it("throws fallback ApiError for non-json error responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("plain-text", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    ) as typeof fetch;

    await expect(apiFetchJson("/documents")).rejects.toMatchObject({
      error_code: "INTERNAL_ERROR",
      message: "Ocurrio un error inesperado.",
      status: 500,
    });
  });

  it("falls back when json body is malformed despite json content type", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("{not-valid-json", {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;

    await expect(apiFetchJson("/documents")).rejects.toMatchObject({
      error_code: "INTERNAL_ERROR",
      status: 400,
    });
  });

  it("surfaces api payload errors when shape is valid", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error_code: "VALIDATION_ERROR",
          message: "Payload inválido",
          details: { field: "name" },
        }),
        {
          status: 422,
          headers: { "content-type": "application/json" },
        },
      ),
    ) as typeof fetch;

    await expect(apiFetchJson("/documents")).rejects.toMatchObject({
      error_code: "VALIDATION_ERROR",
      message: "Payload inválido",
      status: 422,
    });
  });

  it("propagates network errors", async () => {
    const networkError = new Error("network down");
    globalThis.fetch = vi.fn().mockRejectedValue(networkError) as typeof fetch;

    await expect(apiFetchJson("/documents")).rejects.toBe(networkError);
  });
});

describe("apiFetchBlob", () => {
  it("throws parsed error payload for non-ok responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error_code: "NOT_FOUND",
          message: "Documento no encontrado",
        }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        },
      ),
    ) as typeof fetch;

    await expect(apiFetchBlob("/documents/1/download")).rejects.toMatchObject({
      error_code: "NOT_FOUND",
      status: 404,
    });
  });
});
