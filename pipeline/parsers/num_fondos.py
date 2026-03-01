"""Parse 11-NumFondosEuro.csv — historical fund count by category."""
from .spanish_csv import read_time_series_csv, find_file


def parse_num_fondos(folder):
    """Parse fund count file."""
    filepath = find_file(folder, "11-NumFondos")
    if not filepath:
        return []
    return read_time_series_csv(filepath)
