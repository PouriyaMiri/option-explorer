import matplotlib.pyplot as plt
import numpy as np

# --- Your original data ---
quantitative_questions = [
    "Age",
    "Instruction clarity",
    "Time (s)",
    "Difficulty",
    "Model satisfaction",
    "Order number"
]

person1_quant = np.array([22, 4, 164, 2, 4, 3], dtype=float)     # With MDP
person2_quant = np.array([22, 4, 709, 5, 2, 106], dtype=float)   # Without MDP

# --- 1) Save the original (non-normalized) comparison chart ---
x = np.arange(len(quantitative_questions))
width = 0.35

fig, ax = plt.subplots()
ax.bar(x - width/2, person1_quant, width, label='With MDP')
ax.bar(x + width/2, person2_quant, width, label='Without MDP')
ax.set_ylabel('Values')
ax.set_title('Quantitative Data Comparison (Raw)')
ax.set_xticks(x)
ax.set_xticklabels(quantitative_questions, rotation=45, ha='right')
ax.legend()
plt.tight_layout()

raw_path = './quantitative_comparison.png'
plt.savefig(raw_path)
plt.close(fig)

# --- 2) Normalize all values based on the "With MDP" values ---
# Avoid divide-by-zero: where person1 == 0, set ratio to NaN
denom = np.where(person1_quant == 0, np.nan, person1_quant)

p1_norm = person1_quant / denom  # will be 1.0 wherever denom != 0
p2_norm = person2_quant / denom

# Plot normalized chart
fig2, ax2 = plt.subplots()
ax2.bar(x - width/2, p1_norm, width, label='With MDP (normalized=1)')
ax2.bar(x + width/2, p2_norm, width, label='Without MDP (vs With MDP)')
ax2.set_ylabel('Ratio vs With MDP')
ax2.set_title('Quantitative Data Comparison (Normalized to With MDP)')
ax2.set_xticks(x)
ax2.set_xticklabels(quantitative_questions, rotation=45, ha='right')
ax2.legend()
plt.tight_layout()

norm_path = './quantitative_comparison_normalized.png'
plt.savefig(norm_path)
plt.close(fig2)



# Create logarithmic scale chart for raw values

fig3, ax3 = plt.subplots()
ax3.bar(x - width/2, person1_quant, width, label='With MDP')
ax3.bar(x + width/2, person2_quant, width, label='Without MDP')
ax3.set_ylabel('Values (log scale)')
ax3.set_title('Quantitative Data Comparison (Logarithmic Scale)')
ax3.set_xticks(x)
ax3.set_xticklabels(quantitative_questions, rotation=45, ha='right')
ax3.set_yscale('log')  # Apply log scale
ax3.legend()
plt.tight_layout()

log_path = './quantitative_comparison_log.png'
plt.savefig(log_path)
plt.close(fig3)

log_path, raw_path, norm_path
