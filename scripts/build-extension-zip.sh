#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MANIFEST="$ROOT_DIR/src/manifest.json"
OUTPUT_DIR="$ROOT_DIR/dist"

if [ ! -f "$MANIFEST" ]; then
	echo "Error: src/manifest.json was not found." >&2
	exit 1
fi

VERSION=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -n 1)

if [ -z "$VERSION" ]; then
	echo "Error: version could not be read from src/manifest.json." >&2
	exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
	echo "Error: zip command is required." >&2
	exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT="$OUTPUT_DIR/wpgp-tools-$VERSION.zip"
rm -f "$OUTPUT"

(
	cd "$ROOT_DIR/src"
	zip -qr "$OUTPUT" .
)

if ! command -v unzip >/dev/null 2>&1; then
	echo "Created $OUTPUT"
	exit 0
fi

if ! unzip -Z1 "$OUTPUT" | grep -qx 'manifest.json'; then
	echo "Error: manifest.json is not at the ZIP root." >&2
	rm -f "$OUTPUT"
	exit 1
fi

echo "Created $OUTPUT"
