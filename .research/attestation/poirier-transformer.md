---
source_handle: poirier-transformer
fetched: 2026-06-13
source_url: https://arxiv.org/abs/2503.00458
provenance: source-direct
---

# Using Machine Learning for move sequence visualization and generation in climbing (2025)

arXiv:2503.00458 (HTML version v1). Fetched via WebFetch. Applies Transformer models to climbing move sequences.

## Summary

Investigates three Transformer architectures for predicting climbing **move order** (sorting an unordered set of holds into climbing sequence) from MoonBoard data. Functions as a cautionary data-point: on a tiny dataset, all three transformer variants underperformed, with degenerate failure modes. Directly relevant to the sequence-model facet and to the data-hunger of attention models.

## Key verbatim / reported passages (WebFetch-mediated)

- Three architectures: (1) "Seq2seq Model: Encoder-decoder with 512-dimensional latent space and attention mechanism"; (2) "Autoregressive Transformer with Positional Embedding: Sequence completion model using custom coordinate-based embeddings"; (3) "Simplified Transformer: Direct forward pass without positional embedding or masking."

- Token representation: holds as discrete tokens — "the input tokens are simply the numbers [0,N−1]"; coordinates become embedded information rather than token identifiers.

- Autoregressive masking: uses "an Attention Mask [to] specify which part of the input should be used at inference."

- Dataset is tiny: "20 Moonboard videos with manually extracted holds sequences, augmented to 1000 sequences through random permutations."

- Failure modes: Seq2seq "most of the predicted positions are not even holds"; autoregressive "the model almost always outputs the padding token"; simplified transformer "only ~35% accuracy on validation sequences."

- Self-assessment: "the results are not conclusive."

NOTE: WebFetch quotes are summarizer-mediated. The task is move-ORDER prediction (a sequencing sub-task), not direct grade regression; relevance is to representation/data-requirement claims, not grade accuracy. Author/title attribution ("Poirier" handle) is provisional — confirm against the arXiv listing before formal citation.
