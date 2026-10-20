#!/usr/bin/env python3
"""Storage-layout helper for catalog-publish.sh.

  catalog-storage.py latest            < object names (one per line)  -> version or nothing
  catalog-storage.py next              < object names (one per line)  -> next unused version
  catalog-storage.py artifact VERSION                                 -> object name
  catalog-storage.py manifest VERSION                                 -> object name
"""
import sys

from catalog.storage_layout import artifact_object, latest_version, manifest_object, next_version


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command in ("latest", "next"):
        names = [line.strip() for line in sys.stdin if line.strip()]
        version = (latest_version if command == "latest" else next_version)(names)
        if version is not None:
            print(version)
        return 0
    if command in ("artifact", "manifest") and len(sys.argv) == 3:
        print((artifact_object if command == "artifact" else manifest_object)(int(sys.argv[2])))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
