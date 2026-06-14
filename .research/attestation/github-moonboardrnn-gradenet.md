---
source_handle: github-moonboardrnn-gradenet
fetched: 2026-06-13
source_url: https://arxiv.org/abs/2102.01788
provenance: source-direct
---

# MoonBoardRNN / GradeNet — Duh & Chang, Recurrent Neural Network for MoonBoard Climbing Route Classification and Generation (arXiv 2102.01788; repo github.com/jrchang612/MoonBoardRNN)

## Summary
The foundational MoonBoard grade-prediction work. Introduces BetaMove, a move-preprocessing
pipeline that converts a static MoonBoard problem into a human-like hand-move sequence; that
sequence then feeds an LSTM grade predictor (GradeNet) and a route generator (DeepRouteSet).
Core thesis: injecting the human move sequence as inductive bias is what lifts accuracy.

## Verbatim key passages (abstract-direct)
- BetaMove is "a new move preprocessing pipeline we developed, in order to mimic a human
  climber's hand sequence"
- "the accuracy of our grade predictor reaches near human-level performance"
- Motivation: "Existing machine learning models not only fail to accurately predict a
  problem's difficulty, but they are also unable to generate reasonable problems"
- BetaMove lets them "inject human insights into the machine learning problems"

## Cite-through (numbers from frontiers-grading-bias-2024 attribution)
- GradeNet exact-grade accuracy 46.7%, ±1-grade 84.7%, MoonBoard 2016, 13 V-grades.
- "GradeNet outperformed other classifiers including CNN, MLP, and Graphical neural networks."

## Notes for downstream use
- BetaMove = the single most-cited lesson: hold-set alone is weaker than hold-set + inferred
  move sequence. But it requires a domain heuristic to infer the sequence (sibling:
  feature-engineering).
- Repo is open source (MIT-ish, CS230 2020): reusable reference implementation, MoonBoard-only.
- Pitfall acknowledged elsewhere (board-to-board): move-decomposition can inject its own bias.
