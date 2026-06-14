---
source_handle: github-kilterbench
fetched: 2026-06-13
source_url: https://github.com/bjude/kilterbench
provenance: source-direct
---

# bjude/kilterbench (GitHub)

## Summary
A Kilter-specific statistical project — not an ML grade predictor, but the most directly
relevant prior art on *Kilter grade data quality*. Fits skewed-normal distributions to each
climb's repeat-grade histogram to identify reliable "benchmark" climbs and surface grade
inflation. Key value: it documents and quantifies the crowd-sourced-grade bias problem that any
Kilter grade-prediction model must contend with.

## Verbatim key passages
- Problem: the Kilter "Quick Log Ascent" feature "automatically logs flashes at the assigned
  grade", creating artificial spikes in grade histograms
- Preprocessing: assigned-grade count "truncated such that the assigned grade is at most 50% of
  the total repeats"; climbs with "fewer than 500 repeats" filtered out
- Fitting objective: minimizes "a combination of the goodness of fit (using the CRPS score) and
  the distance of the distribution mode from the assigned grade"
- Output: skewed-normal "shape parameter ... shape close to zero indicating a low skew"
- Data source: user Kilter Board accounts via API authentication
- Limitations: curve fitting "approximately 20 minutes on a 32-thread machine"; "Higher grades
  yield fewer benchmarks"; "Currently Kilter-specific"

## Notes for downstream use
- Directly actionable label-quality lessons for a Kilter model:
  (1) Quick-Log flashes inflate the assigned-grade bin — truncate/down-weight it.
  (2) Filter low-repeat climbs (kilterbench uses <500) for trustworthy labels.
  (3) Per-climb grade is a *distribution*, not a point — consider soft labels / regression.
- No predictive model from holds here; it operates on aggregate repeat statistics.
