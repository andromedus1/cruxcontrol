---
source_handle: google-content-based-filtering
fetched: 2026-06-13
source_url: https://developers.google.com/machine-learning/recommendation/content-based/basics
provenance: source-direct
---

# Google for Developers — Content-based filtering

## Summary

Reference explainer for content-based recommendation. It uses item features to
recommend items similar to what a user has liked (via past actions or explicit
feedback) and, crucially, requires no data about other users — recommendations are
specific to the one user. Items and users are encoded as feature vectors in a shared
space; similarity is scored (e.g. dot product, where shared features raise the
score) and the highest-scoring candidates are recommended. This makes it well-suited
to a single-user app with rich item features and no large user base.

## Key passages

- "Content-based filtering uses item features to recommend other items similar to what the user likes, based on their previous actions or explicit feedback."
- "The recommendations are specific to this user, as the model did not use any information about other users."
- Similarity: for binary vectors "a feature appearing in both x and y contributes a 1 to the sum," so "a high dot product then indicates more common features, thus a higher similarity."
