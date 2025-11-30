import numpy as np
import pandas as pd 


def generate_initial_transition_model(
    data: pd.DataFrame,
    selected_df: pd.DataFrame,
    modelArchitecture: list,
    file_name: str = "data/graph_world00.csv",
):
    """
    Build an initial transition model over the categorical levels given in
    ``modelArchitecture``.

    Each level in ``modelArchitecture`` contributes a set of states (its unique
    values). For every adjacent pair of levels (L, L+1), we estimate
    P(child | parent) from the full dataset ``data`` and adaptively
    upweight counts coming from ``selected_df``.

    The adaptation factor alpha is:
        alpha = len(selected_df) / len(data)  (if data is non-empty)
    so that:
        - when selected_df is small, its influence is modest,
        - when selected_df ~= data, its counts are weighted roughly equally.

    For any state i with no outgoing transitions (zero row), we set:
        P(i, i) = 1.0
    making it an absorbing state.
    """

    # --- 1. enumerate states per level and assign global indices ---
    data_array = []          # list of lists, per-level unique values
    state_pos_dic = {}       # maps state label -> global index
    pos = 0
    for item in modelArchitecture:
        children = list(data[item].value_counts().index)
        # deterministic ordering
        children.sort(key=str.lower)
        for child in children:
            if child not in state_pos_dic:
                state_pos_dic[child] = pos
                pos += 1
        data_array.append(children)

    total_states = sum(len(x) for x in data_array)
    initial_transitions = np.zeros((total_states, total_states), dtype=float)

    # Adaptive alpha based on relative dataset sizes
    if len(data) > 0:
        alpha = float(len(selected_df)) / float(len(data))
    else:
        alpha = 0.0

    # --- 2. estimate transitions between consecutive levels ---
    for level_idx in range(len(data_array) - 1):
        parent_col = modelArchitecture[level_idx]
        child_col = modelArchitecture[level_idx + 1]

        for parent in data_array[level_idx]:
            parent_pos = state_pos_dic[parent]

            # All children that appear with this parent in the full data
            mask_parent_all = data[parent_col] == parent
            children_all = (
                data[child_col][mask_parent_all]
                .value_counts()
                .keys()
                .to_numpy()
            )

            # Counts for (parent, child) within selected_df
            mask_parent_sel = selected_df[parent_col] == parent
            selected_parent_child_counts = (
                selected_df[child_col][mask_parent_sel].value_counts()
            )

            base_parent_count = mask_parent_all.sum()
            selected_parent_total = float(selected_parent_child_counts.sum())

            # Denominator includes base counts plus alpha-weighted selected counts
            total_length = float(base_parent_count) + alpha * selected_parent_total

            # If there is no evidence at all, we leave this row for the
            # "no outgoing transitions" fix-up step later.
            if total_length == 0:
                continue

            for child in children_all:
                # base count from full data
                mask_child_all = mask_parent_all & (data[child_col] == child)
                child_count = float(mask_child_all.sum())
                # additional weighted count from selected_df for this child
                selected_child_count = float(selected_parent_child_counts.get(child, 0))

                prob = (child_count + alpha * selected_child_count) / total_length

                child_pos = state_pos_dic[child]
                initial_transitions[parent_pos, child_pos] = prob

    # --- 3. ensure P(i, i) = 1.0 for states with no outgoing transitions ---
    row_sums = initial_transitions.sum(axis=1)
    for i in range(total_states):
        if row_sums[i] == 0.0:
            # Make this state absorbing
            initial_transitions[i, i] = 1.0

    # --- 4. write CSV with human-readable labels ---
    idx_to_label = {v: k for k, v in state_pos_dic.items()}
    labels = [idx_to_label[i] for i in range(total_states)]

    df = pd.DataFrame(initial_transitions, columns=labels, index=labels)
    df.to_csv(file_name)

    return initial_transitions
