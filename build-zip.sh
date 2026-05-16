#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUTFILE="pagepatch-${VERSION}.zip"

rm -f "$OUTFILE"

zip -r "$OUTFILE" \
  manifest.json \
  README.md \
  PRIVACY.md \
  LICENSE \
  src/ \
  icons/ \
  -x "*.DS_Store" \
     "*/.git/*" \
     "*/node_modules/*" \
     "*__pycache__*"

echo ""
echo "Built: $OUTFILE"
echo "Size:  $(du -h "$OUTFILE" | cut -f1)"
echo ""
echo "Contents:"
unzip -l "$OUTFILE"
echo ""

python3 -c "import json; json.load(open('manifest.json')); print('manifest.json: valid JSON')"

echo ""
echo "Ready to upload to Chrome Web Store Developer Dashboard."
