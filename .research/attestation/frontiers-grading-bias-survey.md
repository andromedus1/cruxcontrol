---
source_handle: frontiers-grading-bias-survey
fetched: 2026-06-13
source_url: https://pmc.ncbi.nlm.nih.gov/articles/PMC11881084/
provenance: source-direct
---

# Frontiers / PMC — Addressing grading bias in rock climbing: machine and deep learning approaches (2024)

Survey + taxonomy of climbing grade-prediction ML. Same article as frontiersin.org DOI 10.3389/fspor.2024.1512010 (PMC mirror used because publisher PDFs would not decode).

## Paraphrased summary

Approaches split into route-centric (route qualities, e.g. hold types), climber-centric (climber qualities, e.g. wearable biometrics), and path-finding/generation (route + climber movement). Route-centric is the relevant family for an offline frames→grade model. Dominant route representation is a one-hot hold grid; sequencing the holds (BetaMove-style) measurably improves accuracy. Path-finding work tabulates explicit node/edge cost features useful as hand-engineered features.

## Key verbatim passages

- One-hot encoding: "each route was one-hot encoded as a 18×11 feature vector (i.e., a route is a set of holds on the 18×11 grid; if present, that grid position is coded '1')."
- Hold attribute features: "hold types, hold sizes, movements, and movement distances." Bayesian Network with "incut depth features" reached 71.0% across three grades.
- Node-cost features (body posture): free limbs, unique limb positions, center-of-mass proximity, stretch/reach limits, limb crossing, hold-type difficulty.
- Edge-cost features (movement): cumulative inter-hold distances, limb-change frequency, center-of-mass deviation, movement-flow variation.
- Results: Duh & Chang LSTM 84.7% (±1); Petashvili & Rodda 2D-CNN 84.0% (±1) with one-hot; Ansel probabilistic 91.75% using energy expenditure + rest quality. Conclusion: "sequencing of feature data" was most predictive.
- Several grade classifiers land near human benchmark at ~45–47% exact accuracy across 10 grades.
