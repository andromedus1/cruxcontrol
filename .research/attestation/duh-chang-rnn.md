---
source_handle: duh-chang-rnn
fetched: 2026-06-13
source_url: https://arxiv.org/abs/2102.01788
provenance: source-direct
---

# Duh & Chang (2021) — Recurrent Neural Network for MoonBoard Climbing Route Classification and Generation

Stanford CS230 project / arXiv:2102.01788. Authors Yi-Shiou Duh, Ray Chang. Full PDF text extracted via pypdf.

## Summary

Argues MoonBoard grade prediction is more an NLP/sequence problem than a computer-vision problem because (1) the {0,1}^(18×11) lit-hold matrix used by CNNs is "too sparse" and (2) climbers follow a physically reasonable sequence from start to goal, which a sequential model best represents. They introduce **BetaMove**, a preprocessing pipeline that converts a MoonBoard problem (set of lit holds) into an ordered human-like hand-move sequence via beam search (beam size 8), tuned to expert hand sequences. They then train **GradeNet** (LSTM-based grade predictor) and **DeepRouteSet** (LSTM route generator) on the BetaMove sequences.

## Key verbatim passages

- "MoonBoard problems are more similar to an natural language processing (NLP) problem than a computer vision problem due to two major reasons: 1)With graphic representation, the {0, 1}18×11 matrix used in CNN is too sparse and 2)Climbers follow a physically reasonable sequence to climb up, from the start hold to the goal, and a sequential model would best represent that process."

- BetaMove validation: "The prediction of BetaMove exactly matched the move sequences predicted by a climbing expert in 95% of the test problems (19/20)."

- GradeNet input embedding: "each move is embedded into a 22-dimensional vector ... This vector includes the target hold's position (x4, y4), the relative distance to the previous 2 holds (v34x, v34y, v24x, v24y), the difficulty scales of all three holds (f2, f3, f4), the placement of feet, and the estimated success scores of each move."

- GradeNet architecture (two-stage): "In the first stage, the embedded input sequences pass through the LSTM layer, followed by 6 dense layers. The output sequence of the 6th dense layer is combined and flattened for the first grade prediction. In the second stage, the output of the 6th dense layer was fed into another two LSTM, followed by 2 dense layers for another grade prediction. The final loss function was the sum of the two categorical cross entropy."

- "Batch normalization, dropout, L2 regularization, max pooling, and average pooling were all tested, but none of them shows significant improvement."

- Dataset: "We scraped 30634 MoonBoard problems ... The remaining 25096 problems were divided into training, dev, and test set, with 20157, 2442, and 2497 problems, respectively." Grades unified to Hueco V4–V14, V14 excluded, problems without repeats removed.

- Results (Table 2): GradeNet test-set exact-match accuracy 46.7%, ±1 accuracy 84.7%, F1 0.255, AUC 0.773. Training set: 64.3% / 91.3% / 0.506 / 0.898. Dev: 47.5% / 84.8%. Human-level performance (HLP) estimated at 45.0% exact, 87.5% ±1. Naive RNN (raw hold list, no BetaMove) dev accuracy 34.7%.

- Comparison: prior CNN [Dobles] 34.0% accuracy; GCN [Tai] AUC 0.73; MLP [Houghton] 35.6%. "GradeNet not only outperformed other classifiers including CNN[1], MLP[3], Graphical neural network[2], but also reached human-level performance. GradeNet also surpassed a naive RNN ... This indicates that the improvement primarily comes from the injection of human insight through the BetaMove-preprocessed move sequence."

- Crux-move limitation: "For problems harder than V8, however, our model underestimated their grade. This is probably because in those difficult problems, there are only 1 or 2 crux moves while most other moves are around V8. For instance, a V11 problem may only have one V11 crux move. We therefore expect an attention model can better tackle this challenge."

- Training: 200 epochs; class weights adjusted at epoch 100 to combat skewed (easy-heavy) grade distribution.

GitHub: https://github.com/jrchang612/MoonBoardRNN
