---
source_handle: frontiers-climbing-grading-bias
fetched: 2026-06-13
source_url: https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1512010/full
provenance: source-direct
---

# Addressing grading bias in rock climbing: machine and deep learning approaches (Frontiers in Sports and Active Living, 2024)

Survey of ML/DL approaches to climbing grade prediction, organized around the "Grading Bias Problem": the setter introduces personal bias when declaring a route's difficulty. Mitigation: use community-voted grades, restrict to routes whose difficulty has been determined by the community.

## Classical / tree-based models surveyed (key verbatim attestations)

- Andric et al.: "Random Forest regression model" to predict perceived difficulty of indoor routes; "9.5% better than the baseline recommender system"; features = "Static and time variant official and climber-rated route grades on the Vertical Life app"; granularity 32 Font Scale grades; RMSE 0.378 (indoor routes).
- Dobles, Sarmiento, Satterthwaite: tested Naive Bayes and Softmax Regression, outperformed by an ordinal-regression CNN at 34.0% accuracy across 13 grades on MoonBoard image data.
- Bayesian Network Estimator (route-centric): features = "number of holds, distance between holds, types of holds, and incut sizes"; 71.0% accuracy across 3 Fontainebleau grades (limited difficulty range).
- Probabilistic HGBC (Histogram Gradient Boosting Classifier): "91.75%" classification accuracy across 21 Fontainebleau grades.

## Deep-learning comparisons (context)

- GradeNet (RNN-LSTM): "84.7%" accuracy when allowed a one-grade deviation, across 10 V-Scale grades; matches human baseline ~84.7%.
- Survey conclusion: "Sequence is the key. Route-centric, NLP and probabilistic methods were the most successful."

## Exact-accuracy regime (from companion search snippet, same literature)

Exact single-grade accuracy across models clusters ~35-47% (e.g., 46.5% ordinal-regression classifier vs ~45% human; CNN ~35-42% top-1); accuracy rises to ~84% with ±1-grade tolerance. Best MoonBoard regression-style result reported around 0.86 MAE / 1.12 RMSE.
