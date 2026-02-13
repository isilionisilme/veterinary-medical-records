export type ConfidenceBucket = "low" | "medium" | "high";

export type StructuredFilterItem = {
  displayValue: string;
  confidence: number;
  isMissing: boolean;
};

export type StructuredFilterField = {
  key: string;
  label: string;
  isCritical: boolean;
  repeatable: boolean;
  items: StructuredFilterItem[];
};

export type StructuredDataFilters = {
  searchTerm: string;
  selectedConfidence: ConfidenceBucket[];
  onlyCritical: boolean;
  onlyWithValue: boolean;
  onlyEmpty: boolean;
};

export function getConfidenceBucket(confidence: number): ConfidenceBucket {
  if (confidence < 0.25) {
    return "low";
  }
  if (confidence < 0.75) {
    return "medium";
  }
  return "high";
}

function hasRenderableValue(field: StructuredFilterField): boolean {
  if (field.repeatable) {
    return field.items.length > 0;
  }
  return field.items.some((item) => !item.isMissing);
}

function matchesSearch(field: StructuredFilterField, searchTerm: string): boolean {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) {
    return true;
  }
  if (field.label.toLowerCase().includes(normalizedTerm)) {
    return true;
  }
  if (field.key.toLowerCase().includes(normalizedTerm)) {
    return true;
  }
  return field.items.some((item) => item.displayValue.toLowerCase().includes(normalizedTerm));
}

function matchesConfidence(field: StructuredFilterField, selected: ConfidenceBucket[]): boolean {
  if (selected.length === 0) {
    return true;
  }
  const allowed = new Set(selected);
  return field.items.some(
    (item) => !item.isMissing && allowed.has(getConfidenceBucket(item.confidence))
  );
}

export function matchesStructuredDataFilters(
  field: StructuredFilterField,
  filters: StructuredDataFilters
): boolean {
  if (filters.onlyCritical && !field.isCritical) {
    return false;
  }
  const hasValue = hasRenderableValue(field);
  const restrictToNonEmpty = filters.onlyWithValue && !filters.onlyEmpty;
  const restrictToEmpty = filters.onlyEmpty && !filters.onlyWithValue;

  if (restrictToNonEmpty && !hasValue) {
    return false;
  }
  if (restrictToEmpty && hasValue) {
    return false;
  }
  if (!matchesConfidence(field, filters.selectedConfidence)) {
    return false;
  }
  if (!matchesSearch(field, filters.searchTerm)) {
    return false;
  }
  return true;
}
