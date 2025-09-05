import random

# Random metric generator
def random_metric():
    return round(random.uniform(0.7, 0.90), 3)

# Random RAM generator
def random_ram():
    return f"{random.choice([8, 16, 32, 64])}"

# Random epochs generator
def random_epochs():
    return random.randint(1, 50) * 10

# Function to generate soft constraints
def generate_soft_constraints(num_constraints=5):
    # Define potential soft constraints and their generation logic
    soft_constraints_pool = {
        #"kernel_size": lambda: (random.choice([3, 5]), None),
        #"pool_size": lambda: (random.choice([2, 3]), None),
        "batch_size": lambda: (random.choice([16, 32, 64]), None),
        "epochs": lambda: (random_epochs(), None),
        "processing_unit": lambda: random.choice(["CPU", "GPU"]),
        "RAM": lambda: (None, random.choice([8, 16, 32, 64])),
        "loss": lambda: (round(random.uniform(0.01, 0.2), 3), None),
        "accuracy": lambda: (random_metric(), None),
        "recall": lambda: (random_metric(), None),
        "precision": lambda: (random_metric(), None),
        "f1_score": lambda: (random_metric(), None),
        "training_time": lambda: (None, random.randint(1, 200)),
    }

    # Select and build the constraints
    selected_keys = random.sample(list(soft_constraints_pool.keys()), num_constraints)
    soft_constraints = {key: soft_constraints_pool[key]() for key in selected_keys}

    return soft_constraints

# Function to generate reward values
def generate_reward_values(soft_constraints):
    # Define reward ranges for each soft constraint
    reward_ranges = {
        #"kernel_size": (1, 10),
        #"pool_size": (1, 10),
        "batch_size": (1, 10),
        "epochs": (1, 10),
        "processing_unit": (1, 100),
        "RAM": (1, 10),
        "loss": (1, 100),
        "accuracy": (1, 1000),
        "recall": (1, 100),
        "precision": (1, 1000),
        "f1_score": (1, 100),
        "training_time": (1, 10),
    }

    # Map rewards to the soft constraints
    reward_values = {key: reward_ranges[key] for key in soft_constraints.keys()}

    return reward_values


