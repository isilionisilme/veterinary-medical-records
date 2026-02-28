import { useCallback, useEffect, useMemo, useRef } from "react";

import { logExtractionDebugEvent, type ExtractionDebugEvent } from "../extraction/extractionDebug";
import { validateFieldValue } from "../extraction/fieldValidators";
import {
  BILLING_REVIEW_FIELDS,
  CANONICAL_DOCUMENT_CONCEPTS,
  CANONICAL_VISIT_METADATA_KEYS,
  CANONICAL_VISIT_SCOPED_FIELD_KEYS,
  CRITICAL_GLOBAL_SCHEMA_KEYS,
  FIELD_LABELS,
  HIDDEN_REVIEW_FIELDS,
  MEDICAL_RECORD_SECTION_ID_ORDER,
  MEDICAL_RECORD_SECTION_ORDER,
  MISSING_VALUE_PLACEHOLDER,
  OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
  REPORT_INFO_SECTION_TITLE,
} from "../constants/appWorkspace";
import {
  clampConfidence,
  formatFieldValue,
  formatReviewKeyLabel,
  getConfidenceTone,
  getLabelTooltipText,
  getNormalizedVisitId,
  getUiSectionLabelFromSectionId,
  isFieldValueEmpty,
  resolveMappingConfidence,
  resolveUiSection,
  shouldHideExtractedField,
} from "../lib/appWorkspaceUtils";
import { GLOBAL_SCHEMA } from "../lib/globalSchema";
import {
  type ConfidenceBucket,
  matchesStructuredDataFilters,
  type StructuredDataFilters,
} from "../lib/structuredDataFilters";
import type {
  ConfidencePolicyConfig,
  DocumentReviewResponse,
  ReviewDisplayField,
  ReviewField,
  ReviewSelectableField,
  ReviewVisitGroup,
  StructuredInterpretationData,
} from "../types/appWorkspace";

type UseReviewDataPipelineParams = {
  documentReview: {
    data: DocumentReviewResponse | undefined;
  };
  interpretationData: StructuredInterpretationData | undefined;
  isCanonicalContract: boolean;
  hasMalformedCanonicalFieldSlots: boolean;
  reviewVisits: ReviewVisitGroup[];
  activeConfidencePolicy: ConfidencePolicyConfig | null;
  structuredDataFilters: StructuredDataFilters;
  hasActiveStructuredFilters: boolean;
};

export function useReviewDataPipeline({
  documentReview,
  interpretationData,
  isCanonicalContract,
  hasMalformedCanonicalFieldSlots,
  reviewVisits,
  activeConfidencePolicy,
  structuredDataFilters,
  hasActiveStructuredFilters,
}: UseReviewDataPipelineParams) {
  const lastExtractionDebugDocIdRef = useRef<string | null>(null);
  const loggedExtractionDebugEventKeysRef = useRef<Set<string>>(new Set());

  const hasVisitGroups = reviewVisits.length > 0;
  const hasUnassignedVisitGroup = reviewVisits.some(
    (visit) => visit.visit_id.trim().toLowerCase() === "unassigned",
  );

  const extractedReviewFields = useMemo(() => {
    const baseFields = interpretationData?.fields ?? [];
    if (!isCanonicalContract) {
      return baseFields;
    }
    const flattenedVisitFields = reviewVisits.flatMap((visit, visitIndex) => {
      const normalizedVisitId = getNormalizedVisitId(visit, visitIndex);
      const metadataFields: ReviewField[] = [
        {
          field_id: `visit-meta-date:${normalizedVisitId}`,
          key: "visit_date",
          value: visit.visit_date,
          value_type: "date",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: true,
          origin: "machine",
        },
        {
          field_id: `visit-meta-admission:${normalizedVisitId}`,
          key: "admission_date",
          value: visit.admission_date ?? null,
          value_type: "date",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: false,
          origin: "machine",
        },
        {
          field_id: `visit-meta-discharge:${normalizedVisitId}`,
          key: "discharge_date",
          value: visit.discharge_date ?? null,
          value_type: "date",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: false,
          origin: "machine",
        },
        {
          field_id: `visit-meta-reason:${normalizedVisitId}`,
          key: "reason_for_visit",
          value: visit.reason_for_visit ?? null,
          value_type: "string",
          visit_group_id: normalizedVisitId,
          scope: "visit",
          section: "visits",
          classification: "medical_record",
          domain: "clinical",
          is_critical: false,
          origin: "machine",
        },
      ];
      const scopedFields = (visit.fields ?? []).map((field, fieldIndex) => ({
        ...field,
        field_id: field.field_id || `visit-field:${normalizedVisitId}:${field.key}:${fieldIndex}`,
        visit_group_id: normalizedVisitId,
        scope: "visit" as const,
        section: field.section ?? "visits",
      }));
      return [...metadataFields, ...scopedFields];
    });
    return [...baseFields, ...flattenedVisitFields];
  }, [interpretationData?.fields, isCanonicalContract, reviewVisits]);

  const explicitOtherReviewFields = useMemo(() => {
    if (!isCanonicalContract) {
      return [] as ReviewField[];
    }
    return (interpretationData?.other_fields ?? [])
      .filter((field) => !BILLING_REVIEW_FIELDS.has(field.key))
      .map((field, index) => ({
        ...field,
        field_id: field.field_id || `other-field:${field.key}:${index}`,
        classification: field.classification ?? "other",
        section: field.section ?? "other",
      }));
  }, [interpretationData, isCanonicalContract]);

  const validationResult = useMemo(() => {
    const fieldsByKey = new Map<string, number>();
    const acceptedFields: ReviewField[] = [];
    const debugEvents: ExtractionDebugEvent[] = [];
    const documentId = documentReview.data?.active_interpretation.data.document_id;
    extractedReviewFields.forEach((field) => {
      fieldsByKey.set(field.key, (fieldsByKey.get(field.key) ?? 0) + 1);
    });
    extractedReviewFields.forEach((field) => {
      const rawValue = field.value === null || field.value === undefined ? "" : String(field.value);
      const validation = validateFieldValue(field.key, rawValue);
      if (!validation.ok) {
        debugEvents.push({
          field: field.key,
          status: "rejected",
          raw: rawValue,
          reason: validation.reason,
          docId: documentId,
          page: field.evidence?.page,
        });
        return;
      }
      const normalizedValue = validation.normalized ?? rawValue.trim();
      acceptedFields.push({
        ...field,
        value: normalizedValue,
      });
      debugEvents.push({
        field: field.key,
        status: "accepted",
        raw: rawValue,
        normalized: normalizedValue,
        docId: documentId,
        page: field.evidence?.page,
      });
    });
    GLOBAL_SCHEMA.forEach((definition) => {
      if ((fieldsByKey.get(definition.key) ?? 0) > 0) {
        return;
      }
      if (HIDDEN_REVIEW_FIELDS.has(definition.key)) {
        return;
      }
      debugEvents.push({
        field: definition.key,
        status: "missing",
        docId: documentId,
      });
    });
    return {
      acceptedFields,
      debugEvents,
    };
  }, [documentReview.data?.active_interpretation.data.document_id, extractedReviewFields]);

  useEffect(() => {
    const documentId = documentReview.data?.active_interpretation.data.document_id ?? null;
    if (lastExtractionDebugDocIdRef.current !== documentId) {
      loggedExtractionDebugEventKeysRef.current.clear();
      lastExtractionDebugDocIdRef.current = documentId;
    }
    validationResult.debugEvents.forEach((event) => {
      const eventKey = [
        event.docId ?? "",
        event.field,
        event.status,
        event.raw ?? "",
        event.normalized ?? "",
        event.reason ?? "",
        event.page ?? "",
      ].join("|");
      if (loggedExtractionDebugEventKeysRef.current.has(eventKey)) {
        return;
      }
      loggedExtractionDebugEventKeysRef.current.add(eventKey);
      logExtractionDebugEvent(event);
    });
  }, [documentReview.data?.active_interpretation.data.document_id, validationResult.debugEvents]);

  const validatedReviewFields = validationResult.acceptedFields.filter((field) => {
    if (isCanonicalContract) {
      return !BILLING_REVIEW_FIELDS.has(field.key);
    }
    return !HIDDEN_REVIEW_FIELDS.has(field.key);
  });

  const buildSelectableField = useCallback(
    (
      base: Omit<
        ReviewSelectableField,
        "hasMappingConfidence" | "confidence" | "confidenceBand" | "isMissing" | "rawField"
      >,
      rawField: ReviewField | undefined,
      isMissing: boolean,
    ): ReviewSelectableField => {
      const mappingConfidence = rawField ? resolveMappingConfidence(rawField) : null;
      let confidenceBand: ConfidenceBucket | null = null;
      if (mappingConfidence !== null && activeConfidencePolicy) {
        const tone = getConfidenceTone(mappingConfidence, activeConfidencePolicy.band_cutoffs);
        confidenceBand = tone === "med" ? "medium" : tone;
      }
      return {
        ...base,
        isMissing,
        hasMappingConfidence: mappingConfidence !== null,
        confidence: mappingConfidence ?? 0,
        confidenceBand,
        rawField,
        visitGroupId: rawField?.visit_group_id,
      };
    },
    [activeConfidencePolicy],
  );

  const matchesByKey = useMemo(() => {
    const matches = new Map<string, ReviewField[]>();
    validatedReviewFields.forEach((field) => {
      const group = matches.get(field.key) ?? [];
      group.push(field);
      matches.set(field.key, group);
    });
    return matches;
  }, [validatedReviewFields]);

  const coreDisplayFields = useMemo(() => {
    let coreDefinitions: Array<{
      key: string;
      label: string;
      section: string;
      order: number;
      value_type: string;
      repeatable: boolean;
      critical: boolean;
      aliases?: string[];
    }> = [];
    if (isCanonicalContract) {
      if (hasMalformedCanonicalFieldSlots) {
        return [];
      }
      const rawFieldSlots = interpretationData?.medical_record_view?.field_slots;
      const fieldSlots = Array.isArray(rawFieldSlots) ? rawFieldSlots : [];
      const documentSlots = fieldSlots.filter(
        (slot) => slot.scope === "document" && !BILLING_REVIEW_FIELDS.has(slot.canonical_key),
      );
      const schemaCriticalByKey = new Map(
        GLOBAL_SCHEMA.map((definition) => [definition.key, Boolean(definition.critical)]),
      );
      const sectionOrderIndex = new Map<string, number>(
        MEDICAL_RECORD_SECTION_ID_ORDER.map((sectionId, index) => [sectionId, index]),
      );
      const slotDefinitions = documentSlots.map((slot, index) => {
        const sectionLabel =
          getUiSectionLabelFromSectionId(slot.section) ?? REPORT_INFO_SECTION_TITLE;
        const sectionIndex =
          sectionOrderIndex.get(slot.section) ?? MEDICAL_RECORD_SECTION_ID_ORDER.length;
        const slotKeys = [slot.canonical_key, ...(slot.aliases ?? [])];
        const criticalFromSchema = slotKeys.some((key) => schemaCriticalByKey.get(key));
        const criticalFromFields = validatedReviewFields.some(
          (field) => slotKeys.includes(field.key) && Boolean(field.is_critical),
        );
        const isCriticalSlot =
          CRITICAL_GLOBAL_SCHEMA_KEYS.has(slot.canonical_key) ||
          Boolean(slot.aliases?.some((alias) => CRITICAL_GLOBAL_SCHEMA_KEYS.has(alias)));
        return {
          key: slot.canonical_key,
          label: formatReviewKeyLabel(slot.canonical_key),
          section: sectionLabel,
          order: sectionIndex * 1000 + index,
          value_type: "string",
          repeatable: false,
          critical: criticalFromSchema || criticalFromFields || isCriticalSlot,
          aliases: slot.aliases,
        };
      });
      const visitDefinitions: Array<{
        key: string;
        label: string;
        section: string;
        order: number;
        value_type: string;
        repeatable: boolean;
        critical: boolean;
      }> = [];
      const seenVisitKeys = new Set<string>();
      validatedReviewFields
        .filter((field) => field.scope === "visit" && field.classification !== "other")
        .forEach((field) => {
          if (seenVisitKeys.has(field.key)) {
            return;
          }
          seenVisitKeys.add(field.key);
          visitDefinitions.push({
            key: field.key,
            label: formatReviewKeyLabel(field.key),
            section: "Visitas",
            order: 3000 + visitDefinitions.length,
            value_type: field.value_type,
            repeatable: true,
            critical: Boolean(field.is_critical),
          });
        });
      coreDefinitions = [...slotDefinitions, ...visitDefinitions];
    } else {
      const templateDefinitions = GLOBAL_SCHEMA.filter(
        (definition) => !HIDDEN_REVIEW_FIELDS.has(definition.key),
      );
      const dynamicMedicalRecordDefinitions = validatedReviewFields
        .filter((field) => {
          if (field.classification === "other") {
            return false;
          }
          if (HIDDEN_REVIEW_FIELDS.has(field.key)) {
            return false;
          }
          return !templateDefinitions.some((definition) => definition.key === field.key);
        })
        .map((field, index) => ({
          key: field.key,
          label: formatReviewKeyLabel(field.key),
          section: resolveUiSection(field, REPORT_INFO_SECTION_TITLE),
          order: 10_000 + index,
          value_type: field.value_type,
          repeatable: false,
          critical: Boolean(field.is_critical),
        }));
      coreDefinitions = [...templateDefinitions, ...dynamicMedicalRecordDefinitions];
    }
    return coreDefinitions
      .map((definition): ReviewDisplayField => {
        const uiSection =
          "section" in definition && typeof definition.section === "string"
            ? resolveUiSection(
                { key: definition.key, section: definition.section },
                definition.section,
              )
            : REPORT_INFO_SECTION_TITLE;
        const uiLabel = FIELD_LABELS[definition.key] ?? definition.label;
        const labelTooltip = getLabelTooltipText(definition.key);
        let candidates = matchesByKey.get(definition.key) ?? [];
        if (isCanonicalContract && definition.aliases && definition.aliases.length > 0) {
          const aliasCandidates = definition.aliases.flatMap(
            (alias) => matchesByKey.get(alias) ?? [],
          );
          candidates = [...candidates, ...aliasCandidates];
        }
        if (definition.repeatable) {
          const items = candidates
            .filter((candidate) => !isFieldValueEmpty(candidate.value))
            .map(
              (candidate, index): ReviewSelectableField =>
                buildSelectableField(
                  {
                    id: `core:${definition.key}:${candidate.field_id}:${index}`,
                    key: definition.key,
                    label: uiLabel,
                    section: uiSection,
                    order: definition.order,
                    valueType: candidate.value_type,
                    displayValue: formatFieldValue(candidate.value, candidate.value_type),
                    source: "core",
                    evidence: candidate.evidence,
                    repeatable: true,
                  },
                  candidate,
                  false,
                ),
            );
          return {
            id: `core:${definition.key}`,
            key: definition.key,
            label: uiLabel,
            labelTooltip,
            section: uiSection,
            order: definition.order,
            isCritical: definition.critical,
            valueType: definition.value_type,
            repeatable: true,
            items,
            isEmptyList: items.length === 0,
            source: "core",
          };
        }
        const bestCandidate = candidates
          .filter((candidate) => !isFieldValueEmpty(candidate.value))
          .sort(
            (a, b) =>
              clampConfidence(resolveMappingConfidence(b) ?? -1) -
              clampConfidence(resolveMappingConfidence(a) ?? -1),
          )[0];
        const displayValue = bestCandidate
          ? formatFieldValue(bestCandidate.value, bestCandidate.value_type)
          : MISSING_VALUE_PLACEHOLDER;
        const item: ReviewSelectableField = buildSelectableField(
          {
            id: `core:${definition.key}`,
            key: definition.key,
            label: uiLabel,
            section: uiSection,
            order: definition.order,
            valueType: bestCandidate?.value_type ?? definition.value_type,
            displayValue,
            source: "core",
            evidence: bestCandidate?.evidence,
            repeatable: false,
          },
          bestCandidate,
          !bestCandidate,
        );
        return {
          id: `core:${definition.key}`,
          key: definition.key,
          label: uiLabel,
          labelTooltip,
          section: uiSection,
          order: definition.order,
          isCritical: definition.critical,
          valueType: definition.value_type,
          repeatable: false,
          items: [item],
          isEmptyList: false,
          source: "core",
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [
    buildSelectableField,
    hasMalformedCanonicalFieldSlots,
    interpretationData?.medical_record_view?.field_slots,
    isCanonicalContract,
    matchesByKey,
    validatedReviewFields,
  ]);

  const otherDisplayFields = useMemo(() => {
    const coreKeys = new Set(GLOBAL_SCHEMA.map((field) => field.key));
    const grouped = new Map<string, ReviewField[]>();
    const orderedKeys: string[] = [];
    const sourceFields = isCanonicalContract ? explicitOtherReviewFields : validatedReviewFields;
    sourceFields.forEach((field) => {
      if (!isCanonicalContract && coreKeys.has(field.key)) {
        return;
      }
      if (isCanonicalContract && field.classification !== "other") {
        return;
      }
      if (!isCanonicalContract && shouldHideExtractedField(field.key)) {
        return;
      }
      if (!grouped.has(field.key)) {
        grouped.set(field.key, []);
        orderedKeys.push(field.key);
      }
      grouped.get(field.key)?.push(field);
    });
    return orderedKeys.map((key, index): ReviewDisplayField => {
      const fields = grouped.get(key) ?? [];
      const label = formatReviewKeyLabel(key);
      if (fields.length > 1) {
        const items = fields
          .filter((field) => !isFieldValueEmpty(field.value))
          .map(
            (field, itemIndex): ReviewSelectableField =>
              buildSelectableField(
                {
                  id: `extra:${field.field_id}:${itemIndex}`,
                  key,
                  label,
                  section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
                  order: index + 1,
                  valueType: field.value_type,
                  displayValue: formatFieldValue(field.value, field.value_type),
                  source: "extracted",
                  evidence: field.evidence,
                  repeatable: true,
                },
                field,
                false,
              ),
          );
        return {
          id: `extra:${key}`,
          key,
          label,
          section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
          order: index + 1,
          isCritical: false,
          valueType: fields[0]?.value_type ?? "string",
          repeatable: true,
          items,
          isEmptyList: items.length === 0,
          source: "extracted",
        };
      }
      const field = fields[0];
      const hasValue = Boolean(field && !isFieldValueEmpty(field.value));
      const displayValue = hasValue
        ? formatFieldValue(field.value, field.value_type)
        : MISSING_VALUE_PLACEHOLDER;
      const item: ReviewSelectableField = buildSelectableField(
        {
          id: field ? `extra:${field.field_id}:0` : `extra:${key}:missing`,
          key,
          label,
          section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
          order: index + 1,
          valueType: field?.value_type ?? "string",
          displayValue,
          source: "extracted",
          evidence: field?.evidence,
          repeatable: false,
        },
        field,
        !hasValue,
      );
      return {
        id: `extra:${key}`,
        key,
        label,
        section: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
        order: index + 1,
        isCritical: false,
        valueType: field?.value_type ?? "string",
        repeatable: false,
        items: [item],
        isEmptyList: false,
        source: "extracted",
      };
    });
  }, [buildSelectableField, explicitOtherReviewFields, isCanonicalContract, validatedReviewFields]);

  const groupedCoreFields = useMemo(() => {
    const groups = new Map<string, ReviewDisplayField[]>();
    coreDisplayFields.forEach((field) => {
      const current = groups.get(field.section) ?? [];
      current.push(field);
      groups.set(field.section, current);
    });
    return MEDICAL_RECORD_SECTION_ORDER.filter(
      (section) => section !== OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
    ).map((section) => ({
      section,
      fields: (groups.get(section) ?? []).sort((a, b) => a.order - b.order),
    }));
  }, [coreDisplayFields]);

  const canonicalVisitFieldOrder = useMemo(() => {
    const fallbackOrder = [...CANONICAL_VISIT_METADATA_KEYS, ...CANONICAL_VISIT_SCOPED_FIELD_KEYS];
    if (!isCanonicalContract || hasMalformedCanonicalFieldSlots) {
      return fallbackOrder;
    }
    const rawSlots = interpretationData?.medical_record_view?.field_slots;
    const slots = Array.isArray(rawSlots) ? rawSlots : [];
    const orderedKeys: string[] = [];
    slots.forEach((slot) => {
      if (slot.scope !== "visit") {
        return;
      }
      const canonicalKey = slot.canonical_key;
      if (!canonicalKey || BILLING_REVIEW_FIELDS.has(canonicalKey)) {
        return;
      }
      if (!orderedKeys.includes(canonicalKey)) {
        orderedKeys.push(canonicalKey);
      }
    });
    fallbackOrder.forEach((key) => {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
    });
    return orderedKeys;
  }, [
    hasMalformedCanonicalFieldSlots,
    interpretationData?.medical_record_view?.field_slots,
    isCanonicalContract,
  ]);

  const visibleCoreGroups = useMemo(() => {
    if (!hasActiveStructuredFilters) {
      return groupedCoreFields;
    }
    return groupedCoreFields
      .map((group) => ({
        section: group.section,
        fields: group.fields.filter((field) =>
          matchesStructuredDataFilters(field, structuredDataFilters),
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [groupedCoreFields, hasActiveStructuredFilters, structuredDataFilters]);

  const visibleOtherDisplayFields = useMemo(
    () => (hasActiveStructuredFilters ? [] : otherDisplayFields),
    [hasActiveStructuredFilters, otherDisplayFields],
  );
  const visibleCoreFields = useMemo(
    () => visibleCoreGroups.flatMap((group) => group.fields),
    [visibleCoreGroups],
  );

  const reportSections = useMemo(() => {
    const coreSections = visibleCoreGroups.map((group) => ({
      id: `core:${group.section}`,
      title: group.section,
      fields: group.fields,
    }));
    if (hasActiveStructuredFilters) {
      return coreSections;
    }
    const extraSection = {
      id: "extra:section",
      title: OTHER_EXTRACTED_FIELDS_SECTION_TITLE,
      fields: visibleOtherDisplayFields,
    };
    const infoIndex = coreSections.findIndex(
      (section) => section.title === REPORT_INFO_SECTION_TITLE,
    );
    if (infoIndex < 0) {
      return [...coreSections, extraSection];
    }
    return [...coreSections.slice(0, infoIndex), extraSection, ...coreSections.slice(infoIndex)];
  }, [hasActiveStructuredFilters, visibleCoreGroups, visibleOtherDisplayFields]);

  const selectableReviewItems = useMemo(
    () => [...visibleCoreFields, ...visibleOtherDisplayFields].flatMap((field) => field.items),
    [visibleCoreFields, visibleOtherDisplayFields],
  );

  const detectedFieldsSummary = useMemo(() => {
    const summarizeConfidenceBands = () => {
      let low = 0;
      let medium = 0;
      let high = 0;
      let unknown = 0;
      if (!activeConfidencePolicy) {
        return { low, medium, high, unknown: 0 };
      }
      coreDisplayFields.forEach((field) => {
        const presentItems = field.items.filter((item) => !item.isMissing);
        if (presentItems.length === 0) {
          return;
        }
        if (presentItems.some((item) => item.confidenceBand === "low")) {
          low += 1;
          return;
        }
        if (presentItems.some((item) => item.confidenceBand === "medium")) {
          medium += 1;
          return;
        }
        if (presentItems.some((item) => item.confidenceBand === "high")) {
          high += 1;
          return;
        }
        unknown += 1;
      });
      return { low, medium, high, unknown };
    };
    if (isCanonicalContract) {
      const topLevelFields = (interpretationData?.fields ?? []).filter(
        (field): field is ReviewField => Boolean(field && typeof field === "object"),
      );
      const visits = reviewVisits;
      const confidenceCutoffs = activeConfidencePolicy?.band_cutoffs;
      let detected = 0;
      let low = 0;
      let medium = 0;
      let high = 0;
      let unknown = 0;
      const addDetectedConceptFromFields = (
        fields: ReviewField[],
        candidateKeys: readonly string[],
      ) => {
        const matchingWithValue = fields.filter(
          (field) => candidateKeys.includes(field.key) && !isFieldValueEmpty(field.value),
        );
        if (matchingWithValue.length === 0) {
          return;
        }
        detected += 1;
        if (!confidenceCutoffs) {
          unknown += 1;
          return;
        }
        const bestConfidence = matchingWithValue.reduce<number | null>((currentBest, field) => {
          const confidence = resolveMappingConfidence(field);
          if (confidence === null) {
            return currentBest;
          }
          if (currentBest === null || confidence > currentBest) {
            return confidence;
          }
          return currentBest;
        }, null);
        if (bestConfidence === null) {
          unknown += 1;
          return;
        }
        const tone = getConfidenceTone(bestConfidence, confidenceCutoffs);
        if (tone === "low") {
          low += 1;
          return;
        }
        if (tone === "med") {
          medium += 1;
          return;
        }
        high += 1;
      };
      CANONICAL_DOCUMENT_CONCEPTS.forEach((concept) => {
        const aliases = "aliases" in concept ? (concept.aliases ?? []) : [];
        addDetectedConceptFromFields(
          topLevelFields.filter(
            (field) => field.scope !== "visit" && !BILLING_REVIEW_FIELDS.has(field.key),
          ),
          [concept.canonicalKey, ...aliases],
        );
      });
      CANONICAL_VISIT_SCOPED_FIELD_KEYS.forEach((key) => {
        const visitFieldsForKey = visits.flatMap((visit) =>
          (visit.fields ?? []).filter(
            (field): field is ReviewField =>
              Boolean(field && typeof field === "object") && !BILLING_REVIEW_FIELDS.has(field.key),
          ),
        );
        addDetectedConceptFromFields(visitFieldsForKey, [key]);
      });
      CANONICAL_VISIT_METADATA_KEYS.forEach((key) => {
        const hasValue = visits.some((visit) => !isFieldValueEmpty(visit[key]));
        if (!hasValue) {
          return;
        }
        detected += 1;
        unknown += 1;
      });
      return {
        detected,
        total:
          CANONICAL_DOCUMENT_CONCEPTS.length +
          CANONICAL_VISIT_SCOPED_FIELD_KEYS.length +
          CANONICAL_VISIT_METADATA_KEYS.length,
        low,
        medium,
        high,
        unknown,
      };
    }
    let detected = 0;
    const total = GLOBAL_SCHEMA.length;
    const confidenceBands = summarizeConfidenceBands();
    if (!activeConfidencePolicy) {
      return {
        detected,
        total,
        low: confidenceBands.low,
        medium: confidenceBands.medium,
        high: confidenceBands.high,
        unknown: 0,
      };
    }
    coreDisplayFields.forEach((field) => {
      const presentItems = field.items.filter(
        (item) => !item.isMissing && item.confidenceBand !== null,
      );
      if (presentItems.length === 0) {
        return;
      }
      detected += 1;
      if (presentItems.some((item) => item.confidenceBand === "low")) {
        return;
      }
      if (presentItems.some((item) => item.confidenceBand === "medium")) {
        return;
      }
    });
    return {
      detected,
      total,
      low: confidenceBands.low,
      medium: confidenceBands.medium,
      high: confidenceBands.high,
      unknown: 0,
    };
  }, [
    activeConfidencePolicy,
    coreDisplayFields,
    interpretationData?.fields,
    isCanonicalContract,
    reviewVisits,
  ]);

  return {
    reportSections,
    selectableReviewItems,
    coreDisplayFields,
    otherDisplayFields,
    detectedFieldsSummary,
    reviewVisits,
    isCanonicalContract,
    hasMalformedCanonicalFieldSlots,
    hasVisitGroups,
    hasUnassignedVisitGroup,
    canonicalVisitFieldOrder,
    validatedReviewFields,
    buildSelectableField,
    visibleCoreGroups,
    visibleOtherDisplayFields,
  };
}
