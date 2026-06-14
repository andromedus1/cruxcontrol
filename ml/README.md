# CruxControl — ML pipeline

Offline (Python) ML training pipeline for **grade prediction**. Standalone Python project
(not part of the npm workspace). Trains a model from the Kilter catalog and exports artifacts
to `/web/public` for in-browser inference (ONNX Runtime Web).

**Status: placeholder.** The pipeline is implemented under `epic-grade-prediction`. The
recommended approach (engineered geometric/move features → gradient-boosted-tree regressor on
per-angle `difficulty_average`, leakage-safe GroupKFold on `climb_uuid`, GBT→ONNX export) is
specified in [`../.research/briefs/kilter-grade-prediction/parent.md`](../.research/briefs/kilter-grade-prediction/parent.md).

## Planned

```bash
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -e .          # once dependencies are added
```
