---
description: Read before designing epic-recommendations — content-based recsys for a single user + climbing-training methodology for circuits, weakness, and progression
type: brief
kind: research
slug: recommendations-and-training
research_method: /brief
verification_status: attested
provenance: agent-synthesis
updated: 2026-06-13
nav_priority: high
blocks_phase: epic-recommendations
summary: |
  Two threads for epic-recommendations: (1) the recsys approach — content-based
  filtering (item features + predicted grade), which by design needs no other users'
  data and fits a single-user app; collaborative filtering is the wrong tool here.
  (2) the training-science framing — progressive overload requires intensity +
  frequency + deliberate progression, and climbing's variability undermines that;
  a board + grade model is precisely a "reduced-variability" progression tool, which
  is what makes targeted recommendations and circuits worth building.
key_findings:
  - "Content-based filtering recommends by item features and needs NO data about other users — the right fit for a single-user app."
  - "Collaborative filtering is the wrong tool here: no user base to draw cross-user signal from."
  - "Recommendation features come free from the catalog + grade model: predicted grade, hold features, angle, style; the logbook supplies the 'liked' set."
  - "Progressive overload needs intensity + frequency + deliberate progression; climbing variability means 'no single movement pattern receives consistent progressive overload'."
  - "A board + grade model is a structured 'reduced-variability' progression tool — the training rationale for circuits, progressive-overload suggestions, and weakness targeting."
status: draft
---

# Brief: Recommendations & Training Methodology

## Purpose

Unblocks **epic-recommendations** (`[needs-brief]`). It curates two domains the
feature spans: the **recommendation technique** appropriate for a single-user app,
and the **climbing-training methodology** that gives circuits, weakness detection,
and progressive-overload suggestions their meaning. It consumes the grade model
(epic-grade-prediction) and the user's history (epic-logbook).

---

## 1. Recommendation approach: content-based, not collaborative

CruxControl has **one user per client** and no shared backend (VISION). That single
fact decides the technique.

- **Content-based filtering** "uses item features to recommend other items similar
  to what the user likes, based on their previous actions or explicit feedback"
  `[google-content-based-filtering]{1}`, and critically "the recommendations are
  specific to this user, as the model did not use any information about other users"
  `[google-content-based-filtering]{1}`. That is exactly our setting.
- **Collaborative filtering is the wrong tool** — it depends on cross-user
  interaction data we don't have (no user base, no server).

**Mechanics:** represent each climb as a feature vector (predicted grade from
epic-grade-prediction; hold features; angle; style/tags) and the user as a profile
derived from their logbook "liked" set (sends, high quality ratings). Score
candidates by similarity — e.g. dot product, where "a high dot product … indicates
more common features, thus a higher similarity" `[google-content-based-filtering]{1}`
— and surface the top matches at the desired difficulty.

The grade model is the key enabler: it lets us recommend at a *target predicted
grade* (including unclimbed/freshly-set routes with no community grade), which the
official app cannot do.

## 2. Training methodology (why these features matter)

The features in SPEC Capability 7 map onto real training principles:

- **Progressive overload** requires "repeated, high mechanical tension that exceeds
  prior exposure" with sufficient intensity, frequency, and progression over time
  `[maxclimbing-overload]{1}`. → *Progressive-overload suggestions*: recommend climbs
  a notch above recently-sent ones (predicted grade + similar style), so load
  increases deliberately rather than randomly.
- **Variability is the enemy of systematic progress:** "No single movement pattern
  receives consistent progressive overload" `[maxclimbing-overload]{1}`, and "effort
  may be maximal" while "stimulus may not be" `[maxclimbing-overload]{1}`. → A board
  + grade model is a structured, "reduced-variability" progression tool (the article
  endorses "reduced variability blocks" `[maxclimbing-overload]{1}` as a remedy).
  *This is the training rationale for the whole epic.*
- **Circuits** (auto-build N climbs at target grades) operationalize a
  reduced-variability block: a curated, difficulty-controlled session.
- **Weakness detection** ("what makes you complete the move may prevent you from
  strengthening the limiter" `[maxclimbing-overload]{1}`): analyze the logbook for
  hold-type/position patterns the user fails or avoids, then bias recommendations
  toward those — surfacing the limiter the body self-optimizes around.

> Scope note: this brief covers *selecting climbs* for training, not prescribing
> off-the-wall strength programs (the source's other remedy). Keep the feature
> in-app: recommend board climbs, don't generate gym workouts.

---

## Implementation Notes

- **Build on grade-prediction + logbook.** This epic adds no new data source — it's
  a scoring layer over the climb feature vectors (incl. predicted grade) and the
  logbook-derived user profile. Depends on both epics for real signal.
- **Content-based scorer.** Feature vector per climb (predicted grade, hold features,
  angle, style); user profile vector from liked climbs; rank by similarity. Start
  simple (weighted similarity), not a learned model.
- **Circuit generation = constrained selection.** Pick N climbs near a target grade
  with variety/coverage constraints; expose target grade + size as inputs (SPEC).
- **Weakness detection = logbook analytics.** Aggregate failures/avoidance by hold
  type/region; feed as a bias term into the scorer; surface as insight.
- **Cold start.** With an empty logbook, fall back to grade-range + angle filters
  (no profile yet) — degrade gracefully to the browser's filtering.
- **Cross-reference:** [foundation-pwa-sqlite.md](foundation-pwa-sqlite.md) (local
  data), and the forthcoming grade-prediction research (predicted-grade feature).

---

## Sources

1. Google for Developers — *Content-based filtering*. `[google-content-based-filtering]{1}` — https://developers.google.com/machine-learning/recommendation/content-based/basics
2. Max Climbing — *Progressive Overload in a Variability Sport*. `[maxclimbing-overload]{1}` — https://www.maxclimbing.com/blogs/knowledge-hub-the-frontier/becoming-a-better-climber-progressive-overload-in-a-variability-sport
