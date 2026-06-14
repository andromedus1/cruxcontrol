---
source_handle: frontiers-grading-bias
fetched: 2026-06-13
source_url: https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1512010/full
provenance: source-direct
---

# Addressing grading bias in rock climbing: machine and deep learning approaches (Frontiers in Sports and Active Living, 2024)

Survey/study of ML approaches to climbing route difficulty, with a route-centric vs climber-centric taxonomy. Directly relevant to evaluation methodology, metrics, target-variable choice, and filtering.

## Verbatim key passages

- Within-grade tolerance / human parity: "46.7% was an improvement from the CNN, but GradeNet was only classifying across ten different grades" (Section 7.1). When "allowed to have an error of grade, the classification improved to 84.7%, which was on par with human prediction accuracy" (Section 7.1).
- Petashvili and Rodda 2DCNN: "42.0% accuracy across 12 grades, and it reached 84.0% accuracy when grade is permitted" (Section 7.1).
- Target-variable filtering for consensus: "selection of routes should be limited to those whose difficulty has been determined by the community" (Section 7.1); inaccurately graded routes "should be removed" (Section 7.1).
- Benchmark routes as ground truth: researchers "can utilize the 'benchmark' routes provided by MoonBoard. These benchmark routes are used as ground truth ... because they are uploaded by route setting professionals" (Section 7.1).
- Class imbalance: "a large class imbalance in the MoonBoard dataset, as it is skewed toward easier routes" (Section 7.1); CNN methods generalized better to this distribution than traditional models.
- Climber-centric RMSE: Andric et al. "0.381" for indoor route prediction (Section 7.2, Table 3).
- Defining good: "84.7%" accuracy represents parity "with human prediction accuracy" (Section 7.1).

## Summary

The paper establishes that (a) accuracy-within-±1-grade (~84-85%) is the practical bar where models reach human parity, while exact-grade accuracy across 10-12 classes sits ~40-47%; (b) target variable should be community-consensus difficulty, filtering out routes without sufficient community grading; (c) benchmark routes (professional-set) serve as a cleaner ground truth alternative; (d) the dataset is class-imbalanced toward easy grades, which distorts accuracy and must be accounted for.
