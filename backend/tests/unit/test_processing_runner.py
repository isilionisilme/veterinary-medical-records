from __future__ import annotations

import zlib

from backend.app.application.extraction_quality import (
    evaluate_extracted_text_quality,
    is_usable_extracted_text,
    looks_human_readable_text,
)
from backend.app.application.processing_runner import (
    PDF_EXTRACTOR_FORCE_ENV,
    _extract_pdf_text_with_extractor,
    _extract_pdf_text_without_external_dependencies,
    _parse_pdf_literal_string,
)


def test_parse_pdf_literal_string_handles_common_escapes() -> None:
    payload = b"(Linea\\nDos\\t\\050ok\\051\\\\)"
    parsed, next_index = _parse_pdf_literal_string(payload, 1)

    assert parsed == "Linea\nDos\t(ok)\\"
    assert next_index == len(payload)


def test_fallback_extractor_reads_text_from_compressed_stream(tmp_path) -> None:
    stream = zlib.compress(b"BT (Historia clinica) Tj ET")
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nstream\n" + stream + b"\nendstream\n%%EOF"
    pdf_path = tmp_path / "sample.pdf"
    pdf_path.write_bytes(pdf_bytes)

    extracted = _extract_pdf_text_without_external_dependencies(pdf_path)

    assert "Historia clinica" in extracted


def test_readability_filter_rejects_gibberish() -> None:
    assert not looks_human_readable_text("©+/Vã§ga/ÚæÃAäj¦suâìù")


def test_usable_extracted_text_rejects_mojibake_like_output() -> None:
    gibberish = "©+/Vã§ga/ÚæÃAäj¦suâìùJA¨·ö<]¦¶Ý"
    assert not is_usable_extracted_text(gibberish)


def test_usable_extracted_text_rejects_symbol_heavy_garbage() -> None:
    gibberish = (
        "D%G! $G!II%D /T?UL Da$-N;.8Q- /T/UL /T@UL ?'BCADEF? /T@/UL "
        ".EI?'JEAKDLLEM'JND@ cT/UL O7,L7$OKOOR .MM-N7$.$MK-9O7N$-Z;9.X7NT$"
    )
    assert not is_usable_extracted_text(gibberish)


def test_usable_extracted_text_accepts_real_sentence() -> None:
    text = (
        "Historia clinica: perro macho de 7 anos con fiebre y vomitos. "
        "Se realiza analitica y tratamiento sintomatico."
    )
    assert is_usable_extracted_text(text)


def test_quality_evaluator_rejects_known_substitution_pattern() -> None:
    text = "Se queda hospitalizado y se recomienda Dratamiento por Draquea. Diene control."
    score, quality_pass, reasons = evaluate_extracted_text_quality(text)

    assert score <= 0.60
    assert not quality_pass
    assert "SUSPICIOUS_SUBSTITUTIONS" in reasons


def test_extractor_auto_mode_falls_back_when_fitz_is_unavailable(monkeypatch, tmp_path) -> None:
    sample = tmp_path / "sample.pdf"
    sample.write_bytes(b"%PDF-1.4\n%%EOF")

    monkeypatch.delenv(PDF_EXTRACTOR_FORCE_ENV, raising=False)
    monkeypatch.setattr(
        "backend.app.application.processing.pdf_extraction._extract_pdf_text_with_fitz",
        lambda _path: (_ for _ in ()).throw(ImportError("missing fitz")),
    )
    monkeypatch.setattr(
        "backend.app.application.processing.pdf_extraction._extract_pdf_text_without_external_dependencies",
        lambda _path: "fallback text",
    )

    text, extractor = _extract_pdf_text_with_extractor(sample)

    assert extractor == "fallback"
    assert text == "fallback text"


def test_extractor_force_modes_choose_expected_path(monkeypatch, tmp_path) -> None:
    sample = tmp_path / "sample.pdf"
    sample.write_bytes(b"%PDF-1.4\n%%EOF")

    monkeypatch.setattr(
        "backend.app.application.processing.pdf_extraction._extract_pdf_text_with_fitz",
        lambda _path: "fitz text",
    )
    monkeypatch.setattr(
        "backend.app.application.processing.pdf_extraction._extract_pdf_text_without_external_dependencies",
        lambda _path: "fallback text",
    )

    monkeypatch.setenv(PDF_EXTRACTOR_FORCE_ENV, "fitz")
    fitz_text, fitz_extractor = _extract_pdf_text_with_extractor(sample)
    assert fitz_extractor == "fitz"
    assert fitz_text == "fitz text"

    monkeypatch.setenv(PDF_EXTRACTOR_FORCE_ENV, "fallback")
    fallback_text, fallback_extractor = _extract_pdf_text_with_extractor(sample)
    assert fallback_extractor == "fallback"
    assert fallback_text == "fallback text"
