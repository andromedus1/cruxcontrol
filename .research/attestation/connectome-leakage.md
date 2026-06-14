---
source_handle: connectome-leakage
fetched: 2026-06-13
source_url: https://pmc.ncbi.nlm.nih.gov/articles/PMC10901797/
provenance: source-direct
---

# Data leakage inflates prediction performance in connectome-based machine learning models (PMC10901797)

Methodological study quantifying how different forms of data leakage inflate cross-validated prediction performance. Domain-agnostic on the mechanics of leakage; directly transferable to the climb-grade-prediction split design.

## Verbatim key passages

- Feature-selection leakage (most severe): selecting features across combined train+test inflated performance, "particularly for weak associations." Attention problems baseline r = 0.01 inflated to r = 0.48 under leaky feature selection.
- Subject-level / duplicate leakage: with 20% subject duplication, performance increased Δr = 0.04–0.29 across datasets; effect intensified for weaker baseline associations.
- Grouping recommendation: gold-standard CV requires "all members of a single family were included in the same test split."
- Family leakage was negligible only because most participants lacked family members in the dataset: "Family leakage did not affect prediction performance of age or matrix reasoning (Δr = 0.00, Δq² = 0.00)."
- Sample-size vulnerability: smaller samples were far more susceptible to leakage distortion (high variability at N=100).

## Summary

Two leakage modes matter most for grade prediction: (1) feature/preprocessing leakage — any normalization, feature selection, or target encoding fit on the full dataset before splitting inflates metrics, worst when the true signal is weak; (2) duplicate/grouped-sample leakage — correlated samples (e.g., the same climb at multiple angles, or near-duplicate climbs by the same setter) split across train and test inflate performance. Mitigation: group all correlated samples into the same fold/split, and fit all preprocessing inside the training fold only. Weak-signal and small-sample regimes are most vulnerable — relevant to low-ascent climbs.
