"""Grouped regex registries for candidate mining extractors."""

from __future__ import annotations

import re


class PetNamePatterns:
    GUARD_RE = re.compile(
        r"\d{3,}|^[A-Z]{2,3}\d|calle|avda|portal|telf|tel[eé]f|c/|direc",
        re.IGNORECASE,
    )
    BIRTHLINE_RE = re.compile(
        r"^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]{1,40}?)\s*[-–—]\s*"
        r"(?:nacimiento|nac\.?|dob|birth(?:\s*date)?)\b",
        re.IGNORECASE,
    )


class ClinicPatterns:
    CONTEXT_LINE_RE = re.compile(
        r"(?i)\b(?:en\s+el|en\s+la)\s+"
        r"(centr[o0]|cl[ií]nica|hospital(?:\s+veterinari[oa])?)\s+"
        r"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][^\n,;]{2,100})"
    )
    STANDALONE_LINE_RE = re.compile(
        r"(?i)^\s*(hv|h\.?\s*v\.?|hospital(?:\s+veterinari[oa])?|"
        r"centro(?:\s+veterinari[oa])?|cl[ií]nica(?:\s+veterinari[oa])?)\s+"
        r"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][^\n,;:]{2,100})\s*$"
    )
    HEADER_ADDRESS_CONTEXT_RE = re.compile(
        r"(?i)\b(?:avda?\.?|avenida|calle|c/|portal|piso|puerta|codigo\s+postal|cp\b)\b"
    )
    HEADER_SECTION_CONTEXT_RE = re.compile(
        r"(?i)\b(?:datos\s+de\s+la\s+mascota|datos\s+del\s+cliente|especie|raza|n[º°o]\s*chip)\b"
    )
    HEADER_GENERIC_BLACKLIST = {
        "HISTORIAL",
        "INFORME",
        "FICHA",
    }
    ADDRESS_LABEL_LINE_RE = re.compile(
        r"(?i)^\s*(?:(?:centro|cl[ií]nica|hospital)(?:\s+veterinari[oa])?\s*/\s*)?"
        r"(direcci[oó]n(?:\s+de\s+la\s+cl[ií]nica)?|"
        r"domicilio(?:\s+de\s+la\s+cl[ií]nica)?|dir\.?)\s*(?:[:\-]\s*(.*))?$"
    )
    ADDRESS_START_RE = re.compile(
        r"(?i)(?:^|\s)(?:c/\s*|calle\b|avda?\.?\b|avenida\b|plaza\b|"
        r"pza\.?\b|paseo\b|camino\b|carretera\b|ctra\.?\b)"
    )
    OR_HOSPITAL_CONTEXT_RE = re.compile(
        r"(?i)\b(?:cl[ií]nica|centro|hospital|veterinari[oa]|vet)\b"
    )
    ADDRESS_CONTEXT_RE = re.compile(
        r"(?i)\b(?:cl[ií]nica|hospital|centro\s+veterinario|"
        r"veterinari[oa]|vet\b|dr\.?|dra\.?|doctor(?:a)?)\b"
    )
    HEADER_BLOCK_SCAN_WINDOW = 8


class OwnerPatterns:
    ADDRESS_CONTEXT_RE = re.compile(
        r"(?i)\b(?:propietari[oa]|titular|dueñ(?:o|a)|owner|tutor|"
        r"datos\s+del\s+cliente|cliente)\b"
    )
    HEADER_RE = re.compile(r"(?i)\b(?:propietari[oa]|titular|dueñ(?:o|a)|owner|cliente|tutor)\b")
    NAME_LIKE_LINE_RE = re.compile(
        r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\.-]*(?:\s+"
        r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\.-]*){1,4}$"
    )
    LOCALITY_LINE_RE = re.compile(r"^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s'\.-]{1,40}$")
    LOCALITY_SECTION_BLACKLIST = {
        "historial",
        "plan",
        "exploracion",
        "exploración",
        "tratamiento",
        "diagnostico",
        "diagnóstico",
    }
    BLOCK_IDENTIFICATION_CONTEXT_RE = re.compile(
        r"(?i)\b(?:n[º°o]\s*chip|chip|microchip|paciente|mascota|especie|raza|sexo)\b"
    )
    ADDRESS_LABEL_LINE_RE = re.compile(
        r"(?i)^\s*(?:direcci[oó]n\s+del\s+(?:propietari[oa]|titular)|"
        r"domicilio\s+del\s+(?:propietari[oa]|titular)|"
        r"dir\.?\s*(?:propietari[oa]|titular))\s*(?:[:\-]\s*(.*))?$"
    )


class AddressPatterns:
    AMBIGUOUS_ADDRESS_LABEL_LINE_RE = re.compile(
        r"(?i)^\s*(?:direcci[oó]n|domicilio|dir\.?)\s*(?:[:\-]\s*(.*))?$"
    )
    POSTAL_HINT_RE = re.compile(r"(?i)\b(?:cp\b|c[oó]digo\s+postal|\d{5})\b")
    SIMPLE_FIELD_LABEL_RE = re.compile(r"^[^\n]{1,40}\s*[:\-]\s*")
    AMBIGUOUS_CONTEXT_WINDOW_LINES = 5


class WeightPatterns:
    EXPLICIT_CONTEXT_RE = re.compile(
        r"(?i)\b(?:peso(?:\s+corporal)?|weight|signos?\s+vitales|p\.(?!\s*ej\.?\b))\b"
    )
    DOSAGE_GUARD_RE = re.compile(r"(?i)\b(?:ml|mg)\s*/\s*kg\b")
    LAB_GUARD_RE = re.compile(r"(?i)\b(?:mg\s*/\s*dL|mmol\s*/\s*L|U\s*/\s*L)\b")
    PRICE_GUARD_RE = re.compile(r"(?i)(?:\$|\u20ac|\bEUR\b)")
    MED_OR_LAB_CONTEXT_RE = re.compile(
        r"(?i)\b(?:dosis|tratamiento|medicaci[oó]n|prescripci[oó]n|amoxic|clavul|"
        r"predni|omepra|anal[ií]tica|laboratorio|hemograma|bioqu[ií]mica|glucosa|"
        r"urea|creatinina|mg\s*/\s*kg|ml\s*/\s*kg|mg\s*/\s*dL|mmol\s*/\s*L|U\s*/\s*L)\b"
    )
    STANDALONE_LINE_RE = re.compile(
        r"^\s*(?:peso|pv|p\.)?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(kg|kgs|g)\.?\s*$",
        re.IGNORECASE,
    )
    VISIT_TIMELINE_CONTEXT_RE = re.compile(
        r"(?i)\b(?:visita|consulta|control|seguimiento|ingreso|alta)\b"
    )


class FieldLabelPatterns:
    SIMPLE_FIELD_LABEL_RE = AddressPatterns.SIMPLE_FIELD_LABEL_RE
    CLINIC_ADDRESS_LABEL_LINE_RE = ClinicPatterns.ADDRESS_LABEL_LINE_RE
    AMBIGUOUS_ADDRESS_LABEL_LINE_RE = AddressPatterns.AMBIGUOUS_ADDRESS_LABEL_LINE_RE
    OWNER_ADDRESS_LABEL_LINE_RE = OwnerPatterns.ADDRESS_LABEL_LINE_RE
