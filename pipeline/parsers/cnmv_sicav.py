"""Parse CNMV quarterly SICAV XML files (Descarga de ficheros de información individual).

Files used (all in ``Data/CNMV Estadisticas/``, named ``<PREFIX>_<YYYYMM>.xml``):

  SOCREGISTRO      SICAV → compartimento → serie (ISIN), gestora, depositario
  SOCTRIM          patrimonio, accionistas, quarterly returns, quarterly TER
  SOCPATRIMDISVAR  P&L decomposition incl. **ComisionDepositario** and ComisionGestion,
                   expressed as % of average daily assets, cumulative since 1-Jan
                   (Mar = Q1, Jun = H1, Sep = 9M, Dec = full year). Compartment level.

The CNMV Anexo Excel only covers Fondos de Inversión (FI); this is the only public
source for SICAV-level depositary fees.

Depositary-fee basis per SICAV:
  * ``FY``  — full-year % from the latest December SOCPATRIMDISVAR, used when the SICAV
              had the same depositario then and now. CNMV rounds to 0.01 %, so a
              full-year figure is ±0.5 bp.
  * ``YTD`` — latest-period cumulative % annualised (×12/months). Used for SICAVs that
              changed depositario or did not exist at the December cut-off. ±1 bp noise
              on an H1 figure.
"""
from __future__ import annotations

import os
import re
from xml.etree import ElementTree as ET


_FILE_RE = re.compile(r'^(SOCREGISTRO|SOCTRIM|SOCPATRIMDISVAR)_(\d{6})\.xml$', re.IGNORECASE)


def _index_files(cnmv_dir):
    """{prefix: {yyyymm: path}} for the SICAV XML files present."""
    out = {'SOCREGISTRO': {}, 'SOCTRIM': {}, 'SOCPATRIMDISVAR': {}}
    for name in os.listdir(cnmv_dir):
        m = _FILE_RE.match(name)
        if m:
            out[m.group(1).upper()][m.group(2)] = os.path.join(cnmv_dir, name)
    return out


def _txt(node, tag, default=''):
    if node is None:
        return default
    v = node.findtext(tag)
    return v.strip() if v is not None else default


def _f(node, tag):
    v = _txt(node, tag, None)
    if v is None or v == '':
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _period_label(yyyymm):
    yyyy, mm = int(yyyymm[:4]), int(yyyymm[4:6])
    return f'{yyyy}-Q{(mm - 1) // 3 + 1}'


def _ytd_label(yyyymm):
    yyyy, mm = int(yyyymm[:4]), int(yyyymm[4:6])
    return {3: f'Q1 {yyyy}', 6: f'H1 {yyyy}', 9: f'9M {yyyy}', 12: f'FY {yyyy}'}.get(mm, f'{yyyymm}')


def parse_socregistro(path):
    """Return {registro: entity dict} with compartments/series and gestora/depositario."""
    entities = {}
    for ent in ET.parse(path).getroot().iter('Entidad'):
        nreg = _txt(ent, 'NumeroRegistro')
        g = ent.find('Gestora')
        d = ent.find('Depositario')
        ggrp = g.find('GrupoGestora') if g is not None else None
        dgrp = d.find('GrupoDepositario') if d is not None else None
        comps = []
        for comp in ent.findall('Compartimento'):
            den_comp = _txt(comp, 'DenominacionCompartimento')
            series = []
            for ser in comp.findall('Serie'):
                den_ser = _txt(ser, 'DenominacionSerie')
                series.append({
                    'num': _txt(ser, 'NumeroSerie', '0'),
                    'name': '' if den_ser.upper() == 'SERIE 0' else den_ser,
                    'isin': _txt(ser, 'ISIN'),
                })
            comps.append({
                'num': _txt(comp, 'NumeroCompartimento', '0'),
                'name': '' if den_comp.upper() == 'COMPARTIMENTO 0' else den_comp,
                'series': series,
            })
        entities[nreg] = {
            'registro': nreg,
            'name': _txt(ent, 'Denominacion'),
            'gestora': _txt(g, 'DenominacionGestora'),
            'grupo_gestora': _txt(ggrp, 'DenominacionGrupoGestora'),
            'depositario': _txt(d, 'DenominacionDepositario'),
            'grupo_depositario': _txt(dgrp, 'DenominacionGrupoDepositario'),
            'compartments': comps,
        }
    return entities


def _compound(rets):
    acc = 1.0
    for r in rets:
        acc *= 1 + r / 100.0
    return round((acc - 1) * 100, 2)


def parse_soctrim(path, quarter_in_year):
    """Return {(registro, comp, serie): {...}} with AUM, holders, TER (TTM) and returns."""
    out = {}
    for ent in ET.parse(path).getroot().iter('Entidad'):
        nreg = _txt(ent, 'NumeroRegistro')
        for comp in ent.findall('Compartimento'):
            ncomp = _txt(comp, 'NumeroCompartimento', '0')
            voc = _txt(comp, 'VocacionInversora')
            clase = _txt(comp, 'ClaseSociedad')
            for ser in comp.findall('Serie'):
                nser = _txt(ser, 'NumeroSerie', '0')
                rent = ser.find('Rentabilidad')
                rets = [_f(rent, t) for t in ('Rentabilidad_TrimestreActual', 'Rentabilidad_T_1',
                                               'Rentabilidad_T_2', 'Rentabilidad_T_3')]
                rtg = ser.find('RatioTotalGastos')
                ters = [_f(rtg, t) for t in ('RatioTotalGastos_TrimestreActual', 'RatioTotalGastos_T_1',
                                              'RatioTotalGastos_T_2', 'RatioTotalGastos_T_3')]
                ters_ok = [t for t in ters if t is not None]
                # Trailing-12-month TER: sum of the four quarterly ratios (scaled up if
                # fewer than four quarters are reported, e.g. a SICAV registered mid-year).
                ter_ttm = round(sum(ters_ok) * 4 / len(ters_ok), 3) if ters_ok else None
                ytd = rets[:quarter_in_year]
                out[(nreg, ncomp, nser)] = {
                    'patrimonio_eur': _f(ser, 'Patrimonio') or 0.0,
                    'investors': int(_f(ser, 'NumeroAccionistas') or 0),
                    'vocacion': voc,
                    'clase_sociedad': clase,
                    'currency': _txt(ser, 'CodigoDivisa'),
                    'ter_ttm': ter_ttm,
                    'return_ytd': _compound(ytd) if ytd and all(r is not None for r in ytd) else None,
                    'return_1y': _compound(rets) if all(r is not None for r in rets) else None,
                }
    return out


def parse_socpatrimdisvar(path):
    """Return {(registro, comp): {dep_pct, mgmt_pct, aum_eur, aum_prev_eur}} — cumulative YTD %."""
    out = {}
    for ent in ET.parse(path).getroot().iter('Entidad'):
        nreg = _txt(ent, 'NumeroRegistro')
        for comp in ent.findall('Compartimento'):
            ncomp = _txt(comp, 'NumeroCompartimento', '0')
            dep = _f(comp, 'ComisionDepositario')
            mgmt = _f(comp, 'ComisionGestion')
            out[(nreg, ncomp)] = {
                # Reported as negative contributions to return — flip to a positive cost.
                'dep_pct': abs(dep) if dep is not None else None,
                'mgmt_pct': abs(mgmt) if mgmt is not None else None,
                'aum_eur': _f(comp, 'TotalPatrimonio'),
                'aum_prev_eur': _f(comp, 'PatrimonioFinPeriodoAnterior'),
            }
    return out


def parse_cnmv_sicav_full(cnmv_dir):
    """Parse the latest SICAV quarter plus the reference December and prior-year register.

    Returns dict:
      records          — one per serie (FI share-class shape + SICAV extras)
      period           — 'YYYY-Qn' of the latest SOCREGISTRO/SOCTRIM pair
      yyyymm           — raw latest period
      ytd_label        — e.g. 'H1 2026' (period the YTD fee figures cover)
      fy_label         — e.g. 'FY 2025' (December reference used for full-year fees), or None
      prior_register   — {registro: entity} from ~12 months earlier (for switches/entries/exits)
      prior_label      — 'YYYY-Qn' of that register, or None
      prior_aum_eur    — {registro: total AUM €} at the prior register date (SOCTRIM), if available
    Returns None when the SOCREGISTRO/SOCTRIM pair is missing.
    """
    files = _index_files(cnmv_dir)
    common = sorted(set(files['SOCREGISTRO']) & set(files['SOCTRIM']))
    if not common:
        return None
    latest = common[-1]
    months = int(latest[4:6])
    q_in_year = months // 3

    reg = parse_socregistro(files['SOCREGISTRO'][latest])
    trim = parse_soctrim(files['SOCTRIM'][latest], q_in_year)
    ytd = parse_socpatrimdisvar(files['SOCPATRIMDISVAR'][latest]) \
        if latest in files['SOCPATRIMDISVAR'] else {}

    # Reference full-year fees: latest December at or before the latest period
    decs = sorted(p for p in files['SOCPATRIMDISVAR'] if p.endswith('12') and p <= latest)
    fy_period = decs[-1] if decs else None
    fy = parse_socpatrimdisvar(files['SOCPATRIMDISVAR'][fy_period]) if fy_period else {}
    fy_reg = parse_socregistro(files['SOCREGISTRO'][fy_period]) \
        if fy_period and fy_period in files['SOCREGISTRO'] else {}

    # Prior-year register for depositary switches / entries / exits
    target = f'{int(latest[:4]) - 1}{latest[4:]}'
    older = sorted(p for p in files['SOCREGISTRO'] if p < latest)
    prior_period = target if target in files['SOCREGISTRO'] else (older[0] if older else None)
    prior_reg = parse_socregistro(files['SOCREGISTRO'][prior_period]) if prior_period else {}
    prior_aum = {}
    if prior_period and prior_period in files['SOCTRIM']:
        for (nreg, _c, _s), v in parse_soctrim(files['SOCTRIM'][prior_period],
                                                int(prior_period[4:6]) // 3).items():
            prior_aum[nreg] = prior_aum.get(nreg, 0.0) + v['patrimonio_eur']

    ann = 12 / months
    records = []
    for nreg, e in reg.items():
        if not e['depositario']:
            continue
        same_depo_at_fy = bool(fy_reg.get(nreg)) and fy_reg[nreg]['depositario'] == e['depositario']
        for comp in e['compartments']:
            fees_ytd = ytd.get((nreg, comp['num']), {})
            fees_fy = fy.get((nreg, comp['num']), {}) if same_depo_at_fy else {}
            dep_ytd_ann = round(fees_ytd['dep_pct'] * ann, 4) if fees_ytd.get('dep_pct') is not None else None
            mgmt_ytd_ann = round(fees_ytd['mgmt_pct'] * ann, 4) if fees_ytd.get('mgmt_pct') is not None else None
            dep_fy = fees_fy.get('dep_pct')
            mgmt_fy = fees_fy.get('mgmt_pct')
            if dep_fy is not None:
                dep_fee, mgmt_fee, basis = dep_fy, mgmt_fy, 'FY'
            elif dep_ytd_ann is not None:
                dep_fee, mgmt_fee, basis = dep_ytd_ann, mgmt_ytd_ann, 'YTD'
            else:
                dep_fee, mgmt_fee, basis = None, None, None
            for ser in comp['series']:
                t = trim.get((nreg, comp['num'], ser['num']), {})
                records.append({
                    'registro': nreg,
                    'fund_name': e['name'],
                    'compartimento': comp['name'],
                    'share_class': ser['name'],
                    'isin': ser['isin'],
                    'gestora': e['gestora'],
                    'grupo': e['grupo_gestora'] or e['grupo_depositario'],
                    'grupo_gestora': e['grupo_gestora'],
                    'grupo_depositario': e['grupo_depositario'],
                    'depositario': e['depositario'],
                    'category': 'SICAV',
                    'vocacion': t.get('vocacion', ''),
                    'clase_sociedad': t.get('clase_sociedad', ''),
                    'currency': t.get('currency', ''),
                    # SOCTRIM Patrimonio is in € — normalise to €k for parity with FI Anexo
                    'patrimonio_k': (t.get('patrimonio_eur') or 0.0) / 1000.0,
                    'investors': t.get('investors', 0),
                    'depositary_fee': dep_fee,
                    'dep_fee_basis': basis,
                    'dep_fee_fy': dep_fy,
                    'dep_fee_ytd_ann': dep_ytd_ann,
                    'mgmt_fee_aum': mgmt_fee,
                    'ter': t.get('ter_ttm'),
                    'return_ytd': t.get('return_ytd'),
                    'return_1y': t.get('return_1y'),
                    'fund_type': 'SICAV',
                })

    return {
        'records': records,
        'period': _period_label(latest),
        'yyyymm': latest,
        'ytd_label': _ytd_label(latest),
        'fy_label': _ytd_label(fy_period) if fy_period else None,
        'prior_register': prior_reg,
        'prior_label': _period_label(prior_period) if prior_period else None,
        'prior_aum_eur': prior_aum,
    }


def parse_cnmv_sicav(cnmv_dir):
    """Backward-compatible wrapper: (records, 'YYYY-Qn') or ([], None) if files are missing."""
    full = parse_cnmv_sicav_full(cnmv_dir)
    if not full:
        return [], None
    return full['records'], full['period']
