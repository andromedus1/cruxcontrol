#!/usr/bin/env bash
# Open or update the single "Catalog update held" issue from a guard-hold report.
# Counts and reasons only; no climb data. Requires GH_TOKEN with issues: write.
set -euo pipefail
report="${1:?report path}"
title="Catalog update held by safety checks"
body="$(python3 - "$report" "${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
verdict, rec = data.get("verdict") or {}, data.get("reconcile") or {}
lines = ["The weekly catalog build was **held**; the previously published version is unchanged.", "",
         "**Reasons**"] + [f"- {reason}" for reason in verdict.get("reasons", [])]
if rec:
    lines += ["", "**Counts**",
              f"- previous version: {rec.get('previous_version')}",
              f"- app-visible present before / now: {rec.get('previous_present')} / {rec.get('present')}",
              f"- added / newly removed / restored: {rec.get('added')} / {rec.get('removed')} / {rec.get('restored')}",
              f"- lost identities: {len(rec.get('lost', []))}; case changes: {len(rec.get('case_changed', []))}"]
else:
    lines += ["", "The build stopped before reconciliation (upstream format, hardware or input check)."]
lines += ["", f"Run: {sys.argv[2]}",
         "", "Thresholds and the review procedure are in docs/DEPLOY.md (Catalog publication)."]
print("\n".join(lines))
PY
)"
existing="$(gh issue list --state open --search "in:title \"$title\"" --json number --jq '.[0].number // empty')"
if [[ -n "$existing" ]]; then
  gh issue comment "$existing" --body "$body"
else
  gh issue create --title "$title" --body "$body"
fi
