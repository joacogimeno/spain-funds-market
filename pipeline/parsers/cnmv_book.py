"""Depositary book for one depositario, rebuilt from public CNMV data each quarter.

Replaces the static `inversis_depositary_insights_2025Q3.xlsx` extract. Returns the
same five tables (same column names) so existing transformers keep working, plus a
`Tipo` (FI / SICAV) column and the period label:

  inversis_isin_detail  one row per FI share class / SICAV series at the depositario
  inversis_by_gestora   classes, funds, aum_k, investors, avg/AUM-weighted fee, est. revenue
  inversis_by_group     same by financial group
  inversis_by_fund      same by fund / SICAV
  depositary_ranking    every depositario: classes, funds, aum_k (FI + SICAV)

FI: CNMV Anexo A1.1 (depositario) + A2.2 (AUM, fees) + FONDTRIM (class investors).
SICAV: CNMV SOCREGISTRO / SOCTRIM / SOCPATRIMDISVAR (see cnmv_sicav.py).
Fees are in % (0.07 = 7 bps); revenue in €k = aum_k × fee / 100.
"""
from collections import Counter, defaultdict

from ..config import find_cnmv_file
from .cnmv_fees import parse_cnmv_fees
from .cnmv_fondtrim import fondtrim_path, parse_fondtrim_investors
from .cnmv_registry import parse_cnmv_registry
from .cnmv_sicav import parse_cnmv_sicav_full

INVERSIS = 'BANCO INVERSIS, S.A.'


def _rows(cnmv_dir):
    """All FI classes + SICAV series in the market, in the isin_detail shape."""
    _, quarter = find_cnmv_file(cnmv_dir, 'Anexo')
    registry = {r['isin']: r for r in parse_cnmv_registry(cnmv_dir)}
    fees = parse_cnmv_fees(cnmv_dir)
    yyyymm = f'{quarter[:4]}{int(quarter[-1]) * 3:02d}' if quarter else ''
    ft = fondtrim_path(cnmv_dir, yyyymm) if yyyymm else None
    class_investors = parse_fondtrim_investors(ft) if ft else {}

    rows = []
    fi_grupo = {}
    for r in fees:
        reg = registry.get(r['isin'])
        if not reg:
            continue
        fi_grupo.setdefault(r['gestora'], r['grupo'])
        aum_k = r['patrimonio_k'] or 0.0
        dep = r['depositary_fee'] or 0.0
        mgmt = r['mgmt_fee_aum'] or 0.0
        rows.append({
            'Tipo': 'FI',
            'Fondo': r['fund_name'],
            'Compartimento': reg['compartimento'] or '-',
            'Clase': r['share_class'] or '-',
            'Código ISIN': r['isin'],
            'Sociedad Gestora': r['gestora'],
            'Entidad Depositaria': reg['depositario'],
            'Grupo Financiero': r['grupo'],
            'patrimonio_class_k_eur': aum_k,
            'expense_ratio_pct': r['ter'],
            'investors_accounts': class_investors.get(r['isin'], 0),
            'mgmt_fee_aum': r['mgmt_fee_aum'],
            'mgmt_fee_returns': r['mgmt_fee_returns'],
            'sub_fee_max': r['sub_fee_max'],
            'sub_fee_min': r['sub_fee_min'],
            'redemp_fee_max': r['redemp_fee_max'],
            'redemp_fee_min': r['redemp_fee_min'],
            'deposit_fee': r['depositary_fee'],
            'est_deposit_fee_rev_k_eur': aum_k * dep / 100,
            'est_mgmt_fee_rev_k_eur': aum_k * mgmt / 100,
        })

    sicav = parse_cnmv_sicav_full(cnmv_dir)
    for r in (sicav['records'] if sicav else []):
        aum_k = r['patrimonio_k'] or 0.0
        dep = r['depositary_fee'] or 0.0
        mgmt = r['mgmt_fee_aum'] or 0.0
        rows.append({
            'Tipo': 'SICAV',
            'Fondo': r['fund_name'],
            'Compartimento': r['compartimento'] or '-',
            'Clase': r['share_class'] or '-',
            'Código ISIN': r['isin'],
            'Sociedad Gestora': r['gestora'] or '(Self-managed SICAV)',
            'Entidad Depositaria': r['depositario'],
            'Grupo Financiero': fi_grupo.get(r['gestora']) or r['grupo'],
            'patrimonio_class_k_eur': aum_k,
            'expense_ratio_pct': r['ter'],
            'investors_accounts': r['investors'],
            'mgmt_fee_aum': r['mgmt_fee_aum'],
            'mgmt_fee_returns': None,
            'sub_fee_max': None, 'sub_fee_min': None,
            'redemp_fee_max': None, 'redemp_fee_min': None,
            'deposit_fee': r['depositary_fee'],
            'est_deposit_fee_rev_k_eur': aum_k * dep / 100,
            'est_mgmt_fee_rev_k_eur': aum_k * mgmt / 100,
        })
    return rows, quarter


def _agg(rows):
    aum = sum(r['patrimonio_class_k_eur'] for r in rows)
    fees = [r['deposit_fee'] or 0.0 for r in rows]
    w = sum(r['patrimonio_class_k_eur'] * (r['deposit_fee'] or 0.0) for r in rows)
    return {
        'classes': len(rows),
        'funds': len({r['Fondo'] for r in rows}),
        'aum_k': aum,
        'fi_aum_k': sum(r['patrimonio_class_k_eur'] for r in rows if r['Tipo'] == 'FI'),
        'sicav_aum_k': sum(r['patrimonio_class_k_eur'] for r in rows if r['Tipo'] == 'SICAV'),
        'sicavs': len({r['Fondo'] for r in rows if r['Tipo'] == 'SICAV'}),
        'investors': sum(r['investors_accounts'] or 0 for r in rows),
        'avg_deposit_fee_pct': sum(fees) / len(fees) if fees else 0.0,
        'aum_w_deposit_fee_pct': w / aum if aum else 0.0,
        'est_deposit_fee_rev_k': sum(r['est_deposit_fee_rev_k_eur'] for r in rows),
    }


def build_depositary_book(cnmv_dir, depositario=INVERSIS):
    """Return the book tables for `depositario` plus the market ranking and period."""
    rows, quarter = _rows(cnmv_dir)
    book = [r for r in rows if r['Entidad Depositaria'] == depositario]

    by_gestora = defaultdict(list)
    by_group = defaultdict(list)
    by_fund = defaultdict(list)
    for r in book:
        by_gestora[r['Sociedad Gestora']].append(r)
        by_group[r['Grupo Financiero']].append(r)
        by_fund[(r['Fondo'], r['Sociedad Gestora'])].append(r)

    gest = [{'Sociedad Gestora': g, **_agg(rs)} for g, rs in by_gestora.items()]
    grp = [{'Grupo Financiero': g, 'gestoras': len({r['Sociedad Gestora'] for r in rs}), **_agg(rs)}
           for g, rs in by_group.items()]
    fund = [{'Fondo': f, 'Sociedad Gestora': g, 'Grupo Financiero': rs[0]['Grupo Financiero'],
             'Tipo': rs[0]['Tipo'], **_agg(rs)} for (f, g), rs in by_fund.items()]

    ranking = defaultdict(list)
    for r in rows:
        ranking[r['Entidad Depositaria']].append(r)
    rank = [{'Entidad Depositaria': d,
             'gestoras': len({r['Sociedad Gestora'] for r in rs}),
             **{k: v for k, v in _agg(rs).items() if k in ('classes', 'funds', 'aum_k', 'fi_aum_k', 'sicav_aum_k', 'sicavs')}}
            for d, rs in ranking.items()]

    for t in (gest, grp, fund, rank):
        t.sort(key=lambda x: -x['aum_k'])
    return {
        'period': quarter,
        'inversis_isin_detail': sorted(book, key=lambda r: -r['patrimonio_class_k_eur']),
        'inversis_by_gestora': gest,
        'inversis_by_group': grp,
        'inversis_by_fund': fund,
        'depositary_ranking': rank,
    }
