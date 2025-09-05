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
        inner_node_num = self.num_states - len(self.data)
        states_array = []
        i, c = np.where(self.probability_matrix.apply(lambda x: x != 0))
        a = list(zip(i, c))
        a = [(int(i) , int(j)) for (i , j) in a ]
        
        for item in range(self.num_states):
            value = None if item < inner_node_num else self.data.iloc[item-inner_node_num]
            reward = self.reward_function[item]
            state = GraphState(item , [ j for ( i , j) in a if i == item] , value , reward)
            states_array.append(state)
        
        return states_array

    def get_reward_function(self , data , constraints , reward_values):
        inner_node_num = max(0, self.num_states - len(self.data))

        
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
        
        data = np.array(data, dtype=float)
        if constraints[0] is None:
            constraints = (data.min(), constraints[1])
        if constraints[1] is None:
            constraints = (constraints[0], data.max())

        reward_array = np.full(len(data), rewards[0], dtype=float)
        reward_array[(data >= constraints[0]) & (data <= constraints[1])] = rewards[1]

        return reward_array

    def rewards_cat_calc(self , data, categories=None, rewards=(0, 1)):
        data = np.array(data, dtype=str)
        reward_array = np.full(len(data), rewards[0], dtype=float)
        reward_array[np.isin(data, categories)] = rewards[1]
        return reward_array


    def get_rewards(self , data, constraints=None, reward_values=None):
        cumulative_rewards = np.zeros(len(data))
        for col in data.columns:
            if col in constraints:
                constraint = constraints.get(col)
                if constraint is None:
                    continue
                reward = reward_values.get(col, (0, 1))

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

    def set_states_rewards(self , reward_function):
        if len(reward_function) != self.num_states:
            raise ValueError(f"The length of the reward array and states array are not the same!")
        
        for item in self.states:
            item.reward = reward_function[item.key]

    # Define the custom graph
    def draw_MDP_graph(self):
        inner_node_num = self.num_states - len(self.data)    
        G = nx.DiGraph()


        nodes= {}
        edges = []
        
        pos = {
            1: (0, 0),  # Root node
            2: (1, 1),  # First level
            3: (1, -1),
            4: (2, 1.5),  # Second level
            5: (2, 0.5),
            6: (2, -1),
        }

        for item in self.states:
            if item.key == 0:
                nodes[item.key] = (0 , 0)
            elif item.key < inner_node_num:
                nodes[item.key] = (1 , item.key)
            else:
                nodes[item.key] = (2 , item.key)
            for child in item.children:
                edges.append((item.key ,child ))
        # G.add_nodes_from(nodes)
        
        # Add edges (connections between nodes)
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
    def __init__(self,key , children ,value : pd.Series = None , reward = None , utility_value = 0.0):
        self.children = children
        self.key = key  
        self.reward = reward
        self.utility_value = utility_value
        self.value = value

    def get_action_number(self):
        return len(self.children)
    

    def __str__(self):
        return str(self.__dict__)
    

    def __lt__(self, other):

        if self.value is None or other.value is None:
            return self.utility_value >= other.utility_value

        else:
            if self.utility_value > other.utility_value:
                return True
            # Better accuracy place in top 
            elif self.utility_value == other.utility_value:
                return self.value.accuracy >= other.value.accuracy 
            else:
                return False