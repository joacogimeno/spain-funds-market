import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "Data")
OUTPUT_DIR = os.path.join(BASE_DIR, "src", "data")

# Map folder date suffix (DDMMYY) to YYYY-MM label
def parse_folder_date(suffix):
    """Parse DDMMYY from folder name -> (year, month, day) tuple."""
    dd = int(suffix[:2])
    mm = int(suffix[2:4])
    yy = int(suffix[4:6])
    yyyy = 2000 + yy
    return yyyy, mm, dd

def get_snapshot_folders():
    """Return sorted list of (YYYY-MM label, folder_path) for all snapshots."""
    snapshots = []
    seen_dates = {}
    for name in sorted(os.listdir(DATA_DIR)):
        if not name.startswith("informacion publica fondos inversion-"):
            continue
        path = os.path.join(DATA_DIR, name)
        if not os.path.isdir(path):
            continue
        # Extract date suffix - handle variants like "311224 2" and "310126 (1)"
        suffix_part = name.replace("informacion publica fondos inversion-", "")
        date_str = suffix_part.split()[0].split("(")[0].strip()
        if len(date_str) != 6 or not date_str.isdigit():
            continue
        yyyy, mm, dd = parse_folder_date(date_str)
        label = f"{yyyy}-{mm:02d}"
        # Later folders override earlier ones (handles duplicates like "311224 2")
        seen_dates[label] = path
    return sorted(seen_dates.items())

# Category name mappings (normalize across files)
CATEGORY_MAP = {
    "Monetarios": "Monetarios",
    "RF Euro CP": "RF Euro CP",
    "RF Euro LP": "RF Euro LP",
    "RF Mixta Euro": "RF Mixta Euro",
    "RV Mixta Euro": "RV Mixta Euro",
    "RV Nacional": "RV Nacional",
    "Garantizados RF": "Garantizados RF",
    "Garantizados RV": "Garantizados RV",
    "Garantía parcial": "Garantía parcial",
    "Garantizados de Rendimiento Fijo": "Garantizados RF",
    "Garantizados de Rendimiento Variable": "Garantizados RV",
    "De garantía parcial": "Garantía parcial",
    "Gestión pasiva": "Gestión pasiva",
    "Retorno Absoluto": "Retorno Absoluto",
    "Fondos Indice": "Fondos Índice",
    "Fondos Índice": "Fondos Índice",
    "Fondo Indice": "Fondos Índice",
    "Fondo Índice": "Fondos Índice",
    "Objetivo Concreto de Rentabilidad no Garantizado": "Objetivo Rentabilidad",
    "Objetivo Concreto de Rentabilidad No Garantizado": "Objetivo Rentabilidad",
    "Objetivo Concreto de Rentabilidad No Garantizado ": "Objetivo Rentabilidad",
    "Objetivo de rentabilidad no garantizado": "Objetivo Rentabilidad",
    "Rentabilidad Objetivo": "Objetivo Rentabilidad",
    "Globales": "Globales",
    "Internacional": "Internacional",
    "RF Internacional": "RF Internacional",
    "Renta fija": "RF Internacional",
    "RF Mixta Internacional": "RF Mixta Internacional",
    "Renta fija mixta": "RF Mixta Internacional",
    "RV Mixta Internacional": "RV Mixta Internacional",
    "Renta variable mixta": "RV Mixta Internacional",
    "RV Euro Resto": "RV Euro Resto",
    "RV Internacional Europa": "RV Intl Europa",
    "RV Internacional EE.UU": "RV Intl EEUU",
    "RV Internacional EE.UU.": "RV Intl EEUU",
    "RV Internacional Japón": "RV Intl Japón",
    "RV Internacional Emergentes": "RV Intl Emergentes",
    "RV Internacional Resto": "RV Intl Resto",
    "Renta Variable Nacional": "RV Nacional",
    "Renta Variable Internacional": "RV Internacional",
    "Fondo Inversion Libre": "FIL",
    "Fondo Hedge Funds": "Hedge Funds",
}

def normalize_category(name):
    """Normalize category name."""
    name = name.strip()
    return CATEGORY_MAP.get(name, name)

# Major categories for dashboard grouping
MAIN_CATEGORIES = [
    "Monetarios", "RF Euro CP", "RF Euro LP", "RF Mixta Euro",
    "RV Mixta Euro", "RV Nacional", "Garantizados RF", "Garantizados RV",
    "Retorno Absoluto", "Fondos Índice", "Objetivo Rentabilidad", "Globales",
]

# File number to category file mapping
CATEGORY_FILE_MAP = {
    19: "Monetarios",
    20: "RF Euro CP",
    21: "RF Euro LP",
    22: "RF Mixta Euro",
    23: "RV Mixta Euro",
    24: "RV Nacional",
    26: "RF Internacional",
    27: "RF Mixta Internacional",
    28: "RV Mixta Internacional",
    29: "RV Euro Resto",
    30: "RV Intl Europa",
    31: "RV Intl EEUU",
    32: "RV Intl Japón",
    33: "RV Intl Emergentes",
    34: "RV Intl Resto",
    35: "Globales",
    36: "Garantizados RF",
    37: "Garantizados RV",
    38: "Garantía parcial",
    40: "Retorno Absoluto",
    41: "FIL",
    42: "Fondos de FIL",
    44: "Fondos Índice",
    45: "Objetivo Rentabilidad",
}
