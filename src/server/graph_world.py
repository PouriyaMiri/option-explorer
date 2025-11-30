import numpy as np
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt

class GraphWorld():
    def __init__(self, data , probability_file_name, constraints , reward_values):

        self.data = data
        self.probability_matrix = pd.read_csv(probability_file_name , index_col=0)
        self.num_states = self.probability_matrix.shape[0]
        self.num_actions = self.probability_matrix.shape[0] - 1 
        self.reward_function = self.get_reward_function(self.data , constraints , reward_values)
        self.transition_model = self.probability_matrix.to_numpy()

        self.states = self.__get_states__()
        self.leafs = self.__get_leafs__()


    def __get_leafs__(self):
        leafs = []
        for state in self.states:
            if state.value is not None:
                leafs.append(state)
        
        return leafs


    def __get_states__(self):

        # Shape of the probability matrix
        probability_matrix_shape = self.probability_matrix

        # Calculate the number of inner nodes
        inner_node_num = self.num_states - len(self.data)
        print(f"Total nodes: {self.num_states}, Inner nodes: {inner_node_num}, Leaf nodes: {len(self.data)}")
        
        # Initialize states array
        states = []
        non_zero_indices = np.nonzero(probability_matrix_shape)
        
        # Create a dictionary to store children nodes for each state
        children_dict = {i: [] for i in range(self.num_states)}
        
        for i, j in zip(non_zero_indices[0], non_zero_indices[1]):
            if i != j:
                children_dict[i].append(j)
        
        # Create graph state objects
        for item in range(self.num_states):
            if item < inner_node_num:
                value = None
            else:
                value = self.data.iloc[item - inner_node_num]
            reward = self.reward_function[item]
            state = GraphState(key=item, children=children_dict[item], value=value, reward=reward)
            states.append(state)

        return states


    def get_reward_function(self , data , constraints , reward_values):

        inner_node_num = self.probability_matrix.shape[0] - len(data)
        if inner_node_num < 0:
            raise ValueError(f"lengths are not the same!")

        
        reward_function =  np.concatenate(
            (np.zeros((inner_node_num , ) , dtype='float64'),  
            self.get_rewards(data , constraints , reward_values)),
            axis=0
        )
        return reward_function
    

    def rewards_num_calc(self , data, constraints=(None, None), rewards=(0, 1)):
        if data.size == 0:
            print("Data is empty. Returning default constraints.")
            return 0
        
        # Handling infinite or NaN constraints
        low, high = constraints
        min_val, max_val = np.nanmin(data), np.nanmax(data)
        
        if low is None or low == -np.inf or (isinstance(low, float) and np.isnan(low)):
            low = min_val
        if high is None or high == np.inf or (isinstance(high, float) and np.isnan(high)):
            high = max_val
        
        if low > high:
            raise ValueError(f"Invalid range: low ({low}) is greater than high ({high}).")
        
        # Creating mask for the valid range
        mask = ((data >= low) & (data <= high)).astype('float64')
        mask[np.isnan(mask)] = 0  # In case of NaN values in data
        
        # Return weighted values: rewards[1] for within range, rewards[0] otherwise
        return mask * rewards[1] + (1 - mask) * rewards[0]


    def rewards_cat_calc(self, data: pd.Series, categories, rewards=(0, 1)):
        if len(data) == 0:
            print("Empty data provided. Exiting.")
            return np.array([])

        # Convert rewards to numpy array for vectorized operations
        np_rewards = np.array(rewards)

        # Create a boolean mask, where True means the data is in the categories
        mask = np.isin(data, categories)

        # Multiply mask by reward[1] and its complement by reward[0]
        reward_array = mask * np_rewards[1] + (~mask) * np_rewards[0]

        return reward_array


    def get_rewards(self, data: pd.DataFrame, constraints: dict, reward_values: dict):
        cumulative_rewards = np.zeros(len(data), dtype=float)

        for col in data.columns:

            if col in constraints:
                constraint = constraints[col]
                reward = reward_values.get(col, (0, 1))  # Default to (0, 1) if no reward range is specified

                if isinstance(constraint, str):  # Categorical constraint
                    cumulative_rewards += self.rewards_cat_calc(data[col], categories=[constraint], rewards=reward)
                elif isinstance(constraint, tuple) and len(constraint) == 2:  # Numeric constraint
                    cumulative_rewards += self.rewards_num_calc(data[col], constraints=constraint, rewards=reward)
                else:
                    raise ValueError(f"Invalid constraint for column {col}: {constraint}")

        return cumulative_rewards

    def set_utility_values(self , utility_values):
        if len(utility_values) != self.num_states:
            raise ValueError(f"The length of the utility_values array and states array are not the same!")
        for item in self.states:
            item.utility_value = utility_values[item.key]


    def set_states_rewards(self , states_rewards):
        if len(states_rewards) != self.num_states:
            raise ValueError(f"The length of the states_rewards array and states array are not the same!")
        for item in self.states:
            item.reward = states_rewards[item.key]


    def draw_MDP_graph(self, save_path=None):
        """
        Visualize the MDP as a left-to-right directed graph:
        - 0: root node
        - 1 to inner_node_num - 1: inner nodes
        - inner_node_num to num_states - 1: leaf nodes
        """

        probability_matrix = self.probability_matrix
        G = nx.DiGraph()

        # Number of states
        num_states = probability_matrix.shape[0]
        inner_node_num = num_states - len(self.data)

        # Create node labels
        node_labels = {i: f"S{i}" for i in range(num_states)}

        # Identify edges based on non-zero probabilities
        non_zero_indices = np.nonzero(probability_matrix)
        edges = [(i, j) for i, j in zip(non_zero_indices[0], non_zero_indices[1]) if i != j]

        # Create positions for a left-to-right layout
        # Root node at the left, inner nodes in the middle, leaf nodes on the right
        nodes = {}
        
        # Root node
        nodes[0] = (-1, 0)

        # Inner nodes in the middle
        for i in range(1, inner_node_num):
            nodes[i] = (0, inner_node_num - i)

        # Leaf nodes on the right
        leaf_index = 0
        for i in range(inner_node_num, num_states):
            nodes[i] = (1, len(self.data) - leaf_index)
            leaf_index += 1

        # Add nodes and edges to the graph
        G.add_nodes_from(node_labels.keys())
        G.add_edges_from(edges)
        
        plt.figure(figsize=(10, 6))
        nx.draw(
            G, nodes,
            with_labels=True, node_color="lightblue", 
            node_size=700, font_size=12, edge_color="black",
            arrowsize=20  # For directed edges
        )
        plt.title("Left-to-Right Custom Graph")
        plt.show()


class GraphState():
    """
    Single node in the GraphWorld.

    Sorting behaviour is **dynamic**: the class-level ``sort_cols`` list
    controls how two states are ordered. By default we sort only by
    ``utility_value`` in descending order.

    Example:
        # sort primarily by utility_value, then by f1_score, then by training_time
        GraphState.sort_cols = ["utility_value", "f1_score", "training_time"]
    """
    # Order of descending sort keys.
    # "utility_value" refers to the attribute on GraphState, any other
    # string is treated as a column on the pandas Series stored in ``value``.
    sort_cols = ["utility_value"]

    def __init__(self, key, children, value: pd.Series = None, reward=None, utility_value: float = 0.0):
        self.children = children
        self.key = key
        self.reward = reward
        self.utility_value = utility_value
        # ``value`` is usually a pandas Series corresponding to a row in the
        # original DataFrame; inner nodes use ``None`` here.
        self.value = value

    def __str__(self):
        return (
            f"State(key={self.key}, "
            f"reward={self.reward}, "
            f"utility_value={self.utility_value}, "
            f"value={None if self.value is None else 'row'})"
        )

    def __lt__(self, other):
        """
        Custom ordering that uses the columns specified in ``sort_cols``.
        All comparisons are *descending*: a state with a higher value in
        the first differing column is considered "less than" the other so
        that ``sorted(states, reverse=False)`` yields a descending order.

        Supported column names in ``sort_cols``:
            - "utility_value" : uses GraphState.utility_value
            - any other string: looked up on the pandas Series in ``value``
                                first as an attribute, then as a key.
        """
        for col in self.sort_cols:
            # 1) Utility value lives directly on the state
            if col == "utility_value":
                a = self.utility_value
                b = other.utility_value
            else:
                # 2) Feature columns live in the attached pandas Series.
                #    If either side has no row (inner node) we skip this
                #    tie-breaker.
                if self.value is None or other.value is None:
                    continue

                # Prefer attribute-style access (df.col) but fall back to key.
                a = getattr(self.value, col, None)
                if a is None and col in self.value:
                    a = self.value[col]

                b = getattr(other.value, col, None)
                if b is None and col in other.value:
                    b = other.value[col]

            # If either value is still None, we cannot use this column.
            if a is None or b is None:
                continue

            # Descending order: larger value should come "first".
            if a > b:
                return True
            if a < b:
                return False

        # If we reach here, either all relevant columns were equal or unusable.
        # Treat states as equal in ordering.
        return False