import { describe, expect, it } from "vitest";

import {
  getConfidenceBucket,
  matchesStructuredDataFilters,
  type StructuredDataFilters,
  type StructuredFilterField,
} from "./structuredDataFilters";

const baseFilters: StructuredDataFilters = {
  searchTerm: "",
  selectedConfidence: [],
  onlyCritical: false,
  onlyWithValue: false,
};

function buildField(partial: Partial<StructuredFilterField>): StructuredFilterField {
  return {
    key: "claim_id",
    label: "ID de reclamación",
    isCritical: false,
    repeatable: false,
    items: [
      {
        displayValue: "ABC-123",
        confidence: 0.82,
        isMissing: false,
      },
    ],
    ...partial,
  };
}

describe("structuredDataFilters", () => {
  it("matches search case-insensitively against label, key and rendered value", () => {
    expect(
      matchesStructuredDataFilters(
        buildField({ label: "Nombre del paciente" }),
        { ...baseFilters, searchTerm: "PACIENTE" }
      )
    ).toBe(true);

    expect(
      matchesStructuredDataFilters(buildField({ key: "pet_name" }), {
        ...baseFilters,
        searchTerm: "PET_NAME",
      })
    ).toBe(true);

    expect(
      matchesStructuredDataFilters(
        buildField({ items: [{ displayValue: "Pancreatitis", confidence: 0.6, isMissing: false }] }),
        { ...baseFilters, searchTerm: "pancrea" }
      )
    ).toBe(true);
  });

  it("uses confidence buckets with the expected boundaries", () => {
    expect(getConfidenceBucket(0.49)).toBe("low");
    expect(getConfidenceBucket(0.5)).toBe("medium");
    expect(getConfidenceBucket(0.74)).toBe("medium");
    expect(getConfidenceBucket(0.75)).toBe("high");

    expect(
      matchesStructuredDataFilters(buildField({ items: [{ displayValue: "x", confidence: 0.49, isMissing: false }] }), {
        ...baseFilters,
        selectedConfidence: ["low"],
      })
    ).toBe(true);
    expect(
      matchesStructuredDataFilters(buildField({ items: [{ displayValue: "x", confidence: 0.75, isMissing: false }] }), {
        ...baseFilters,
        selectedConfidence: ["medium"],
      })
    ).toBe(false);
  });

  it("treats repeatable fields as matching when any item matches and list length > 0 for onlyWithValue", () => {
    const repeatableField = buildField({
      key: "medications",
      label: "Medicación",
      repeatable: true,
      items: [
        { displayValue: "Amoxicilina", confidence: 0.41, isMissing: false },
        { displayValue: "Meloxicam", confidence: 0.9, isMissing: false },
      ],
    });

    expect(
      matchesStructuredDataFilters(repeatableField, { ...baseFilters, searchTerm: "meloxi" })
    ).toBe(true);
    expect(
      matchesStructuredDataFilters(repeatableField, {
        ...baseFilters,
        selectedConfidence: ["high"],
      })
    ).toBe(true);
    expect(
      matchesStructuredDataFilters(repeatableField, {
        ...baseFilters,
        onlyWithValue: true,
      })
    ).toBe(true);

    expect(
      matchesStructuredDataFilters(
        buildField({
          repeatable: true,
          items: [],
        }),
        {
          ...baseFilters,
          onlyWithValue: true,
        }
      )
    ).toBe(false);
  });
});
