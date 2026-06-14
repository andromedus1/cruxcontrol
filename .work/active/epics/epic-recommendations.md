---
id: epic-recommendations
kind: epic
stage: drafting
tags: [ml]
parent: null
depends_on: [epic-grade-prediction, epic-logbook]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Personalized Training & Recommendations

## Brief

The personalization capability layered on top of the grade model and the user's
logbook: recommend climbs by grade range / preferred style / progression, generate
circuits (a session of N climbs at target grades), detect weaknesses (which hold
types/positions the user struggles with), and suggest progressive-overload climbs
(slightly harder versions of sent routes).

When done, the app can build a tailored session and surface a personalized queue driven
by the user's history and the predicted-grade signal. It depends on epic-grade-prediction
(predicted grades + features) and epic-logbook (the user's send/attempt history).

## Research briefs

- Consumes the grade model from epic-grade-prediction and the history from epic-logbook.
- **[brief written]** [recommendations-and-training.md](../../../docs/briefs/recommendations-and-training.md)
  — *Recommendation & climbing-training methodology.* Two threads to
  curate: (1) recommendation-system techniques appropriate for a single-user,
  content-feature setting (no large user base — content-based / similarity over hold
  features and predicted grade, not collaborative filtering); (2) climbing
  training-science fundamentals — progressive overload, circuit design, and what
  "weakness by hold type/position" means in practice. Run `/research-pipeline:brief`
  before `/epic-design`. Consider escalating to `/deep-research` if the training-science
  thread proves as open as the grade-model space.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §8 (ML Pipeline, recommendation features).
- `docs/SPEC.md` — Capability 7 (Personalized Training & Recommendations).

## Anticipated child features

Provisional:
- Recommendation engine (grade range + style + progression)
- Circuit generation (N climbs at target grades)
- Weakness detection (hold-type/position analysis over logbook)
- Progressive-overload suggestions
