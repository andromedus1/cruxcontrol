---
source_handle: frontiers-grading-bias-2024
fetched: 2026-06-13
source_url: https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1512010/full
provenance: source-direct
---

# Addressing grading bias in rock climbing: machine and deep learning approaches (Frontiers, 2024)

## Summary
A survey/review organizing climbing grade-prediction work into three families: route-centric
(features from route/holds), climber-centric (features from climber performance/sensors), and
path-finding/generation (hybrid). Serves as a cite-through source for the headline accuracy
numbers of the major MoonBoard grade-prediction works. Conclusion: route-centric NLP-style
approaches with *sequenced* hold/move features are currently the strongest route-only method.

## Verbatim key passages (with cite-through attributions)
- Duh & Chang GradeNet (LSTM + BetaMove sequencer), MoonBoard 2016, 13 V-Scale grades:
  "Accuracy: 46.7% (exact grade); 84.7% (±1 grade tolerance)"
- Petashvili & Rodda 2DCNN, MoonBoard 2016–2019, 12 Font grades:
  "Accuracy: 42.0% (exact); 84.0% (±1 tolerance)"
- Bayesian Network (hold-based), MoonBoard 2016, 3 grades: "Accuracy: 71.0%"
- Andric et al. Random Forest, perceived difficulty (Vertical Life): "RMSE: 0.378 (indoor)"
- Stapel Beam Search + HGBC, 11 V-Scale grades: "Accuracy: 46.5%"
- Ebert HPO MLP (climber sensor data, 13 routes / 3 ratings): "Accuracy: 98.04%"
  (climber-centric, not route-only — not directly comparable)

## Lessons / pitfalls (verbatim)
- "Sequencing holds/movements is critical—mirrors how climbers preview routes"
- "Nonlinear models outperform linear approaches"
- "MoonBoard's standardization enables higher accuracy but limits generalizability"
- "MoonBoard models don't transfer to chaotic (non-standardized) gym walls"
- "Crowd-sourced data introduces grading bias (mitigation: use 'benchmark' routes)"
- Recommendation: "Route-centric NLP approaches with sequenced feature data represent the
  current optimal solution for addressing grading bias"

## Notes
- Exact-grade accuracy ceiling for MoonBoard route-only models clusters ~42–47%; ±1-grade
  tolerance ~84%. This is the realistic prior band for a similar Kilter route-only model.
- The "grading bias from crowd-sourced data" warning is directly relevant to Kilter (Quick-Log
  flash inflation — see kilterbench attestation).
