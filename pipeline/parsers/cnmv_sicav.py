"""Parse CNMV quarterly SOCREGISTRO + SOCTRIM XML — SICAV-level depositario + patrimonio.

The CNMV Anexo Excel only covers Fondos de Inversión (FI). SICAVs (sociedades de
inversión) are reported in a separate quarterly XML release, which has the same
compartment/series structure as FI compartment/class data.

Returns a list of records that mirror the FI shape produced by ``cnmv_registry`` +
``cnmv_fees`` so they can be appended to the depositary aggregation.
"""
from __future__ import annotations

import os
import re
from xml.etree import ElementTree as ET


SOCREGISTRO_PATTERN = re.compile(r'^SOCREGISTRO_(\d{6})\.xml$', re.IGNORECASE)
SOCTRIM_PATTERN = re.compile(r'^SOCTRIM_(\d{6})\.xml$', re.IGNORECASE)


def _find_latest(cnmv_dir, pattern):
    best = None
    for name in os.listdir(cnmv_dir):
        m = pattern.match(name)
        if not m:
            continue
        yyyymm = m.group(1)
        if best is None or yyyymm > best[0]:
            best = (yyyymm, os.path.join(cnmv_dir, name))
    return best  # (yyyymm, path) or None


def parse_cnmv_sicav(cnmv_dir):
    """Parse latest SOCREGISTRO + SOCTRIM pair.

    Returns (records, period_label) where period_label is 'YYYY-Qn' and records
    is a list of dicts shaped like FI share-class rows:
        fund_name, compartimento, share_class, isin, gestora, depositario,
        grupo, category, patrimonio_k, fund_type='SICAV'
    Returns ([], None) if either XML is missing.
    """
    reg_meta = _find_latest(cnmv_dir, SOCREGISTRO_PATTERN)
    tri_meta = _find_latest(cnmv_dir, SOCTRIM_PATTERN)
    if not reg_meta or not tri_meta:
        return [], None

    reg_period, reg_path = reg_meta
    tri_period, tri_path = tri_meta

    series_to_meta = {}        # (registro, num_compart, num_serie) -> registry meta
    isin_to_key = {}           # ISIN -> (registro, num_compart, num_serie)

    for ent in ET.parse(reg_path).getroot().iter('Entidad'):
        nreg = (ent.findtext('NumeroRegistro') or '').strip()
        denom = (ent.findtext('Denominacion') or '').strip()
        gestora = ''
        grupo_g = ''
        gnode = ent.find('Gestora')
        if gnode is not None:
            gestora = (gnode.findtext('DenominacionGestora') or '').strip()
            ggrp = gnode.find('GrupoGestora')
            if ggrp is not None:
                grupo_g = (ggrp.findtext('DenominacionGrupoGestora') or '').strip()
        depo = ''
        grupo_d = ''
        dnode = ent.find('Depositario')
        if dnode is not None:
            depo = (dnode.findtext('DenominacionDepositario') or '').strip()
            dgrp = dnode.find('GrupoDepositario')
            if dgrp is not None:
                grupo_d = (dgrp.findtext('DenominacionGrupoDepositario') or '').strip()

        for comp in ent.findall('Compartimento'):
            ncomp = (comp.findtext('NumeroCompartimento') or '0').strip()
            den_comp = (comp.findtext('DenominacionCompartimento') or '').strip()
            for ser in comp.findall('Serie'):
                nser = (ser.findtext('NumeroSerie') or '0').strip()
                den_ser = (ser.findtext('DenominacionSerie') or '').strip()
                isin = (ser.findtext('ISIN') or '').strip()
                key = (nreg, ncomp, nser)
                series_to_meta[key] = {
                    'fund_name': denom,
                    'compartimento': '' if den_comp.upper() == 'COMPARTIMENTO 0' else den_comp,
                    'share_class': '' if den_ser.upper() == 'SERIE 0' else den_ser,
                    'isin': isin,
                    'gestora': gestora,
                    'depositario': depo,
                    # Prefer depositary group when set, else gestora group (mirrors FI A1.1 behaviour)
                    'grupo': grupo_d or grupo_g,
                }
                if isin:
                    isin_to_key[isin] = key

    # Patrimonio + vocacion from SOCTRIM (no ISIN — must match by registro/compart/serie)
    series_to_data = {}  # key -> {patrimonio_eur, vocacion, num_accionistas, ter}
    for ent in ET.parse(tri_path).getroot().iter('Entidad'):
        nreg = (ent.findtext('NumeroRegistro') or '').strip()
        for comp in ent.findall('Compartimento'):
            ncomp = (comp.findtext('NumeroCompartimento') or '0').strip()
            voc = (comp.findtext('VocacionInversora') or '').strip()
            for ser in comp.findall('Serie'):
                nser = (ser.findtext('NumeroSerie') or '0').strip()
                pat = ser.findtext('Patrimonio')
                try:
                    pat_eur = float(pat) if pat is not None else 0.0
                except (TypeError, ValueError):
                    pat_eur = 0.0
                accionistas = 0
                try:
                    accionistas = int(float(ser.findtext('NumeroAccionistas') or 0))
                except (TypeError, ValueError):
                    pass
                # SOCTRIM expresses Patrimonio in € (not thousands) — normalize to €k for parity with FI
                series_to_data[(nreg, ncomp, nser)] = {
                    'patrimonio_k': pat_eur / 1000.0,
                    'vocacion': voc,
                    'category': voc or 'SICAV',
                    'investors': accionistas,
                }

    # Join
    records = []
    for key, meta in series_to_meta.items():
        if not meta['depositario']:
            continue
        data = series_to_data.get(key, {})
        records.append({
            'fund_name': meta['fund_name'],
            'compartimento': meta['compartimento'],
            'share_class': meta['share_class'],
            'isin': meta['isin'],
            'gestora': meta['gestora'],
            'depositario': meta['depositario'],
            'grupo': meta['grupo'],
            'category': data.get('category', 'SICAV'),
            'vocacion': data.get('vocacion', ''),
            'patrimonio_k': data.get('patrimonio_k', 0.0),
            'investors': data.get('investors', 0),
            'depositary_fee': None,
            'mgmt_fee_aum': None,
            'ter': None,
            'fund_type': 'SICAV',
        })

    # Period label (CNMV publishes SICAV data for quarter-end months)
    yyyy = int(reg_period[:4])
    mm = int(reg_period[4:6])
    quarter = (mm - 1) // 3 + 1
    period = f'{yyyy}-Q{quarter}'
    return records, period
