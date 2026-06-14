---
description: Deep representation-learning models (CNN, GNN, sequence/Transformer) for predicting Kilter Board climb difficulty from hold placements, roles, and board angle — when each family fits, their inductive biases, data requirements, and in-browser export implications.
type: brief
kind: research
slug: kilter-grade-deep-models
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-13
summary: >
  Three deep representation families have been tried on MoonBoard-style boards (the closest prior art to Kilter). CNNs over the lit-hold grid are the simplest and most export-friendly but treat the board as a sparse image and plateau near 34% exact accuracy. Graph convolutional networks on a heterogeneous problem/hold co-occurrence graph improve robustness to class imbalance and the hard grades (~0.73 AUC) but the published variant is transductive (Text-GCN) and does not naturally export per-route inference to the browser. Sequence models (LSTM) over a human-ordered move sequence are the current prior-art frontier — GradeNet reached human-level ±1 accuracy (84.7%) — but their performance came almost entirely from a hand-engineered move-ordering preprocessor (BetaMove), not the network. Transformers have only been tried on tiny climbing datasets and underperformed. For Kilter, the binding constraints are dataset size relative to deep models' data hunger and the need for a small, per-route, angle-conditioned model that exports cleanly to ONNX.js/TF.js.
key_findings:
  - On MoonBoard, sequence models (LSTM) reached human-level ±1 accuracy (GradeNet 84.7% within one grade, 46.7% exact), beating CNN (34%) and GCN (AUC 0.73) — but the gain came from the BetaMove move-ordering preprocessor, not the recurrent network; a naive RNN on raw hold lists scored only ~34.7% [duh-chang-rnn]{1}.
  - The "graph" in published climbing GCN work is a Text-GCN over a heterogeneous problem/hold co-occurrence graph (holds as words, problems as documents), NOT a move-graph; it is transductive and does not produce a clean per-new-route forward pass for browser inference [tai-gcn]{2}.
  - CNNs treat the board as a {0,1} grid image; the representation is "too sparse" and the inductive bias (translation invariance) is partly wrong for a fixed-position board, capping accuracy near 34% [duh-chang-rnn]{1}, [tai-gcn]{2}.
  - GCNs are markedly more robust to the severe class imbalance (easy grades dominate) and out-perform classical/dense models specifically at the rare hard grades [tai-gcn]{2}.
  - The hard-grade error mode is a crux-move problem — a V11 may have one V11 move surrounded by V8 moves — which motivates attention/pooling over moves rather than averaging [duh-chang-rnn]{1}.
  - Transformers have only been applied to a ~20-route (augmented to 1000) climbing dataset and failed (degenerate padding-token / non-hold outputs); attention is data-hungry and likely premature unless Kilter's dataset is large [poirier-transformer]{3}.
  - Across all families the practical accuracy bar is ±1-grade ≈ 84–85% (human parity); exact-grade accuracy across 10–12 classes sits ~40–47% [frontiers-grading-bias]{4}, [duh-chang-rnn]{1}.
---

# Deep representation-learning models for Kilter grade prediction

This brief covers three deep-learning model families for predicting climb difficulty from a board's lit holds, hold roles (start/hand/foot/finish), and board angle: (a) CNNs over a 2D grid/image of the board, (b) graph neural networks with holds as nodes, and (c) sequence models (RNN/Transformer) over an ordered placement list. The closest prior art is MoonBoard grade prediction; the dataset specifics of that prior art are deferred to the prior-work sibling. The question throughout is: do these representation-learners beat gradient-boosted trees (deferred to the classical-models sibling) given a realistic dataset size, and can the chosen model export to and run in the browser (deferred in depth to the in-browser-inference sibling)?

## The board as substrate, and why representation choice dominates

A Kilter (like a MoonBoard) is a fixed grid of holds. A climb is a subset of those holds, each tagged with a role (start / hand / foot / finish). The target is community-consensus difficulty, and difficulty is angle-dependent — the same hold set is harder steeper. The three families differ chiefly in how they encode this fixed-grid-plus-roles structure, and the prior art shows the *representation*, not the network depth, is what moves accuracy.

The single most important empirical result in the corpus is that on MoonBoard, a naive recurrent network fed raw hold lists scored ~34.7% exact accuracy — essentially tied with the CNN — while the *same* recurrent architecture fed a human-ordered move sequence (BetaMove) jumped to 46.7% exact / 84.7% within ±1, reaching human-level performance. The authors state plainly that "the improvement primarily comes from the injection of human insight through the BetaMove-preprocessed move sequence" [duh-chang-rnn]{1}. This is the central lesson for Kilter: a deep model is only as good as the representation it is handed.

## (a) CNN over a 2D board-image / grid

**Representation construction.** Encode the board as a {0,1} matrix over its grid (MoonBoard: 18×11), one channel per hold-role (so a Kilter encoding would stack channels for start/hand/foot/finish rather than a single binary plane), optionally adding hold metadata. Board angle is a scalar conditioning input concatenated after the convolutional stack.

**Inductive bias.** Convolutions assume translation invariance and local spatial correlation. For a climbing board this bias is *partly wrong*: hold positions are fixed and a move's difficulty depends on absolute reach distances and which specific holds are involved, not on a pattern that can appear anywhere. The lit-hold matrix is also extremely sparse (a climb lights ~5–12 of ~140+ cells), which the prior art explicitly flags: "the {0,1}18×11 matrix used in CNN is too sparse" [duh-chang-rnn]{1}.

**Prior-art performance.** Dobles et al.'s ordinal-regression CNN reached 34.0% exact accuracy across 13 grades but "generalized better to the distribution of route difficulty" than classical models [tai-gcn]{2}, [frontiers-grading-bias]{4}. A later 4-layer 2D-CNN (Petashvili & Rodda) reached 42.0% exact / 84.0% within ±1 across 12 grades [frontiers-grading-bias]{4} — closing much of the gap to the LSTM, suggesting a well-tuned CNN with role channels is competitive.

**Data requirements.** A small CNN (few conv layers) is the least data-hungry of the three deep families and can train on tens of thousands of routes — the scale Kilter plausibly offers.

**Export implications.** A small 2D-CNN is the *most* browser-friendly deep option: conv/relu/pool/dense ops are fully supported by both ONNX Runtime Web and TF.js, the graph is static, and parameter counts can be kept in the low hundreds of KB. (Export mechanics deferred to the in-browser-inference sibling.)

**When it fits Kilter.** Good default if the team wants a single static model with no preprocessing pipeline, accepts ~42% exact / ~84% ±1, and wants the cleanest export. Use one input plane per role and concatenate angle as a conditioning scalar.

## (b) Graph neural networks (holds as nodes)

**A critical clarification about the prior art.** The only published climbing GNN (Tai et al.) is *not* the intuitive "holds are nodes, possible moves are edges" graph. It is a **Text-GCN**: a heterogeneous graph of **problem nodes and hold nodes**, where holds play the role of words and problems play the role of documents. Hold–hold edges carry pointwise-mutual-information (co-occurrence) weights; problem–hold edges carry IDF weights [tai-gcn]{2}. Classification is *transductive* — every problem to be graded must be a node in the graph at training time, and a forward pass is `softmax(Ã ReLU(Ã X W0) W1)` over the whole graph [tai-gcn]{2}.

**Inductive bias.** This design encodes "problems that share holds are similar, and similar problems have similar grades" — label propagation across a co-occurrence graph. It deliberately exploits class structure: GCNs proved "far less susceptible to class imbalance than the classic machine learning algorithms or even fully-connected feed-forward networks," outperforming logistic regression specifically at the rare hard grades [tai-gcn]{2}. A surprising finding was that 4 convolution steps beat 2 ("if my neighbors are mostly V5 and my neighbor's neighbors are also V5, I am likely V5"), and that edge *weights* mattered little — "the connections amongst nodes themselves are more important than the weights of these edges" [tai-gcn]{2}.

**Performance.** Best GCN reached 0.73 average AUC across 11 grades, beating all classical baselines (LogReg 0.70, RF 0.67, GBT 0.62, SVM 0.66, MLP 0.66) on AUC [tai-gcn]{2}.

**The export problem.** The transductive Text-GCN is poorly suited to in-browser inference: grading a brand-new climb requires it to be inserted into the corpus graph and the co-occurrence statistics recomputed, not a self-contained forward pass over the single route. An *inductive* reformulation would be required for Kilter — either (i) GraphSAGE-style inductive GNN on a per-route move-graph (holds as nodes, edges = feasible hand moves between holds, node features = position/role/hold-difficulty, edge features = reach vector and angle-adjusted distance), aggregated to a route embedding then a grade head; or (ii) keep the co-occurrence idea only as a *training-time* feature source, distilled into a feed-forward model for inference.

**Data requirements.** A per-route inductive GNN has moderate data hunger — between a CNN and a Transformer — and needs a feasible-move edge construction (the same physical move-feasibility logic BetaMove encodes for sequences).

**When it fits Kilter.** Worth it only if (i) the team builds an *inductive* per-route move-graph, and (ii) the crux-move / class-imbalance robustness is valued. The published transductive variant is a research result, not a deployable inference model. Angle enters naturally as an edge feature (it changes effective reach difficulty per move).

## (c) Sequence models (RNN / Transformer) over the ordered placement list

**Representation construction.** Convert the hold *set* into an ordered *move sequence*, then embed each move. GradeNet embeds each move into a 22-dim vector: target-hold (x,y), relative-distance vectors to the previous two holds, the difficulty scales of the three holds involved, foot placement, and a move success score [duh-chang-rnn]{1}. The ordering itself is produced upstream by BetaMove (beam search, beam size 8) which "exactly matched the move sequences predicted by a climbing expert in 95% of the test problems (19/20)" [duh-chang-rnn]{1}.

**Architecture (GradeNet).** Two-stage: LSTM → 6 dense layers → flattened first grade prediction; then 6th-dense output → 2 more LSTMs → 2 dense layers → second grade prediction; loss = sum of the two cross-entropies. Regularizers (batchnorm, dropout, L2, pooling) gave no significant improvement [duh-chang-rnn]{1}.

**Inductive bias.** A sequence model encodes the climber's path start→finish, capturing move-to-move transitions — the natural physics of climbing. This is why the prior art argues climbing "is more similar to an NLP problem than a computer vision problem" [duh-chang-rnn]{1}.

**Performance and the crux-move limit.** GradeNet hit 46.7% exact / 84.7% ±1 / AUC 0.773 on test — human parity [duh-chang-rnn]{1}, [frontiers-grading-bias]{4}. Its failure mode: it underestimates grades above V8 because "there are only 1 or 2 crux moves while most other moves are around V8 ... We therefore expect an attention model can better tackle this challenge" [duh-chang-rnn]{1}. This is the strongest motivation for attention/max-pooling over moves (a crux is a max, not an average).

**Transformers — premature on small data.** The one Transformer attempt in the corpus used only ~20 routes augmented to 1000 and failed: degenerate outputs ("the model almost always outputs the padding token"; "most of the predicted positions are not even holds"), self-assessed as "not conclusive" [poirier-transformer]{3}. Attention's lack of strong inductive bias makes it the most data-hungry family; it is unlikely to beat a GBT or LSTM on Kilter unless the dataset is large (hundreds of thousands of well-graded climbs) — and even then a small attention-pool over moves (to handle the crux problem) is more promising than a full autoregressive Transformer.

**The preprocessing dependency.** The decisive caveat: GradeNet's edge over a naive RNN is the BetaMove preprocessor, a hand-built move-ordering heuristic [duh-chang-rnn]{1}. For Kilter, a sequence model requires building the equivalent ordering/feasibility logic (angle-aware reach feasibility between holds) — that is real engineering, and it overlaps heavily with the feature-engineering sibling.

**Export implications.** A small LSTM exports to ONNX.js / TF.js but recurrent ops are heavier and less universally optimized than conv/dense; sequence length is variable (handle via padding/masking). A small attention-pool head over per-move feature vectors is lighter and export-friendlier than a full Transformer.

## Do deep models beat GBT at Kilter's dataset size?

The corpus does not settle this for Kilter directly, but the signal is cautionary. On MoonBoard, the *deep* family that won (LSTM) won because of a hand-engineered representation, and a generic deep model (naive RNN, baseline CNN) only matched simple baselines [duh-chang-rnn]{1}. GCN beat GBT on AUC but via a transductive trick unavailable at inference [tai-gcn]{2}. Transformers lost outright on small data [poirier-transformer]{3}. The implication: with the same engineered features (reach distances, hold roles/difficulties, angle), a GBT is a strong, low-risk, trivially-exportable baseline; deep models earn their keep only if (i) the dataset is large and (ii) they consume a richer structural representation (ordered moves or a move-graph) that trees cannot. The GBT comparison itself is owned by the classical-models sibling.

## Disconfirming analysis

Before asserting "sequence models are the frontier," I sought disconfirming evidence and found three checks worth recording:
- **The win may not be the network.** The naive-RNN result (~34.7%, tied with CNN) directly disconfirms the idea that recurrence per se helps; the lift is the BetaMove representation [duh-chang-rnn]{1}. This weakens any claim that Kilter should adopt LSTMs without first investing in the move-ordering representation.
- **A well-tuned CNN nearly matches the LSTM.** Petashvili & Rodda's 2D-CNN at 42%/84% ±1 [frontiers-grading-bias]{4} disconfirms a strong CNN-is-inadequate claim; the gap to GradeNet is modest and the CNN needs no preprocessing pipeline.
- **GNN superiority is metric- and setting-specific.** Tai et al.'s 0.73 AUC advantage is partly an artifact of balanced upsampling and the transductive Text-GCN setup; it does not establish that an *inductive, deployable* GNN would beat trees on Kilter [tai-gcn]{2}.

## Contradictions

- **Hold count.** The WebFetch extraction of the Frontiers review cites "198 standardized holds" [frontiers-grading-bias]{4}, whereas both primary Stanford papers state MoonBoard 2016 has "exactly 140 holds" [tai-gcn]{2} / 18×11 grid [duh-chang-rnn]{1}. Likely a different MoonBoard hold-set version, or a summarizer artifact; defer the authoritative board-geometry figure to the prior-work-datasets sibling.
- **"Sequence is the key" vs CNN parity.** The Frontiers review's headline conclusion that "sequence is the key" [frontiers-grading-bias]{4} sits in mild tension with its own report that a spatial 2D-CNN reached 84% ±1 [frontiers-grading-bias]{4}, nearly matching the sequence model. Both can be true (sequence wins on exact accuracy and hard grades; CNN is close on ±1), but the framing overstates the sequence advantage.

## Suggested cross-references to sibling subdomains

- **feature-engineering:** BetaMove-style move ordering and the 22-dim per-move embedding (reach vectors, hold-difficulty scales, foot placement) are the representation that powers the sequence model — and the node/edge features for an inductive GNN. Heavy overlap; coordinate ownership of the move-feasibility/ordering logic.
- **classical-models (GBT):** owns the head-to-head baseline. This brief assumes GBT on engineered features is the low-risk default; that family must confirm the actual Kilter numbers.
- **evaluation-methodology:** owns the ±1-grade-≈-human-parity metric, per-angle targets, class-imbalance weighting, and benchmark-route ground truth — all of which this brief leans on.
- **prior-work-datasets:** owns MoonBoard/Kilter dataset sizes, board geometry/hold counts (resolves the 140-vs-198 contradiction), and grade-scale normalization.
- **in-browser-inference:** owns ONNX.js/TF.js op-support matrices, quantization, and bundle-size budgets that determine which of CNN/GNN/RNN actually ships — this brief only flags relative export-friendliness (CNN > LSTM/attention-pool > transductive GCN).
