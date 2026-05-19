"""Scrape CNMV per-entity registry pages for FIL + Capital Riesgo + SICC + FICC.

The CNMV bulk XML feed only covers FI and SICAV. For "alternativos" (FIL hedge
funds, FCR/SCR private equity, SICC/FICC closed-ended IIC, FILPE long-term EU
funds) the only public source is the per-entity HTML pages on cnmv.es.

This module:
- Walks each "MostrarListados.aspx?id=X" listing across paginated pages
- Fetches each entity's "fondo.aspx" or "sociedadiic.aspx" detail page
- Extracts (entity_name, gestora, depositaria, nif, fund_type)
- Caches results to a JSON file so re-runs only fetch new/changed entities

AUM is intentionally not extracted — the CNMV HTML pages don't expose patrimonio
on the main view, and the XBRL semestral filings would require ASP.NET session
state. The aggregate market AUM is read separately from Cuadro 6.1 of the
Estadísticas IIC Excel for FIL, and from the CNMV Capital Riesgo statistics PDF
for ECR (out of scope here).
"""
from __future__ import annotations

import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()


BASE = 'https://www.cnmv.es/Portal/Consultas'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; spain-funds-pipeline/1.0)'}

# Categories to scrape. (listado_id, fund_type label, detail_path)
CATEGORIES = [
    (5,  'FIL',         'iic'),    # IIC de inversión libre (hedge funds)
    (6,  'FIL_FoF',     'iic'),    # IIC de IIC de inversión libre
    (1,  'FCR',         'ecr'),    # Fondos de capital-riesgo
    (20, 'FCR_Pyme',    'ecr'),    # FCR-Pyme
    (21, 'FCR_Europeo', 'ecr'),    # Fondos europeos de capital-riesgo
    (0,  'SCR',         'ecr'),    # Sociedades de capital-riesgo
    (19, 'SCR_Pyme',    'ecr'),    # SCR-Pyme
    (22, 'FESE',        'ecr'),    # Fondos de emprendimiento social europeos
    (23, 'SICC',        'ecr'),    # Sociedades de inversión colectiva tipo cerrado
    (24, 'FICC',        'ecr'),    # Fondos de inversión colectiva tipo cerrado
    (28, 'FILPE',       'iic'),    # Fondos de inversión a largo plazo europeo
]

ENTITY_LINK_RE = re.compile(
    r'<a[^>]+href="(?P<path>(?:iic/|ecr/)?(?:fondo|sociedadiic|sociedad)\.aspx\?nif=(?P<nif>[^"&]+))"'
    r'[^>]*title="(?P<name>[^"]+)"',
    re.IGNORECASE,
)
PAGE_COUNT_RE = re.compile(r'Página\s+1\s+de\s+(\d+)')
NAME_RE = re.compile(r'<span id="ctl00_ContentPrincipal_lblSubtitulo">([^<]+)</span>')

# Two grid IDs are used across categories — IIC pages use gridGestora/gridDepositaria,
# ECR pages use gridGestora/gridDepositaria2. Match either by anchor href pattern.
GESTORA_RE = re.compile(
    r'gridGestora[^>]*>.*?<a[^>]+href="(?:\.\./iic/)?sg(?:iic|-fia[^"]*)?\.aspx\?[^"]*"[^>]*>([^<]+)</a>',
    re.IGNORECASE | re.DOTALL,
)
DEPOSITARIA_RE = re.compile(
    r'gridDepositaria2?[^>]*>.*?<a[^>]+href="(?:\.\./iic/)?depositaria\.aspx\?[^"]*"[^>]*>([^<]+)</a>',
    re.IGNORECASE | re.DOTALL,
)


def _http_get(url, retries=3, backoff=1.0):
    """GET with retries. Returns decoded HTML or raises."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
                return resp.read().decode('utf-8', errors='replace')
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(backoff * (attempt + 1))


def _list_entities(listado_id):
    """Walk pagination, yield {nif, name} dicts for every entity in a listing."""
    first = _http_get(f'{BASE}/MostrarListados.aspx?id={listado_id}')
    m = PAGE_COUNT_RE.search(first)
    total_pages = int(m.group(1)) if m else 1

    seen_nifs = set()
    for page in range(total_pages):
        html = first if page == 0 else _http_get(
            f'{BASE}/MostrarListados.aspx?id={listado_id}&page={page}')
        for match in ENTITY_LINK_RE.finditer(html):
            nif = match.group('nif').strip()
            if nif in seen_nifs:
                continue
            seen_nifs.add(nif)
            yield {
                'nif': nif,
                'name': unescape(match.group('name')).strip(),
                'detail_path': match.group('path'),
            }


def _parse_detail(html):
    """Extract gestora + depositaria from an entity detail page."""
    name_m = NAME_RE.search(html)
    gest_m = GESTORA_RE.search(html)
    depo_m = DEPOSITARIA_RE.search(html)
    return {
        'fund_name': unescape(name_m.group(1)).strip() if name_m else '',
        'gestora':   unescape(gest_m.group(1)).strip() if gest_m else '',
        'depositario': unescape(depo_m.group(1)).strip() if depo_m else '',
    }


def _fetch_entity(detail_path):
    url = f'{BASE}/{detail_path}'
    html = _http_get(url)
    return _parse_detail(html)


def parse_cnmv_alternativos(cache_path, max_workers=8, force_refresh=False, verbose=True):
    """Scrape all alternativo categories. Returns list of records.

    Cache layout: {nif: {fund_name, gestora, depositario, fund_type, name_in_listing}}
    Re-runs reuse cached entities; only newly-listed NIFs are fetched.
    """
    cache = {}
    if os.path.exists(cache_path) and not force_refresh:
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache = json.load(f)
            if verbose:
                print(f'  Loaded cache: {len(cache)} entities')
        except (OSError, json.JSONDecodeError):
            cache = {}

    # 1. List all entities across all categories
    all_listed = {}  # nif -> {name, fund_type, detail_path}
    for listado_id, fund_type, _ in CATEGORIES:
        if verbose:
            print(f'  Listing {fund_type} (id={listado_id})...', end=' ', flush=True)
        try:
            count = 0
            for ent in _list_entities(listado_id):
                # First-listing wins (avoid double-classifying entities visible in
                # multiple sub-categories — unusual but possible)
                all_listed.setdefault(ent['nif'], {
                    'name_in_listing': ent['name'],
                    'fund_type': fund_type,
                    'detail_path': ent['detail_path'],
                })
                count += 1
            if verbose:
                print(f'{count} entries')
        except Exception as e:
            if verbose:
                print(f'FAILED: {e}')

    # 2. Identify which entities need fetching (not in cache)
    to_fetch = [(nif, meta) for nif, meta in all_listed.items() if nif not in cache]
    if verbose:
        print(f'  Total listed: {len(all_listed)}; to fetch: {len(to_fetch)}; cached: {len(all_listed) - len(to_fetch)}')

    # 3. Parallel fetch detail pages
    def _job(nif_meta):
        nif, meta = nif_meta
        try:
            detail = _fetch_entity(meta['detail_path'])
            return nif, {
                'fund_name': detail['fund_name'] or meta['name_in_listing'],
                'gestora': detail['gestora'],
                'depositario': detail['depositario'],
                'fund_type': meta['fund_type'],
            }
        except Exception as e:
            return nif, {'error': str(e), 'fund_type': meta['fund_type'],
                         'fund_name': meta['name_in_listing']}

    if to_fetch:
        done = 0
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {ex.submit(_job, nm): nm[0] for nm in to_fetch}
            for fut in as_completed(futures):
                nif, rec = fut.result()
                cache[nif] = rec
                done += 1
                if verbose and (done % 50 == 0 or done == len(to_fetch)):
                    print(f'  Fetched {done}/{len(to_fetch)}')

        # Persist cache after fetching
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)

    # 4. Build records list — drop entities with no depositario (errors or missing data)
    records = []
    for nif, rec in cache.items():
        # Only include entities that are still in the current listing
        if nif not in all_listed:
            continue
        if not rec.get('depositario'):
            continue
        records.append({
            'nif': nif,
            'fund_name': rec['fund_name'],
            'gestora': rec['gestora'],
            'depositario': rec['depositario'],
            'fund_type': rec['fund_type'],
        })

    return records


if __name__ == '__main__':
    import sys
    cache = sys.argv[1] if len(sys.argv) > 1 else '/tmp/cnmv_alternativos_cache.json'
    recs = parse_cnmv_alternativos(cache)
    print(f'\nTotal records: {len(recs)}')
    from collections import Counter
    by_type = Counter(r['fund_type'] for r in recs)
    print('By type:', dict(by_type))
    by_depo = Counter(r['depositario'] for r in recs)
    print('\nTop 10 depositarios (entity count):')
    for d, c in by_depo.most_common(10):
        print(f'  {d[:50]:50} {c}')
