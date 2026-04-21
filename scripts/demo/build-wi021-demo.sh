#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/assets/demo/templjs-demo.mp4}"
TMP_DIR="$(mktemp -d)"
FPS=30

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command not found: $1" >&2
    exit 1
  fi
}

resolve_font() {
  local requested_font="$1"
  local fallback_font

  if [ -n "$requested_font" ]; then
    if [ -f "$requested_font" ]; then
      printf '%s\n' "$requested_font"
      return 0
    fi
    echo "Error: requested font file not found: $requested_font" >&2
    return 1
  fi

  if command -v fc-match >/dev/null 2>&1; then
    local matched_font
    matched_font="$(fc-match monospace -f '%{file}\n' 2>/dev/null | head -n 1 || true)"
    if [ -n "$matched_font" ] && [ -f "$matched_font" ]; then
      printf '%s\n' "$matched_font"
      return 0
    fi
  fi

  for fallback_font in \
    "/System/Library/Fonts/Supplemental/Menlo.ttc" \
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf" \
    "/usr/share/fonts/TTF/DejaVuSansMono.ttf" \
    "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf" \
    "/mnt/c/Windows/Fonts/consola.ttf" \
    "/c/Windows/Fonts/consola.ttf"
  do
    if [ -f "$fallback_font" ]; then
      printf '%s\n' "$fallback_font"
      return 0
    fi
  done

  echo "Error: unable to find a usable font. Set FONT or FONT_PATH, or pass a font path as the second argument." >&2
  return 1
}

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

require_cmd python3
require_cmd ffmpeg
require_cmd ffprobe

if ! python3 -c 'from PIL import Image, ImageDraw, ImageFont' >/dev/null 2>&1; then
  echo "Error: Python dependency Pillow is required (python3 -m pip install pillow)." >&2
  exit 1
fi

FONT="${FONT:-${FONT_PATH:-${2:-}}}"
FONT="$(resolve_font "$FONT")"

make_slide() {
  local index="$1"
  local duration="$2"
  local title="$3"
  local body="$4"
  local bg="$5"
  local png_file="$TMP_DIR/slide-${index}.png"
  local seg_file="$TMP_DIR/segment-${index}.mp4"

  python3 - "$png_file" "$title" "$body" "$bg" "$FONT" <<'PY'
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

out, title, body, bg, font_path = sys.argv[1:6]
width, height = 1280, 720
img = Image.new('RGB', (width, height), bg)
draw = ImageDraw.Draw(img)
title_font = ImageFont.truetype(font_path, 40)
body_font = ImageFont.truetype(font_path, 24)

draw.text((80, 72), title, fill='white', font=title_font, spacing=12)
draw.multiline_text((80, 170), body, fill='white', font=body_font, spacing=12)
Path(out).parent.mkdir(parents=True, exist_ok=True)
img.save(out)
PY

  ffmpeg -loglevel error -y \
    -loop 1 -framerate ${FPS} -t "${duration}" -i "$png_file" \
    -c:v libx264 -pix_fmt yuv420p -r ${FPS} "$seg_file"
}

make_slide 1 40 "templjs demo" "A short walkthrough for WI-021\n\nThis video covers:\n- install and build\n- first render\n- example templates\n- VS Code workflow\n- CLI usage\n- next steps" "#16324f"
make_slide 2 40 "1. Installation" "From the repo root:\n\npnpm install\npnpm --filter @templjs/core build\npnpm --filter @templjs/cli build\n\nThis prepares the core renderer and CLI for the examples pack." "#284b63"
make_slide 3 50 "2. First render" "Render the markdown example:\n\nnode src/packages/cli/dist/cli.js render \\
  -t examples/markdown-report/template.md.tmpl \\
  -i examples/markdown-report/data.json\n\nResult: a rendered analytics report from structured JSON data." "#355c7d"
make_slide 4 50 "3. Example pack" "Included examples in this release-ready pack:\n\n- markdown-report\n- html-email\n- json-api\n- config-files\n- documentation\n\nEach ships with template, data, and README instructions." "#3f6f8c"
make_slide 5 45 "4. VS Code workflow" "Open a .templ file in VS Code and use the extension workflow:\n\n- template authoring in the editor\n- completion for paths and filters\n- hover help for built-ins\n- diagnostics for malformed statements\n\nUse src/extensions/vscode/test-fixtures/index.html.tmpl as a quick demo target." "#467f96"
make_slide 6 40 "5. CLI workflow" "The same template can be rendered in CI or local scripts:\n\ntempljs render --template <file> --input <data.json>\n\nThis keeps editor validation and automation aligned around the same source files." "#4f8d9d"
make_slide 7 35 "6. Where to go next" "Review the docs and examples:\n\n- docs/getting-started.md\n- docs/examples.md\n- examples/*/README.md\n\nGenerated for WI-021 to provide a reviewable demo-video artifact in-repo." "#5b9aa5"

LIST_FILE="$TMP_DIR/concat.txt"
while IFS= read -r file; do
  printf "file '%s'\n" "$file" >> "$LIST_FILE"
done < <(find "$TMP_DIR" -maxdepth 1 -type f -name 'segment-*.mp4' | sort -V)

mkdir -p "$(dirname "$OUT")"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$LIST_FILE" -c copy "$OUT"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT"
