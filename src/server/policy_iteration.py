import numpy as np
import matplotlib.pyplot as plt
import math

class PolicyIteration:
    def __init__(self, reward_function, probability_matrix, gamma , theta):
        self.num_states = probability_matrix.shape[0]
        self.num_actions = self.num_states - 1 
        self.reward_function = np.nan_to_num(reward_function)

        self.probability_matrix = probability_matrix
        self.gamma = gamma
        self.theta = theta


    def get_utility_values(self):
        utilities = np.zeros(self.num_states)
        converge = False
        while not converge:
            temp_utilities = utilities.copy()
            for i in range(self.num_states):
                utilities[i] = self.reward_function[i] +  self.gamma  * np.sum(self.probability_matrix[i, :] * temp_utilities)
            if (temp_utilities - utilities).size == 0:
                delta = 0  # Default value
            else:
                delta = np.max(np.abs(temp_utilities - utilities))
            if delta < self. theta:
                converge = True
        return utilities