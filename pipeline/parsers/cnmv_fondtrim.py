"""Parse CNMV FONDTRIM_<YYYYMM>.xml — class-level quarterly data for Fondos de Inversión.

Used for an annual TER. The Anexo A2.2 "% Gastos / Patr. Medio" column is NOT an
annual ratio: depending on the vintage it covers one quarter or one semester (e.g.
2025-Q4 ≈ H2, 2026-Q2 ≈ Q2 alone). FONDTRIM reports RatioTotalGastos for each of
the last four quarters, so their sum is a clean trailing-12-month TER.
"""
from __future__ import annotations

import os
from xml.etree import ElementTree as ET

_TER_TAGS = ('RatioTotalGastos_TrimestreActual', 'RatioTotalGastos_T_1',
             'RatioTotalGastos_T_2', 'RatioTotalGastos_T_3')


def fondtrim_path(cnmv_dir, yyyymm):
    p = os.path.join(cnmv_dir, f'FONDTRIM_{yyyymm}.xml')
    return p if os.path.exists(p) else None


def parse_fondtrim_ter(path):
    """Return {ISIN: trailing-12m TER %} from a FONDTRIM file."""
    out = {}
    for clase in ET.parse(path).getroot().iter('Clase'):
        isin = (clase.findtext('ISIN') or '').strip()
        rtg = clase.find('RatioTotalGastos')
        if not isin or rtg is None:
            continue
        vals = []
        for t in _TER_TAGS:
            v = rtg.findtext(t)
            try:
                if v is not None and v.strip():
                    vals.append(float(v))
            except ValueError:
                pass
        if vals:
            # Scale up when fewer than four quarters exist (class launched within the year)
            out[isin] = round(sum(vals) * 4 / len(vals), 3)
    return out
