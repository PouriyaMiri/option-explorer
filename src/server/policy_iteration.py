import numpy as np


class PolicyIteration:
    """
    Fixed-policy value iteration for a Markov reward process:

        V = R + gamma * P V

    where:
        - R is the reward_function (shape: [num_states])
        - P is the probability_matrix (shape: [num_states, num_states])
    """

    def __init__(self, reward_function, probability_matrix, gamma, theta, max_iters=10_000):
        probability_matrix = np.asarray(probability_matrix, dtype=float)
        reward_function = np.nan_to_num(np.asarray(reward_function, dtype=float))

        num_states = probability_matrix.shape[0]

        # --- guard rails ---
        if probability_matrix.shape[0] != probability_matrix.shape[1]:
            raise ValueError("probability_matrix must be square.")

        if reward_function.shape[0] != num_states:
            raise ValueError(
                f"reward_function length ({reward_function.shape[0]}) "
                f"does not match number of states ({num_states})."
            )

        if not (0.0 <= gamma < 1.0):
            raise ValueError("gamma must be in [0, 1) for convergence.")

        if theta <= 0.0:
            raise ValueError("theta must be positive.")

        if max_iters <= 0:
            raise ValueError("max_iters must be a positive integer.")

        self.num_states = num_states
        self.reward_function = reward_function
        self.probability_matrix = probability_matrix
        self.gamma = float(gamma)
        self.theta = float(theta)
        self.max_iters = int(max_iters)

    def get_utility_values(self):
        """
        Perform synchronous value iteration:

            V_{k+1} = R + gamma * P V_k

        until the max change ||V_{k+1} - V_k||_∞ < theta,
        or until max_iters is reached.

        Returns
        -------
        utilities : np.ndarray
            Vector of shape [num_states] with the estimated utilities.
        """
        utilities = np.zeros(self.num_states, dtype=float)

        for _ in range(self.max_iters):
            temp_utilities = utilities.copy()

            # vectorized Bellman update
            utilities = self.reward_function + self.gamma * (
                self.probability_matrix @ temp_utilities
            )

            # sup-norm difference
            delta = np.max(np.abs(temp_utilities - utilities))

            if delta < self.theta:
                return utilities

        # If we reach here, we hit the cutoff without satisfying theta.
        # We still return the last estimate.
        return utilities
