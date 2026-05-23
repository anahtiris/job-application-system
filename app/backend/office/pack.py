"""Repack an unpacked DOCX directory back into a .docx file.

Uses the original DOCX as the source for [Content_Types].xml and _rels/.rels
so that content type declarations and root relationships are preserved exactly.
"""
import shutil
import sys
import zipfile
from pathlib import Path


def pack(unpacked_dir: str | Path, output_path: str | Path, original_docx: str | Path) -> Path:
    unpacked_dir = Path(unpacked_dir)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Collect member order from the original so zip structure is identical
    with zipfile.ZipFile(original_docx, "r") as orig:
        original_members = orig.namelist()

    written = set()
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        # Write in original order first (preserves Office validation)
        for member in original_members:
            file_path = unpacked_dir / member
            if file_path.exists() and file_path.is_file():
                zout.write(file_path, member)
                written.add(member)
        # Write any new files added during editing
        for file_path in sorted(unpacked_dir.rglob("*")):
            if file_path.is_file():
                rel = file_path.relative_to(unpacked_dir).as_posix()
                if rel not in written:
                    zout.write(file_path, rel)

    return output_path


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: pack.py <unpacked_dir> <output.docx> --original <original.docx>")
        sys.exit(1)
    # Support: pack.py unpacked_dir output.docx --original original.docx
    unpacked_dir = sys.argv[1]
    output = sys.argv[2]
    original = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--original" else sys.argv[3]
    pack(unpacked_dir, output, original)
    print(f"Packed to {output}")
