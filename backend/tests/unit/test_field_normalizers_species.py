from __future__ import annotations

from backend.app.application import field_normalizers


def test_species_normalizer_returns_canonical_values_for_known_tokens() -> None:
    vectors = [
        ("canina", "canino"),
        ("perro", "canino"),
        ("felina", "felino"),
        ("gata", "felino"),
    ]

    for raw_value, expected in vectors:
        normalized = field_normalizers.normalize_canonical_fields({"species": raw_value})
        assert normalized["species"] == expected


def test_species_normalizer_drops_unknown_tokens_instead_of_pass_through() -> None:
    normalized = field_normalizers.normalize_canonical_fields({"species": "equino"})
    assert normalized["species"] is None


def test_species_contract_constants_match_current_canonical_set() -> None:
    assert field_normalizers.CANONICAL_SPECIES == frozenset({"canino", "felino"})
    for value in field_normalizers.SPECIES_TOKEN_TO_CANONICAL.values():
        assert value in field_normalizers.CANONICAL_SPECIES
