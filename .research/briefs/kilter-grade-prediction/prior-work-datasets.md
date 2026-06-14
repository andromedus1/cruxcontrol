---
description: Survey of existing grade-prediction work and reusable datasets for Kilter Board and MoonBoard — what's been built, what accuracy was reached, and the reusable datasets/lessons that ground a Kilter difficulty-prediction effort.
type: brief
kind: research
slug: kilter-grade-prior-work
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-13
summary: >
  Almost all published grade-prediction work targets the MoonBoard, not the Kilter Board.
  The strongest route-only MoonBoard models cluster at ~42–47% exact-grade accuracy and ~84%
  within-one-grade, with a regression SOTA of 0.87 MAE / 1.12 RMSE. The recurring lesson is
  that converting the static hold set into an inferred human move sequence (BetaMove/GradeNet)
  beats feeding the raw hold matrix, while cross-board/cross-edition generalization stays below
  human level. Kilter-specific ML is mostly route *generation* and grade-inflation analysis,
  not prediction. Two reusable HuggingFace Kilter datasets exist (Vilin97/KilterBoard — SQLite,
  angle-keyed, prediction-friendly; stfamod/Kilter-Board-Dataset — tokenized seq2seq, generation-
  oriented), and BoardLib is the canonical way to pull raw Kilter data.
key_findings:
  - Route-only MoonBoard grade-prediction accuracy ceilings are well-established and modest — ~42–47% exact-grade, ~84% within ±1 grade — setting a realistic prior band for a comparable Kilter model [frontiers-grading-bias-2024]{1}.
  - The dominant lesson across the literature is that sequencing the holds into an inferred human move order (BetaMove → GradeNet LSTM) materially outperforms feeding the raw hold matrix to a CNN/MLP [github-moonboardrnn-gradenet]{2}[frontiers-grading-bias-2024]{1}.
  - Cross-board / cross-edition generalization is the main unsolved problem — SOTA regression (0.87 MAE) holds within a board but generalization "is below human level performance currently"; for Kilter this maps to generalizing across angles and layouts [arxiv-board-to-board-2311-12419]{3}.
  - There is essentially no published Kilter *grade-prediction* model; existing Kilter ML is route generation (genclimb/stfamod) and grade-inflation/benchmark statistics (kilterbench) [hf-stfamod-kilter-board-dataset]{4}[github-kilterbench]{5}.
  - Two ready Kilter datasets exist with different shapes — Vilin97/KilterBoard is a SQLite corpus keyed by (uuid, angle) with 80/10/10 UUID-disjoint splits and is directly usable for prediction; stfamod/Kilter-Board-Dataset is a tokenized [Board,Difficulty]→[Frames] seq2seq set aimed at generation [hf-vilin97-kilterboard]{6}[hf-stfamod-kilter-board-dataset]{4}.
  - Crowd-sourced Kilter labels are biased — the "Quick Log Ascent" flash mechanism inflates the assigned-grade bin; kilterbench mitigates by truncating that bin to ≤50% of repeats and dropping climbs with <500 repeats [github-kilterbench]{5}.
---

# Prior Work & Datasets: Kilter Board Grade Prediction

## Scope
This brief covers the facet *Prior work & datasets*: what others have built for climbing grade
prediction (Kilter and MoonBoard), what accuracy they reached, the reusable datasets, and the
lessons/pitfalls reported. It deliberately does **not** prescribe feature engineering, model
architecture, evaluation protocol, or in-browser inference — those are sibling facets.

## The state of play: MoonBoard is the field; Kilter is mostly untouched (for prediction)

Published, benchmarked grade-prediction work is overwhelmingly MoonBoard-based. The MoonBoard's
fixed hold set and standardized layout made it the de-facto research substrate; the Kilter
Board's far larger and configurable hold set has attracted ML attention mainly for route
*generation* and *grade-quality analysis* rather than prediction [hf-stfamod-kilter-board-dataset]{4}[github-kilterbench]{5}.

### Reported accuracy (MoonBoard, route-only models)
The Frontiers 2024 review consolidates the headline numbers [frontiers-grading-bias-2024]{1}:

| Work | Method | Exact-grade acc. | ±1 grade | Dataset / grades |
| --- | --- | --- | --- | --- |
| Duh & Chang "GradeNet" | LSTM + BetaMove sequencer | 46.7% | 84.7% | MoonBoard 2016, 13 V-grades [github-moonboardrnn-gradenet]{2} |
| Petashvili & Rodda | 4-layer 2DCNN | 42.0% | 84.0% | MoonBoard 2016–2019, 12 Font grades |
| Hold-based Bayesian Net | Bayesian network | 71.0% | — | MoonBoard 2016, only 3 grades |
| Stapel | Beam search + HGBC | 46.5% | — | 11 V-grades |

Earlier baselines (Naive Bayes / Softmax / a raw-matrix CNN at ~34%) were beaten by the
sequence-aware LSTM, which the original authors describe as reaching "near human-level
performance" [github-moonboardrnn-gradenet]{2}.

Framed as **regression** rather than classification, the Board-to-Board work reports
"0.87 MAE and 1.12 RMSE" as state-of-the-art on MoonBoard 2016/2017/2019, using a feature set
that "does not require decomposing routes into individual moves" [arxiv-board-to-board-2311-12419]{3}.

**Realistic prior band for a comparable Kilter route-only model: ~42–47% exact-grade,
~84% within ±1 grade.** Higher numbers in the table come with caveats — the 71% Bayesian result
is over only 3 grades, and climber-centric models that hit 98% use wearable-sensor data, not
route geometry, so they are out of scope for a holds-only predictor [frontiers-grading-bias-2024]{1}.

## The recurring lesson: sequence the holds, don't dump the matrix

The single most-repeated finding is that **how you represent the problem matters more than the
model family**. Duh & Chang's BetaMove converts a static MoonBoard problem into a human-like
hand-move sequence before the LSTM ever sees it, and that preprocessing is credited with the
jump to near-human accuracy — GradeNet "outperformed other classifiers including CNN, MLP, and
Graphical neural networks" [github-moonboardrnn-gradenet]{2}. The Frontiers review generalizes
this: "Sequencing holds/movements is critical—mirrors how climbers preview routes," and
"Route-centric NLP approaches with sequenced feature data represent the current optimal
solution" [frontiers-grading-bias-2024]{1}. (The detailed *how* of sequencing belongs to the
feature-engineering sibling.)

## The recurring pitfall: generalization and label bias

Two cautions show up repeatedly:

1. **Generalization is unsolved.** Within a single board/edition, models do well; across boards
   or editions, "the generalization performance of these techniques is below human level
   performance currently" [arxiv-board-to-board-2311-12419]{3}. MoonBoard models also "don't
   transfer to chaotic (non-standardized) gym walls" [frontiers-grading-bias-2024]{1}. For
   Kilter, the direct analogue is generalizing across **angles** and **layouts** — and the
   Vilin97 dataset's `(uuid, angle)` keying makes angle a first-class variable to test this
   on [hf-vilin97-kilterboard]{6}.

2. **Crowd-sourced grades are biased.** The Frontiers review flags that "crowd-sourced data
   introduces grading bias (mitigation: use 'benchmark' routes)" [frontiers-grading-bias-2024]{1}.
   kilterbench makes this concrete for Kilter: the app's "Quick Log Ascent" auto-logs flashes
   at the assigned grade, spiking the assigned-grade histogram bin. Its mitigations — truncate
   that bin to "at most 50% of the total repeats" and drop climbs with "fewer than 500 repeats"
   — are directly reusable label-cleaning heuristics, and its per-climb skewed-normal fits imply
   a grade is better treated as a distribution than a point label [github-kilterbench]{5}.

## Reusable datasets

| Dataset | Shape / format | Filters | Best for | License |
| --- | --- | --- | --- | --- |
| **Vilin97/KilterBoard** | SQLite (`kilter_splits.sqlite`); train/val/test tables + reference tables (placements, placement_roles, holes); rows keyed by `(uuid, angle)`; 80/10/10 UUID-disjoint splits; ~100K–1M rows; layout 1, size 10, sets {1,20} | `ascensionist_count>0`, `difficulty_numeric≤30.5` (~V13), `3≤num_holds≤50` | **Grade prediction** — prebuilt leakage-safe splits, angle as a column, hold-role reference tables | MIT [hf-vilin97-kilterboard]{6} |
| **stfamod/Kilter-Board-Dataset** | Tokenized seq2seq; source `[Board, Difficulty]` → target `[Frames]`; ships token_to_id/id_to_token | ≥5 ascensionists, Original + Homewall layouts, quality >2.6, frames count 1 | Route **generation** (genclimb); pairs would need inversion for prediction | MIT [hf-stfamod-kilter-board-dataset]{4} |
| **BoardLib** (lemeryfertitta) | Tooling to download the raw Aurora/Kilter SQLite DB | n/a | Building a custom dataset / fresh pull; both HF datasets derive from it | open source |

Recommendation for grounding: **Vilin97/KilterBoard is the natural prediction substrate** — it
already provides UUID-disjoint splits (avoiding the leakage trap of same-problem-different-angle
rows landing in both train and test) and the placement/role reference tables. Note its data is
SQLite, so the HF auto-loader/viewer cannot read it; load it directly [hf-vilin97-kilterboard]{6}.
For label hygiene, layer kilterbench's repeat-count and Quick-Log truncation filters on top
[github-kilterbench]{5}.

## Disconfirming analysis
- **"MoonBoard numbers transfer to Kilter."** Not established. No fetched source benchmarks a
  Kilter grade predictor end-to-end; the ~42–47% band is a MoonBoard prior, and Board-to-Board
  shows cross-board transfer degrades below human level [arxiv-board-to-board-2311-12419]{3}.
  Kilter's larger, configurable hold set and per-angle grades could move accuracy in either
  direction — treat the band as a hypothesis to validate, not a target.
- **"BetaMove is obviously the right move."** Disconfirming evidence exists: Board-to-Board
  deliberately uses "a feature-set that does not require decomposing routes into individual
  moves" precisely to avoid move-decomposition bias, yet still reaches regression SOTA
  [arxiv-board-to-board-2311-12419]{3}. So sequence-preprocessing is not a settled prerequisite.
- **"More data is always better."** kilterbench's filtering (drop <500 repeats; cap the assigned-
  grade bin) shows aggressive *removal* of biased/low-evidence labels is part of what makes the
  signal usable [github-kilterbench]{5}.

## Contradictions
- **Classification vs. regression framing.** GradeNet/2DCNN report classification accuracy
  (46.7% / 42.0%) [github-moonboardrnn-gradenet]{2}[frontiers-grading-bias-2024]{1}, while
  Board-to-Board reports regression error (0.87 MAE) [arxiv-board-to-board-2311-12419]{3}. These
  are not directly comparable; the choice of framing is an open question (defer to
  evaluation-methodology sibling).
- **Move-decomposition: essential vs. biasing.** GradeNet treats the inferred move sequence as
  the key enabler [github-moonboardrnn-gradenet]{2}; Board-to-Board treats move-decomposition as
  a bias source to avoid [arxiv-board-to-board-2311-12419]{3}. Genuine tension in the literature.

## Suggested cross-references to sibling subdomains
- **feature-engineering:** BetaMove move-sequence inference; encoding hold roles
  (placement_roles in Vilin97); angle as a feature; the move-decomposition bias debate.
- **classical-models:** the Bayesian-network and GBT/HGBC route-centric baselines noted here.
- **deep-representation-models:** GradeNet LSTM, the 2DCNN hold-matrix encoding, the vision-based
  encoding from Board-to-Board, and stfamod's tokenized sequence representation.
- **evaluation-methodology:** the classification-vs-regression framing contradiction; ±1-grade
  tolerance metric; UUID-disjoint splitting (Vilin97); treating grade as a distribution
  (kilterbench skewed-normal fits); cross-angle/cross-layout generalization protocol.
- **in-browser-inference:** stfamod's genclimb demo (genclimb.pages.dev) is an existing
  browser-deployed Kilter model worth examining for the inference-deployment facet.

## Acquisition-pending gaps
- Exact row/sample **counts** for both HF datasets (Vilin97 README gives only a 100K–1M band;
  stfamod README gives none) — would need to load the files to count.
- The Stanford CS230 GradeNet PDF returned as binary on fetch; its accuracy numbers are cited
  *through* the Frontiers review rather than read source-direct. Direct extraction (HTML mirror
  or text-layer PDF) is pending if higher confidence is needed.
- No source-direct confirmation of a fully benchmarked **Kilter** (not MoonBoard) grade
  predictor was found — appears to be a genuine gap in prior art, not just an unfetched source.
