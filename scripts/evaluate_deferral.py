"""
SIH26162 — Evaluate Deferral Calibration & HITL Funnel
======================================================
5-fold stratified cross-validation sweep over the 1,080-sample dataset:
  - Sweeps margin_tau in [0.15, 0.20, 0.25, 0.30]
  - Evaluates coverage, auto-decided accuracy, and the error-concentration
    in the deferred subset (the money stat: "deferral catches errors").
  - Writes chosen calibration to model_metrics.json.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score
from sklearn.model_selection import StratifiedKFold

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.train_honest_ensemble import load_dataset, build_ensemble, TARGET_CLASSES


def main():
    print("=" * 70)
    print("DEFERRAL CALIBRATION SWEEP (5-Fold Stratified CV, N=1,080)")
    print("=" * 70)

    X, y = load_dataset()
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    # Collect per-test-sample predictions across folds
    y_true_all = []
    y_pred_all = []
    margin_all = []
    entropy_all = []
    agree_all = []
    submodel_conflict_all = []

    fold = 0
    for train_idx, test_idx in skf.split(X, y):
        fold += 1
        model = build_ensemble()
        model.fit(X[train_idx], y[train_idx])

        X_test = X[test_idx]
        probs = model.predict_proba(X_test)
        preds = model.predict(X_test)

        p_xgb = model.named_estimators_["xgb"].predict_proba(X_test)
        p_rf = model.named_estimators_["rf"].predict_proba(X_test)

        xgb_cls = np.argmax(p_xgb, axis=1)
        rf_cls = np.argmax(p_rf, axis=1)
        conflicts = (xgb_cls != rf_cls)

        l1 = np.abs(p_xgb - p_rf).sum(axis=1)
        agreements = 1.0 - l1 / 2.0

        # Margin: top1 - top2
        sorted_probs = np.sort(probs, axis=1)[:, ::-1]
        margins = sorted_probs[:, 0] - sorted_probs[:, 1]

        # Normalized entropy
        p_clipped = np.clip(probs, 1e-12, 1.0)
        entropies = -(p_clipped * np.log2(p_clipped)).sum(axis=1) / np.log2(probs.shape[1])

        y_true_all.extend(y[test_idx])
        y_pred_all.extend(preds)
        margin_all.extend(margins)
        entropy_all.extend(entropies)
        agree_all.extend(agreements)
        submodel_conflict_all.extend(conflicts)

    y_true = np.array(y_true_all)
    y_pred = np.array(y_pred_all)
    margins = np.array(margin_all)
    entropies = np.array(entropy_all)
    agrees = np.array(agree_all)
    conflicts = np.array(submodel_conflict_all)

    base_acc = accuracy_score(y_true, y_pred)
    print(f"\nBaseline (no deferral): {base_acc * 100:.2f}% accuracy on all {len(y_true)} samples\n")

    print(f"{'margin_tau':>10} | {'conflict':>9} | {'coverage':>9} | {'auto_acc':>9} | {'def_acc':>9} | {'err_captured':>13}")
    print("-" * 72)

    best_cfg = None
    best_auto_acc = 0.0

    for m_tau in (0.15, 0.20, 0.25, 0.30):
        for use_conflict in (True, False):
            # Defer condition
            defer = (margins < m_tau)
            if use_conflict:
                defer = defer | conflicts

            n_def = np.sum(defer)
            n_auto = len(y_true) - n_def
            cov = n_auto / len(y_true)

            auto_acc = accuracy_score(y_true[~defer], y_pred[~defer]) if n_auto > 0 else 0.0
            def_acc = accuracy_score(y_true[defer], y_pred[defer]) if n_def > 0 else 0.0

            # Errors captured = what % of total errors landed in the deferred bucket
            total_errs = np.sum(y_true != y_pred)
            captured = np.sum((y_true != y_pred) & defer)
            err_cap_pct = (captured / total_errs * 100) if total_errs > 0 else 0.0

            print(
                f"{m_tau:10.2f} | {str(use_conflict):>9} | "
                f"{cov * 100:8.1f}% | {auto_acc * 100:8.2f}% | "
                f"{def_acc * 100:8.2f}% | {err_cap_pct:12.1f}%"
            )

            if cov >= 0.85 and auto_acc > best_auto_acc:
                best_auto_acc = auto_acc
                best_cfg = {
                    "margin_tau": float(m_tau),
                    "use_submodel_conflict": bool(use_conflict),
                    "coverage_pct": round(float(cov * 100), 2),
                    "auto_decided_accuracy_pct": round(float(auto_acc * 100), 2),
                    "deferred_subset_accuracy_pct": round(float(def_acc * 100), 2),
                    "error_capture_pct": round(float(err_cap_pct), 2),
                    "deferred_samples_count": int(n_def),
                    "auto_decided_samples_count": int(n_auto),
                }

    print("\n" + "=" * 72)
    print("CHOSEN CALIBRATION:", best_cfg)

    # Save calibration to model_metrics.json
    metrics_path = ROOT / "packages" / "agents" / "models" / "model_metrics.json"
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    metrics["deferral_calibration"] = best_cfg
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Updated {metrics_path} with deferral calibration.")


if __name__ == "__main__":
    main()
