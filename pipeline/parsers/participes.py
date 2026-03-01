"""Parse 05-ParticipesFondosEuro.csv — historical investors by category."""
from .spanish_csv import read_time_series_csv, find_file


def parse_participes(folder):
    """Parse participes file from a snapshot folder."""
    filepath = find_file(folder, "05-ParticipesFondos")
    if not filepath:
        return []
    return read_time_series_csv(filepath)


def parse_participes_no_euro(folder):
    """Parse non-euro participes file."""
    filepath = find_file(folder, "06-ParticipesFondos")
    if not filepath:
        return []
    return read_time_series_csv(filepath)
