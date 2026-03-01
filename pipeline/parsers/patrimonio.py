"""Parse 01-PatrimFondosEuro.csv — historical AUM by category."""
from .spanish_csv import read_time_series_csv, find_file


def parse_patrimonio(folder):
    """Parse patrimony file from a snapshot folder. Returns list of monthly records."""
    filepath = find_file(folder, "01-PatrimFondos")
    if not filepath:
        return []
    return read_time_series_csv(filepath)


def parse_patrimonio_no_euro(folder):
    """Parse non-euro patrimony file."""
    filepath = find_file(folder, "02-PatrimFondos")
    if not filepath:
        return []
    return read_time_series_csv(filepath)
