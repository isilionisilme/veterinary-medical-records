import { describe, expect, it } from "vitest";

import { validateFieldValue } from "./fieldValidators";

describe("validateFieldValue", () => {
  it("accepts and normalizes a numeric microchip", () => {
    const result = validateFieldValue("microchip_id", "985 141-000 123 456");
    expect(result).toEqual({ ok: true, normalized: "985141000123456" });
  });

  it("rejects microchip values with letters", () => {
    const result = validateFieldValue("microchip_id", "NHC 2.c AB-77");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("non-digit");
  });

  it("normalizes weight values to kg", () => {
    const result = validateFieldValue("weight", "7,2kg");
    expect(result).toEqual({ ok: true, normalized: "7.2 kg" });
  });

  it("normalizes date values to ISO", () => {
    const result = validateFieldValue("visit_date", "7/2/2026");
    expect(result).toEqual({ ok: true, normalized: "2026-02-07" });
  });

  it("normalizes controlled vocab fields", () => {
    expect(validateFieldValue("sex", "female")).toEqual({ ok: true, normalized: "hembra" });
    expect(validateFieldValue("species", "gato")).toEqual({ ok: true, normalized: "felino" });
  });

  it("normalizes age values", () => {
    const result = validateFieldValue("age", "7a");
    expect(result).toEqual({ ok: true, normalized: "7 años" });
  });

  it("keeps unsupported keys as non-empty passthrough", () => {
    const result = validateFieldValue("owner_name", " Maria Perez ");
    expect(result).toEqual({ ok: true, normalized: "Maria Perez" });
  });
});
