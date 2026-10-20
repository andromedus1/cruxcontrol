#!/usr/bin/env bash
# Build and publish the next catalog version to the private bucket (CI), or to a local
# directory for dry runs. Objects are create-only; a version is published once its
# manifest exists, so the artifact is always uploaded first.
#
# Environment:
#   CATALOG_BUCKET     bucket name (CI), or
#   CATALOG_STORE_DIR  local directory standing in for the bucket (dry run)
#   CATALOG_FROM_DIR   optional offline Boardsesh inputs for the build (dry run)
#   CATALOG_DEFINITION optional board-definition override (tests only)
#   GITHUB_OUTPUT      when set, receives result=published|unchanged|held and report=PATH
# Exit: 0 for published/unchanged/held (held is reported, not failed); nonzero otherwise.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scripts="$root/web/scripts"
work="$(mktemp -d)"
report="$work/report.json"

if [[ -n "${CATALOG_STORE_DIR:-}" ]]; then
  store_ls() { (cd "$CATALOG_STORE_DIR" && find kilter-7x10 -type f 2>/dev/null | sort) || true; }
  store_get() { cp "$CATALOG_STORE_DIR/$1" "$2"; }
  store_put() {
    local target="$CATALOG_STORE_DIR/$2"
    [[ ! -e "$target" ]] || { echo "refusing to overwrite $2" >&2; return 1; }
    mkdir -p "$(dirname "$target")" && cp "$1" "$target"
  }
else
  : "${CATALOG_BUCKET:?CATALOG_BUCKET or CATALOG_STORE_DIR is required}"
  store_ls() { gcloud storage ls "gs://$CATALOG_BUCKET/kilter-7x10/**" | sed "s#^gs://$CATALOG_BUCKET/##"; }
  store_get() { gcloud storage cp --quiet "gs://$CATALOG_BUCKET/$1" "$2"; }
  store_put() { gcloud storage cp --quiet --if-generation-match=0 "$1" "gs://$CATALOG_BUCKET/$2"; }
fi

output() { [[ -z "${GITHUB_OUTPUT:-}" ]] || echo "$1" >> "$GITHUB_OUTPUT"; }
layout() { python3 "$scripts/catalog-storage.py" "$@"; }

names="$(store_ls)"
latest="$(layout latest <<< "$names")"
[[ -n "$latest" ]] || { echo "No published catalog version; run the one-time bootstrap first." >&2; exit 1; }
# Versions burned by an interrupted publication (artifact without manifest) are skipped.
next="$(layout next <<< "$names")"
mkdir -p "$work/previous" "$work/out"
store_get "$(layout manifest "$latest")" "$work/previous/manifest.json"
store_get "$(layout artifact "$latest")" "$work/previous/kilter-7x10.v$latest.db.gz"
# Version 1 is the bootstrapped Aurora-era catalog. Passing it as the legacy baseline repairs
# rows that builds before the per-angle/rescale fixes carried forward; idempotent afterwards.
legacy=()
if [[ "$latest" -gt 1 ]]; then
  mkdir -p "$work/legacy"
  store_get "$(layout manifest 1)" "$work/legacy/manifest.json"
  if python3 -c 'import json,sys; sys.exit(json.load(open(sys.argv[1])).get("schemaVersion") != 2)' "$work/legacy/manifest.json"; then
    store_get "$(layout artifact 1)" "$work/legacy/kilter-7x10.v1.db.gz"
    legacy=(--legacy-baseline "$work/legacy")
  fi
fi

set +e
python3 "$scripts/build-catalog-snapshot.py" --previous-dir "$work/previous" --out-dir "$work/out" \
  --version "$next" --report "$report" ${legacy[@]+"${legacy[@]}"} ${CATALOG_FROM_DIR:+--from-dir "$CATALOG_FROM_DIR"} \
  ${CATALOG_DEFINITION:+--definition "$CATALOG_DEFINITION"}
code=$?
set -e
output "report=$report"
case "$code" in
  0) ;;
  8) echo "Upstream unchanged since version $latest; nothing to publish."; output "result=unchanged"; exit 0 ;;
  7) echo "Update held by guards; see report."; output "result=held"; exit 0 ;;
  # Upstream format/schema changes, hardware mismatches, invariant violations and an invalid
  # previous artifact are safety refusals too: nothing is published and the hold issue opens.
  2|3|4|9) echo "Update refused (exit $code); see report."; output "result=held"; exit 0 ;;
  *) echo "Catalog build failed with exit code $code." >&2; exit "$code" ;;
esac

file="kilter-7x10.v$next.db.gz"
expected="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sha256"])' "$work/out/manifest.json")"
store_put "$work/out/$file" "$(layout artifact "$next")"
store_get "$(layout artifact "$next")" "$work/readback.db.gz"
actual="$(python3 -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$work/readback.db.gz")"
[[ "$actual" == "$expected" ]] || { echo "Artifact readback mismatch; manifest not published." >&2; exit 1; }
store_put "$work/out/manifest.json" "$(layout manifest "$next")"
echo "Published catalog version $next."
output "result=published"
