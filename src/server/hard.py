import random

# Predefined values
fields = ["healthcare", "transportation", "logistics", "energy", "manufacturing"]
domains = {
    "healthcare": ["computer vision", "natural language processing", "forecasting"],
    "transportation": ["optimization", "forecasting", "computer vision"],
    "logistics": ["optimization", "forecasting", "missing data handling"],
    "energy": ["forecasting", "natural language processing", "optimization"],
    "manufacturing": ["anomaly detection", "quality control", "computer vision"],
}
intents = {
    "computer vision": ["image classification", "object detection", "segmentation"],
    "natural language processing": ["text classification", "sentiment analysis", "translation"],
    "forecasting": ["demand prediction", "traffic prediction", "energy load forecasting"],
    "optimization": ["route optimization", "resource allocation", "cost minimization"],
    "anomaly detection": ["defect detection", "fraud detection"],
    "quality control": ["inspection analysis", "standard compliance"],
    "missing data handling": ["imputation", "pattern recognition"],
}

def generate_hard_constraints(num_columns_to_select=3):
    # Define potential keys and generation logic
    possible_keys = [
        ("field", lambda: random.choice(fields)),
        ("domain", lambda: random.choice(domains[random.choice(fields)])),
        ("intent", lambda: random.choice(intents[random.choice(domains[random.choice(fields)])])),
        ("f1_score", lambda: (round(random.uniform(0.7, 0.9), 3), None))
    ]

    # Select and build the constraints
    selected_keys = random.sample(possible_keys, num_columns_to_select)
    hard_constraints = {key: value_func() for key, value_func in selected_keys}

    return hard_constraints
