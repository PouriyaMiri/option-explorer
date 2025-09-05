# utils.py
import pandas as pd
import numpy as np

class Utils:
    @staticmethod
    def _resolve_col(df: pd.DataFrame, key: str):
        """
        Return the actual DataFrame column name matching 'key' (case-insensitive).
        Supports a few common aliases.
        """
        if key in df.columns:
            return key
        lk = str(key).lower()

        lower_map = {c.lower(): c for c in df.columns}

        # direct lower-case match
        if lk in lower_map:
            return lower_map[lk]

        # simple aliases
        aliases = {
            'acc': 'accuracy',
            'prec': 'precision',
            'rec': 'recall',
            'f1': 'f1_score',
            'time': 'training_time',
        }
        aliased = aliases.get(lk)
        if aliased and aliased.lower() in lower_map:
            return lower_map[aliased.lower()]

        return None  # not found

    @staticmethod
    def filter_dataFrame(data_frame: pd.DataFrame, constraints: dict) -> pd.DataFrame:
        """
        Apply constraints to a DataFrame and return the filtered result.

        Constraint formats supported:
          - scalar (e.g., "GPU" or 32): equality match after stringification
          - [low, high]: numeric range. Use None for open ends, e.g., [0.8, None] or [None, 10]
                          If both ends provided and equal ([v, v]) but column is non-numeric,
                          this is treated as scalar equality on the string form 'v'.
          - list/tuple (len != 2): categorical membership (row kept if value is in set)

        Notes
        -----
        • Column names are matched case-insensitively.
        • Numeric comparisons are attempted when the column can be coerced to numbers
          (via pandas to_numeric with errors='coerce').
        • Non-numeric columns with a [v, v] constraint fall back to equality on strings.
        """
        df = data_frame.copy()

        for raw_col, cond in (constraints or {}).items():
            col = Utils._resolve_col(df, raw_col)
            if not col:
                # Unknown column → skip this constraint gracefully
                continue

            s = df[col]

            # ---------- Range-like [low, high] ----------
            if isinstance(cond, (list, tuple)) and len(cond) == 2:
                low, high = cond

                # Try numeric compare when possible
                sn = pd.to_numeric(s, errors="coerce")
                numericish = sn.notna().any()

                if numericish:
                    mask = pd.Series(True, index=df.index)
                    if low is not None:
                        try:
                            mask &= sn >= float(low)
                        except (TypeError, ValueError):
                            pass
                    if high is not None:
                        try:
                            mask &= sn <= float(high)
                        except (TypeError, ValueError):
                            pass
                    df = df[mask]
                    continue

                # Non-numeric equality encoded as [v, v]
                if low is not None and high is not None and str(low) == str(high):
                    df = df[s.astype(str) == str(low)]
                    continue

                # Otherwise, skip silently (cannot apply)
                continue

            # ---------- List/tuple of categories (not a 2-range) ----------
            if isinstance(cond, (list, tuple)):
                wanted = set(str(x) for x in cond)
                df = df[s.astype(str).isin(wanted)]
                continue

            # ---------- Scalar equality ----------
            df = df[s.astype(str) == str(cond)]

        return df


def normalize_numeric(s: pd.Series, higher_is_better: bool) -> pd.Series:
    """
    Normalize a numeric series into [0, 1].
      • If all values NaN → zeros.
      • If all values equal (after coercion) → ones (so a weighted feature still contributes).
      • If higher_is_better is False, the scale is inverted.
    """
    s_num = pd.to_numeric(s, errors='coerce')
    if s_num.isna().all():
        return pd.Series(np.zeros(len(s_num)), index=s_num.index)

    mn = np.nanmin(s_num.values)
    mx = np.nanmax(s_num.values)
    if mx == mn:
        # Flat series – give neutral ones so weight contributes uniformly
        out = pd.Series(np.ones(len(s_num)), index=s_num.index)
        return out if higher_is_better else (1.0 - out)

    base = (s_num - mn) / (mx - mn)
    return base if higher_is_better else (1.0 - base)
