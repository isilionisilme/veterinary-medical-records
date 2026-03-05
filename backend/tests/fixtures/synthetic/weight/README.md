# Synthetic fixtures: weight (peso del paciente)

This folder contains synthetic raw-text fixtures and ground truth for `weight` extraction.

- Source file: `weight_cases.json`
- Format: array of cases with `id`, `expected_weight`, and `text`.
- `expected_weight = null` means the extractor should not return a weight value.
- Expected normalized format: `X.Y kg` or `X kg`.
