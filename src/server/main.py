# src/server/main.py
import argparse
import json
import os
import time
import pandas as pd
import numpy as np
import csv

from graph_world import GraphWorld
from policy_iteration import PolicyIteration
from initial_transition_generator import generate_initial_transition_model
from utils import Utils, normalize_numeric  # filter, col resolution, numeric normalization


# Columns where larger is better
UP_BETTER = {
    "accuracy", "precision", "recall", "f1_score",
    "epochs", "RAM", "batch_size", "pool_size", "kernel_size",
    "layers", "nodes"
}
# Columns where smaller is better
DOWN_BETTER = {"loss", "training_time"}


def parse_args():
    p = argparse.ArgumentParser(description="Compute ranked list from constraints + rewards")
    p.add_argument("--constraints-json", required=True, help="Path to JSON with constraints_map + reward_values")
    p.add_argument("--dataset", required=True, help="Path to dataset CSV")
    p.add_argument("--probability", default=None, help="Optional path to transition/probability CSV to write")
    p.add_argument("--output", required=True, help="Where to save ranked list CSV")
    p.add_argument("--json-output", required=True, help="Where to save ranked list JSON")
    p.add_argument("--topk", type=int, default=0, help="Optional: keep only top-K rows (0 = keep all)")
    p.add_argument(
        "--arch-cols",
        nargs="+",
        default=["domain", "algorithm", "model"],
        help="Columns used as model architecture keys for transition generation",
    )
    return p.parse_args()


def load_constraints(path_json):
    """Load constraints and convert reward_values to numeric weights.

    Accepts both:
      - {"accuracy": 3, "precision": 2}
      - {"accuracy": [0, 3], "precision": [0, 2]}
    """
    with open(path_json, "r", encoding="utf-8") as f:
        payload = json.load(f)

    constraints_map = payload.get("constraints_map", {}) or {}
    raw = payload.get("reward_values", {}) or {}

    weights = {}
    for k, v in raw.items():
        # accept 3 OR [0,3] OR [3] OR "3"
        if isinstance(v, (list, tuple)):
            v = v[-1] if len(v) else 0
        try:
            weights[k] = float(v)
        except (TypeError, ValueError):
            # ignore bad entries
            pass

    return constraints_map, weights


def compute_weighted_utility(df: pd.DataFrame, weights: dict, constraints_map: dict) -> pd.Series:
    """
    - Numeric columns: min-max normalized (↑ for UP_BETTER, ↓ for DOWN_BETTER).
    - Categorical: if a constraint selected a value for that column, rows matching get 1 else 0.
      If no chosen value exists (after filtering), contribute neutral 1s.
    """
    if df.empty:
        return pd.Series([], dtype=float)

    total = pd.Series(np.zeros(len(df)), index=df.index, dtype=float)

    for raw_col, w in weights.items():
        # Prefer exact column, fall back to Utils._resolve_col (case-insensitive + aliases)
        col = raw_col if raw_col in df.columns else Utils._resolve_col(df, raw_col)
        if not col:
            continue

        numeric = pd.to_numeric(df[col], errors="coerce")
        if numeric.notna().sum() > 0:
            # decide direction
            cname = col if col in UP_BETTER or col in DOWN_BETTER else col.lower()
            higher = (cname in UP_BETTER) or (cname not in DOWN_BETTER)
            norm = normalize_numeric(df[col], higher_is_better=higher)
            total = total.add(w * norm, fill_value=0.0)
        else:
            # categorical: reward match against chosen constraint value if present
            chosen = constraints_map.get(col, None)
            if chosen is None:
                contrib = pd.Series(np.ones(len(df)), index=df.index)  # neutral
            else:
                contrib = (df[col].astype(str) == str(chosen)).astype(float)
            total = total.add(w * contrib, fill_value=0.0)

    return total


def main():
    args = parse_args()
    t0 = time.time()

    # 1) Load inputs
    constraints_map, weights = load_constraints(args.constraints_json)

    # 2) Load dataset
    if not os.path.exists(args.dataset):
        raise FileNotFoundError(f"Dataset not found: {args.dataset}")
    df = pd.read_csv(args.dataset)

    # 3) Apply HARD constraints (no synthetic generation)
    df_filtered = Utils.filter_dataFrame(df, constraints_map)

    # ensure output dirs
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(os.path.dirname(args.json_output), exist_ok=True)

    # Early exit: no rows
    if df_filtered.empty:
        pd.DataFrame().to_csv(args.output, index=False)
        print("[main.py] Filter removed all rows; wrote empty ranked list.")
        return

    # 4) Optional: produce/refresh transition model artifact if a path was provided
    if args.probability:
        try:
            os.makedirs(os.path.dirname(args.probability), exist_ok=True)
            generate_initial_transition_model(
                df_filtered,
                df_filtered,
                modelArchitecture=args.arch_cols,
                file_name=args.probability,
            )
        except Exception as e:
            print(f"[main.py] Transition artifact step skipped: {e}")

    # 5) Compute weighted utility (3/2/1) robustly for mixed types
    df_scores = df_filtered.copy()
    df_scores["utility_value"] = compute_weighted_utility(df_scores, weights, constraints_map)

    # 6) Optional: run MDP to keep artifacts compatible (safe no-op for ranking)
    try:
        if args.probability and os.path.exists(args.probability):
            gw = GraphWorld(df_filtered, args.probability, {}, {})
            solver = PolicyIteration(
                gw.reward_function,
                gw.transition_model,
                gamma=0.9,
                theta=0.005,
                # max_iters left as default in the class
            )
            gw.set_utility_values(solver.get_utility_values())
    except Exception as e:
        print(f"[main.py] Graph/MDP step skipped due to: {e}")

    # 7) Sort and truncate
    ranked = df_scores.sort_values(by="utility_value", ascending=False).reset_index(drop=True)
    if args.topk and args.topk > 0:
        ranked = ranked.head(args.topk)

    # 8) Save CSV AND JSON (server reads JSON; CSV is for download/inspection)
    ranked.to_csv(args.output, index=False)
    

    dt = time.time() - t0
    print(
        f"[main.py] Ranked list saved to: {args.output} & {args.json_output}  "
        f"(rows={len(ranked)})  in {dt:.2f}s"
    )


if __name__ == "__main__":
    main()
