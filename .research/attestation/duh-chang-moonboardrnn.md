---
source_handle: duh-chang-moonboardrnn
fetched: 2026-06-13
source_url: https://arxiv.org/pdf/2102.01788
provenance: source-direct
---

# Duh & Chang — Recurrent Neural Network for MoonBoard Climbing Route Classification and Generation (2021)

Paper introducing BetaMove (move-sequence preprocessor) and GradeNet (LSTM grade predictor). Companion code at https://github.com/jrchang612/MoonBoardRNN (separately attested).

## Paraphrased summary

BetaMove is a preprocessing pipeline that mimics a human climber's hand sequence. It computes a per-move "success score" from the relative distance between holds and the per-hold difficulty scale, then uses beam search to find the easiest plausible sequence. The resulting move sequence feeds GradeNet, an LSTM classifier.

## Key verbatim passages

- The input of GradeNet is a move sequence produced by BetaMove, with each move embedded into a **22-dimensional vector**. This vector includes: the target hold's position, the relative distance to the previous 2 holds, the difficulty scales of all three holds, the placement of feet, and the estimated success scores of each move.
- "BetaMove ... computes the success score of each move by the relative distance between holds and the difficulty scale of each hold. It then finds the best route using beam search algorithm."
- Performance limitation: "For problems easier than V8, GradeNet performs well, but for harder problems, GradeNet underestimates their difficulty."
- Reported accuracy (corroborated by Frontiers survey): 46.7% exact across 10 grades, 84.7% within ±1 grade.
