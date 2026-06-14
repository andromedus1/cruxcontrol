---
source_handle: ordinal-regression-wikipedia
fetched: 2026-06-13
source_url: https://en.wikipedia.org/wiki/Ordinal_regression
provenance: source-direct
---

# Ordinal regression (overview; corroborated by arXiv:0704.1028 "A neural network approach to ordinal regression")

## Key attestations

- Ordinal regression "has properties of both classification and metric regression"; it is an intermediate problem between regression and classification.
- "The learning task of ordinal regression is to assign data points into a set of finite ordered categories." The response is discrete and finite (unlike metric regression) but ordered (unlike plain classification).
- Failure mode of plain classification on ordered labels: a standard classifier "will assume that the error of misclassifying an A as a D is just as bad as misclassifying A as a B" — false when categories are ordered, because A-to-D is a larger error than A-to-B.
- "typical ordinal regression algorithms have potential to outperform classification or regression approaches, when the range of the dependent variable is finite and ordered."
- Practitioners frequently treat ordinal problems as classification or regression (noted re: Kaggle Diabetic Retinopathy 2015).

## Relevance

Kilter grades (V-scale / Font) are finite ordered categories — the canonical ordinal-regression target. Three framings available: (a) plain regression on numeric grade index, (b) multiclass classification, (c) ordinal-aware methods. Regression captures order cheaply; ordinal methods penalize distance correctly without assuming equal grade spacing.
