"""Unpack a DOCX file (ZIP) into a directory for XML editing."""
import shutil
import sys
import zipfile
from pathlib import Path


def unpack(docx_path: str | Path, output_dir: str | Path) -> Path:
    docx_path = Path(docx_path)
    output_dir = Path(output_dir)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    with zipfile.ZipFile(docx_path, "r") as z:
        z.extractall(output_dir)
    return output_dir


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: unpack.py <file.docx> <output_dir>")
        sys.exit(1)
    unpack(sys.argv[1], sys.argv[2])
    print(f"Unpacked to {sys.argv[2]}")
