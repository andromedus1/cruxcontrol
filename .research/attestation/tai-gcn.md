---
source_handle: tai-gcn
fetched: 2026-06-13
source_url: http://cs230.stanford.edu/projects_winter_2020/reports/32175834.pdf
provenance: source-direct
---

# Tai, Wu & Hinojosa (2020) — Graph Neural Networks in Classifying Rock Climbing Difficulties

Stanford CS230 Winter 2020 project. Authors Cheng-Hao Tai, Aaron Wu, Rafael Hinojosa. Full PDF text extracted via pypdf.

## Summary

Pioneers graph convolutional networks (GCN) for MoonBoard difficulty classification. Crucially, this is **not** a move-graph (holds-as-nodes-with-move-edges). It adapts the **Text-GCN** framework (Yao et al. 2018) for document classification: a *heterogeneous* graph of **problem nodes and hold nodes** where holds play the role of "words" and problems play the role of "documents." Edges encode hold-hold co-occurrence (PMI) and problem-hold membership (IDF). Best model: 0.73 average AUC across 11 difficulty classes; notably robust to class imbalance and best at the hard (rare) grades.

## Key verbatim passages

- "we pioneer the application of graph convolutonal networks in predicting difficulty classes of rock climbing routes on the MoonBoard training apparatus. We build a hetergenous graph of problem / hold nodes and benchmark a PyTorch implementation of the GCN against classic statistical learning algorithms along with fully-connected feed-forward networks. Our best model achieves a 0.73 average AUC across all difficulty classes, validates GCNs' relative immunity against class imbalance, and demonstrates a surprising insight into the optimal number of graph convolutions."

- NLP analogy: "just as words constitute sentences, rock climbing problems are composed of holds ... In our MoonBoard application, an equivalence can be established between documents and problems — words and holds."

- Adjacency matrix definition (heterogeneous): "Aij = PMI(i,j) if i,j holds; IDF(j) if i problem j hold; 1 if i=j; 0 otherwise." PMI computed over sliding windows. Two window definitions tested: (1) whole-problem scope (PMI), (2) a 5×5 filter "approximately half-armspan of an average climber" sliding over the wall canvas (Win-PMI, inspired by CNN filters).

- Dataset: MoonBoard 2016, "exactly 140 holds." 13,589 problems, V4–V14 (11 classes), highly imbalanced (V4–V5 >50%, V11–V14 ~1%). Balanced sampling: upsampled 2,000 per class; train 14,080 / dev 3,520 / test 4,400. Features: one-hot or multi-hot 140-dim vector (presence/absence of each hold).

- GCN forward pass (2-layer): "Z = softmax(Ã ReLU(Ã X W0) W1)" with masked cross-entropy over labeled problem nodes only.

- Results: GCN with multi-hot features beat all baselines (Logistic Regression AUC 0.70, SVM 0.66, Random Forest 0.67, Gradient Boosting 0.62, MLP 0.66, Dense nets ~0.65–0.67) on average AUC. Best GCNs reached AUC 0.73. "GCN models using multi-hot features outperform baseline models and PyTorch Dense implementations across the board on averaged AUC."

- Edge-weight insensitivity: "using either PMI, Binary, or Win-PMI all seem to yield approximately equivalent results. This suggests that the connections amongst nodes themselves are more important than the weights of these edges."

- Depth finding: "the only GCN model featuring four convolutional steps yielded the best averaged F1 and AUC scores — a surprising finding since the authors of [9] reported negligible performance gains after two GCN layers ... suggests that the optimal number of graph convolutions is highly domain-dependent."

- Class-imbalance robustness: "it is really in the higher-difficulty classes where the 4-step GCN outperforms logistic regression ... GCNs are far less susceptible to class imbalance than the classic machine learning algorithms or even fully-connected feed-forward networks."

GitHub: https://github.com/gestalt-howard/moonGen
