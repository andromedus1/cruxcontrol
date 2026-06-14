---
source_handle: moonboardrnn-betamove-code
fetched: 2026-06-13
source_url: https://raw.githubusercontent.com/jrchang612/MoonBoardRNN/master/preprocessing/Step2_BetaMove.ipynb
provenance: source-direct
---

# MoonBoardRNN — Step2_BetaMove.ipynb (code-level feature construction)

The notebook that actually builds the per-move feature vector consumed by GradeNet.

## Paraphrased summary

Holds are stored as (x,y) integer tuples keyed to a difficulty array. Each move is a dict capturing the target hold (string id, hand, difficulty score), the maintained/remaining hold, the moving-from hold, two relative-distance vectors, and a binary foot-placement array. Move feasibility ("success score") is modeled with a sum-of-Gaussians over reach geometry plus hand-specific hold difficulty. Sequences are assembled by beam search ranked by overall success rate.

## Key verbatim passages

- Coordinate storage: holds stored as `(int(X_coord), int(Y_coord)): difficulty_array`.
- Example move dict: `{'TargetHoldString': 'F6', 'TargetHoldHand': 'RH', 'TargetHoldScore': array([1]), 'dxdyRtoT': (4.0, 2.0), 'MovingHoldString': 'D3', 'MovingHoldScore': array([3]), 'dxdyMtoT': (2.0, 3.0), 'FootPlacement': [0, 0, 0, 1, 1, 1, 0]}`
- `dxdyRtoT` = relative distance vector from remaining hold to target; `dxdyMtoT` = from moving hold to target.
- Success score uses "possible range of next right hand using sum of two Gaussian" centered on realistic reach, combining Euclidean inter-hold distance with separate left/right hand difficulty tables.
- Sequences ranked by `overallSuccessRate()`; beam search retains top candidates each iteration.
