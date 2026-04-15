#!/usr/bin/env bash
set -euo pipefail

consumer_config="${DOC_VADER_CONSUMER_CONFIG:-.doc-vader/backlog-consumer.json}"

has_consumer_config=0
previous=""
for arg in "$@"; do
  if [ "$previous" = "--consumer-config" ]; then
    has_consumer_config=1
    break
  fi

  case "$arg" in
    --consumer-config=*)
    has_consumer_config=1
    break
      ;;
  esac

  previous="$arg"
done

if [ $# -gt 0 ] && [ "$has_consumer_config" -eq 0 ]; then
  case "$1" in
    backlog|work-item|record)
      if [ -f "$consumer_config" ]; then
        set -- "$@" --consumer-config "$consumer_config"
      fi
      ;;
  esac
fi

run_doc_vader() {
  local candidate="$1"
  shift

  if [ "${candidate##*.}" = "js" ]; then
    exec node "$candidate" "$@"
  fi

  exec "$candidate" "$@"
}

if [ -n "${DOC_VADER_CLI:-}" ]; then
  run_doc_vader "$DOC_VADER_CLI" "$@"
fi

if [ -x "./node_modules/.bin/doc-vader" ]; then
  run_doc_vader "./node_modules/.bin/doc-vader" "$@"
fi

if [ -f "../tiab/doc-vader/dist/cli/doc-vader.js" ]; then
  run_doc_vader "../tiab/doc-vader/dist/cli/doc-vader.js" "$@"
fi

if command -v doc-vader >/dev/null 2>&1; then
  run_doc_vader "$(command -v doc-vader)" "$@"
fi

cat >&2 <<'EOF'
Unable to find a usable doc-vader CLI.

Set DOC_VADER_CLI to an executable or built dist/cli/doc-vader.js path, or install doc-vader on PATH.
EOF
exit 1
