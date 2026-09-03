# @sih26162/agents — Multi-Agent Swarm

LangGraph 1.2 powered multi-agent DAG for thermal anomaly detection and classification.

## Agents

| ID | Agent | Role | Tools |
|---|---|---|---|
| 1 | **Orchestrator** | Meta-agent, Bayesian fusion | LangGraph 1.2 state machine |
| 2 | **Spatial** | PostGIS H3 + OSM containment | `h3`, `asyncpg`, `ogr2ogr` |
| 3 | **Temporal** | RisingWave 2.x rolling baseline | `httpx`, `numpy` |
| 4 | **Vision** | Sentinel-2 SWIR EfficientNet-B0 | `ONNX Runtime`, `Triton` |
| 5 | **Dispersion** | ERA5 wind + Gaussian puff | `xarray`, `scipy` |
| 6 | **Dispatcher** | 4-tier alert gating | `httpx`, `fastapi` |

## State Graph

```
hotspot_input
    │
    ├──→ spatial_pipeline ──┐
    ├──→ temporal_pipeline ─┼──→ orchestrator_node (Bayesian fusion) → final_classification
    └──→ vision_pipeline ───┘
```

## Test

```bash
cd packages/agents
python -m tests.test_swarm
```
