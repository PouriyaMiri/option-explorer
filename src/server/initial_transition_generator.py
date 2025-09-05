import numpy as np
import pandas as pd 


def generate_initial_transition_model(data: pd.DataFrame, selected_df : pd.DataFrame , modelArchitecture :list , file_name: str = "data/graph_world00.csv"):
    
    data_array = []
    state_pos_dic = {}
    pos = 0
    for item in modelArchitecture:
        children = list(data[item].value_counts().index)
        children.sort(key=str.lower)
        for child in children:
            state_pos_dic[child] = pos
            pos+=1
        data_array.append(children)
    
    total_states = sum([len(x) for x in data_array])
    initial_transitions = np.zeros((total_states , total_states))

    for i in range(len(data_array)-1):
        for j in range(len(data_array[i])):
            parent = data_array[i][j]
            parent_pos = state_pos_dic[parent]
            children = data[modelArchitecture[i+1]][data[modelArchitecture[i]] == parent].value_counts().keys().to_numpy()

            selected_parent_child_df = selected_df[modelArchitecture[i+1]][selected_df[modelArchitecture[i]] == parent].value_counts()

            total_length = len(data[modelArchitecture[i+1]][data[modelArchitecture[i]] == parent])  + sum(selected_parent_child_df) #len(children)  +
            for child in children:
                child_count = len(data[modelArchitecture[i+1]][(data[modelArchitecture[i]] == parent) & (data[modelArchitecture[i+1]] == child)])
                prob = (child_count+selected_parent_child_df.get(child , default=0))/total_length
                child_pos = state_pos_dic[child]
                initial_transitions[parent_pos][child_pos] = prob


    ## assign 1.0 probability to each leaf
    for i in range(len(data_array[-1])):
            parent = data_array[len(data_array)-1][i]
            parent_pos = state_pos_dic[parent]
            initial_transitions[parent_pos][parent_pos] = 1.0


    columns = dict((v,k) for k,v in state_pos_dic.items())
    df = pd.DataFrame(initial_transitions , columns=[columns[i] for i  in range(initial_transitions.shape[0])] \
                      , index=[columns[i] for i  in range(initial_transitions.shape[0])])
    df.to_csv(file_name)


    # sdf = df.astype(pd.SparseDtype("float", 0.0))

    # print('dense : {:0.2f} bytes'.format(df.memory_usage().sum() / 1e3))
    # print('sparse: {:0.2f} bytes'.format(sdf.memory_usage().sum() / 1e3))


    return initial_transitions
