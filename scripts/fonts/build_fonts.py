"""Instance and subset the display and text serifs into small WOFF2 files.

Playfair 2 and Source Serif 4 ship with optical-size and width axes that we never
vary at runtime. Pinning those axes (and keeping only the weight axis) cuts each
file to a fraction of its size. Run from the repo root after `npm install`:

    pip install fonttools brotli
    python3 scripts/fonts/build_fonts.py

Both families are licensed under the SIL Open Font License 1.1.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
NM = ROOT / "node_modules"
OUT = ROOT / "src" / "assets" / "fonts"

# Basic Latin, Latin-1, general punctuation, currency and the few symbols we set in serif.
UNICODES = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,"
    "U+20AC,U+2122,U+2190-2193,U+2197,U+2212,U+2215,U+FEFF,U+FFFD"
)

JOBS = [
    # (source, output, axis limits)
    (
        NM / "@fontsource-variable/playfair/files/playfair-latin-standard-normal.woff2",
        "display.woff2",
        {"opsz": 96, "wdth": 87.5, "wght": (400, 900)},
    ),
    (
        NM / "@fontsource-variable/playfair/files/playfair-latin-standard-italic.woff2",
        "display-italic.woff2",
        {"opsz": 96, "wdth": 87.5, "wght": (400, 700)},
    ),
    (
        NM / "@fontsource-variable/source-serif-4/files/source-serif-4-latin-standard-normal.woff2",
        "text.woff2",
        {"opsz": 20, "wght": (400, 650)},
    ),
    (
        NM / "@fontsource-variable/source-serif-4/files/source-serif-4-latin-standard-italic.woff2",
        "text-italic.woff2",
        {"opsz": 20, "wght": (400, 650)},
    ),
]


def build(src: Path, name: str, limits: dict) -> None:
    # Subset first: instancing a lazily loaded font and then subsetting it trips over gvar.
    font = TTFont(src)
    options = subset.Options()
    options.layout_features = ["kern", "liga", "calt", "lnum", "pnum", "tnum", "onum", "frac", "ss01", "ss02"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, limits)
    font.flavor = "woff2"
    OUT.mkdir(parents=True, exist_ok=True)
    font.save(OUT / name)
    print(f"{name}: {(OUT / name).stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    for job in JOBS:
        build(*job)
