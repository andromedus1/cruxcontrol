---
description: Feature engineering for predicting Kilter Board climb difficulty from frames, hold (x,y) coordinates, hold roles, and board angle — the frames→geometry decoding pipeline and the geometric/graph features prior MoonBoard/Kilter grade-prediction work found predictive.
type: brief
kind: research
slug: kilter-grade-feature-engineering
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-14
summary: >
  A climb is converted to ML features in two stages. First, decode the frames
  string (pXXXXrXX tokens) through the board's SQLite tables (placements →
  holes (x,y); placement_roles → start/middle/finish/foot) into a set of
  (x, y, role) holds. Second, derive features over that point set: per-hold
  counts and density, height statistics, hand-hold inter-distance / span /
  reach (especially the largest move), foot-vs-hand counts, role-based
  position features, and board angle. Prior work converges on two predictive
  families: a one-hot hold grid (lets a CNN learn spatial structure) and a
  sequenced move representation (BetaMove's 22-dim per-move vector of
  target position, relative distance to the previous two holds, per-hold
  difficulty, foot placement, and a reach-feasibility success score), the
  latter being the more predictive but requiring a move-ordering heuristic.
key_findings:
  - The Kilter frames string decodes deterministically to geometry via the app's
    SQLite tables — pXXXXrXX → placements.hole_id → holes.(x,y), with role_id
    giving hand/foot and start/finish semantics. This decode is the prerequisite
    for every geometric feature. [kilter-frames-db-schema]{4}
  - Two representations dominate prior MoonBoard work — a one-hot 18×11 hold
    grid, and a sequenced per-move vector. Sequencing the holds is consistently
    reported as the single most predictive choice. [frontiers-grading-bias-survey]{3}
  - BetaMove's 22-dim per-move vector is the most concrete reusable feature recipe —
    target hold position, relative distance to the previous two holds, difficulty
    scale of all three holds, foot placement, and a per-move success score.
    [duh-chang-moonboardrnn]{1}
  - Move feasibility ("success score") is modeled from Euclidean inter-hold
    distance combined with hand-specific per-hold difficulty via a sum-of-Gaussians
    reach model — i.e. reach/span is the load-bearing geometric signal.
    [moonboardrnn-betamove-code]{2}
  - Path-finding studies enumerate reusable hand-engineered features as node costs
    (reach/stretch limits, center-of-mass proximity, hold-type difficulty, limb
    crossing) and edge costs (cumulative inter-hold distance, limb-change frequency,
    COM deviation). [frontiers-grading-bias-survey]{3}
  - Per-hold difficulty/quality is itself a strong learned feature (incut depth in
    a Bayesian net hit 71% over three grades); for Kilter this can be recovered
    data-drivenly from how a given placement co-occurs with graded climbs.
    [frontiers-grading-bias-survey]{3}
  - Grade prediction underestimates the hardest climbs (GradeNet degrades above ~V8),
    so features that capture extreme single-move difficulty deserve extra weight.
    [duh-chang-moonboardrnn]{1}
---

# Feature Engineering for Kilter Grade Prediction

This brief covers how to turn one Kilter climb — its `frames` string, the hold
`(x,y)` coordinate table, and the board angle — into a feature vector for an
offline grade-prediction model. It is implementation-focused: the decode
pipeline, the geometric/graph features prior work found predictive, and the two
representation families to choose between. It does *not* cover which model to
fit, how to evaluate it, or how to export to the browser (see cross-references).

## Stage 1 — Decode frames into geometry

A Kilter climb is stored as a `frames` string: a concatenation of per-hold
tokens of the form `pXXXXrXX`, where the digits after `p` are a `placement_id`
and the digits after `r` are a `role_id`, e.g. `p1083r15p1117r15p1164r12...`
[kilter-frames-db-schema]{4}. Decoding uses the board's local SQLite tables:

- `placements`: `placement_id → hole_id`
- `holes`: `hole_id → (x, y)` board coordinates
- `placement_roles`: `role_id → role` (start / middle / finish / foot-only; the
  same table the app uses for LED colour)
- `leds`: `hole_id → LED position` (Bluetooth only; not needed for features)

[kilter-frames-db-schema]{4}

Pipeline: regex-split the frames string on `p(\d+)r(\d+)`; for each token resolve
`placement_id → hole_id → (x,y)` and `role_id → role`. The result is a list of
`(x, y, role)` tuples — the geometric substrate all downstream features read
from. Note the role taxonomy differs from MoonBoard: Kilter distinguishes a
foot-only role, so hand-holds and foot-holds must be separated before computing
hand-reach features.

## Stage 2 — Features over the (x, y, role) point set

The literature converges on a small set of geometric/graph features. Group them
as follows.

### Count and density features
- Number of holds total; counts split by role (start, finish, middle hand,
  foot-only).
- Hold density: holds per unit board area, or holds per unit climb height.
  Prior route-centric work treats hold count and spacing as primary difficulty
  signals [frontiers-grading-bias-survey]{3}.

### Height / extent features
- Climb height (max_y − min_y) and width (max_x − min_x).
- Mean and max hold height; vertical center of mass of hand-holds.

### Inter-hold distance / reach / span (the load-bearing signal)
This is where prior work places the most weight. The dominant model treats a
climb as a sequence of *moves* between consecutive hand-holds and scores each
move by reach feasibility — Euclidean inter-hold distance combined with
hand-difficulty, via a sum-of-Gaussians over realistic reach
[moonboardrnn-betamove-code]{2}. Concretely, derivable per-climb features:
- Distance to nearest neighbour per hold; mean and max nearest-neighbour distance.
- Largest hand-to-hand move (the crux reach) — weight this heavily, since
  prediction error concentrates on hard climbs where one extreme move dominates
  [duh-chang-moonboardrnn]{1}.
- Mean/median/std of consecutive-move distances if a move ordering is computed.
- Horizontal vs vertical components of moves (a long sideways span differs from a
  long vertical pull).

Path-finding studies enumerate these as explicit **edge costs**: cumulative
inter-hold distance, limb-change frequency, center-of-mass deviation, and
movement-flow variation; and **node costs**: stretch/reach limits, center-of-mass
proximity, limb crossing, and hold-type difficulty
[frontiers-grading-bias-survey]{3}. These are directly reusable as
hand-engineered features for a classical model.

### Role-based and per-hold-quality features
- Start-hold height and count; finish-hold height; whether starts are matched.
- Per-hold "difficulty" / quality: how good or bad each placement is. In a
  Bayesian net, hold incut-depth features alone reached 71% over three grades
  [frontiers-grading-bias-survey]{3}. There is no incut metadata in the Kilter
  schema, but an analogous per-placement difficulty can be recovered
  data-drivenly from how each placement co-occurs with consensus grades across
  the corpus — a learned hold-difficulty lookup that then becomes a feature.

### Board angle
Angle is a first-class feature, not a global constant: the target itself
(`difficulty_average`) is defined per angle, so angle must enter the feature
vector (or the model must be conditioned on it) for every climb. (Angle handling
on the target side is the evaluation facet's concern.)

## Two representation families (pick per model)

Prior MoonBoard work uses two encodings, and they map to different sibling model
facets:

1. **One-hot hold grid.** Encode the board as a fixed grid (MoonBoard: an 18×11
   one-hot vector, "if present, that grid position is coded '1'")
   [frontiers-grading-bias-survey]{3}. For Kilter, the analogue is a grid (or
   multi-channel grid: one channel per role) over hole coordinates. This is the
   natural input for a CNN and needs no move-ordering. Petashvili & Rodda's 2D-CNN
   on one-hot reached 84.0% within ±1 grade [frontiers-grading-bias-survey]{3}.

2. **Sequenced move vector (BetaMove / GradeNet).** Order the holds into a plausible
   climbing sequence, then embed each move as a fixed vector. BetaMove's 22-dim
   per-move vector contains: the target hold's position, the relative distance to
   the previous two holds, the difficulty scales of all three holds, the foot
   placement, and the estimated success score of the move [duh-chang-moonboardrnn]{1}.
   The code-level move record exposes exactly these fields — target hold
   (string/hand/score), the remaining and moving holds, two relative-distance
   vectors `dxdyRtoT` and `dxdyMtoT`, and a binary `FootPlacement` array
   [moonboardrnn-betamove-code]{2}. Sequencing is consistently the most predictive
   single choice [frontiers-grading-bias-survey]{3}, but it requires a
   move-ordering heuristic (beam search ranked by reach-feasibility success score)
   [duh-chang-moonboardrnn]{1}, which adds preprocessing cost and a bias source.

A pragmatic split: hand-engineered scalar features (counts, density, height,
reach summaries, angle) feed a classical model; the one-hot grid feeds a CNN; the
sequenced vector feeds a sequence/GNN model. Which model consumes which is the
sibling facets' call.

## Disconfirming analysis

- *Is sequencing actually necessary, or just one lab's preference?* The
  Board-to-Board (2311.12419) abstract explicitly reports strong results "using a
  feature-set that does not require decomposing routes into individual moves,"
  framing move-decomposition as a bias source rather than a requirement. I could
  not decode that paper's full text (PDF binary; abstract only), so I cannot
  attest its feature set — but it is direct disconfirming evidence that the
  one-hot / non-sequenced family is competitive, and a builder should not assume
  BetaMove-style sequencing is mandatory. Recorded as an acquisition-pending gap.
- *Does per-hold difficulty generalize to Kilter?* The 71% incut-depth result is
  MoonBoard-specific and relies on hold metadata Kilter does not expose; I am
  flagging the data-driven per-placement-difficulty substitute as speculative, not
  attested — it is my inference, not a sourced Kilter result.
- *Reach feasibility uses a fixed climber model.* BetaMove's sum-of-Gaussians reach
  assumes a typical span; on a corpus with varied climbers, an absolute distance
  feature may be more robust than a feasibility score tuned to one body model
  [moonboardrnn-betamove-code]{2}.

## Contradictions

- **Move-decomposition: predictive vs biasing.** Duh & Chang treat the BetaMove
  move sequence as the key to near-human accuracy [duh-chang-moonboardrnn]{1}, and
  the Frontiers survey reports sequencing as most predictive
  [frontiers-grading-bias-survey]{3}. The Board-to-Board authors instead argue
  move-decomposition "introduces bias" and deliberately avoid it (abstract only;
  unattested full text). These are genuinely opposed design stances; surface both
  to the model-selection facets rather than resolving here.

## Suggested cross-references

- **classical-models**: hand-engineered scalar features here (counts, density,
  height, reach summaries, per-placement difficulty, angle) are the GBT input.
- **deep-representation-models**: the one-hot role-channel grid (CNN) and the
  sequenced per-move vector (sequence/GNN) are the representations to consume; the
  move-ordering heuristic belongs to that facet too.
- **evaluation-methodology**: per-angle target (`difficulty_average`), how angle
  enters the model, and the underestimation-at-high-grades failure mode
  [duh-chang-moonboardrnn]{1} affect metrics/splits.
- **prior-work-datasets**: BetaMove/GradeNet repo (MoonBoardRNN), the Frontiers
  taxonomy, the Board-to-Board paper, and the Kilter HF dataset / SQLite schema.
- **in-browser-inference**: feature computation (frames decode + geometry) must run
  client-side before inference; keep the decode tables and feature code portable to
  JS, or precompute features server-side.
