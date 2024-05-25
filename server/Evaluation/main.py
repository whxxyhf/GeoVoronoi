from sampling.bns import BNS
from sampling.zdhxbns import ZDHXBNS
from sampling.kde import get_kde
import json
import numpy as np
from sklearn.cluster import KMeans
from jenkspy import JenksNaturalBreaks
import random
import os
from moran import moranI, distance


def load_data(url):
    with open(url, 'r') as f:
        data = json.load(f)
        return data


def attribute_clustering(origin_data, method='jnb', n_cluster=10):
    value = [i['value'] for i in origin_data]
    if method == 'jnb':
        jnb = JenksNaturalBreaks(nb_class=n_cluster)
        jnb.fit(value)
        labels = jnb.labels_
    elif method == 'kmeans':
        km = KMeans(n_clusters=n_cluster).fit(np.array(value).reshape(-1, 1))
        labels = km.labels_
    else:
        print('method error!')
        return
    for i in range(len(labels)):
        origin_data[i]['label'] = int(labels[i])
    return origin_data

def sampling_rs(data, rate):
    count = int(rate * len(data))
    sampling_data = random.sample(data, count)
    return sampling_data

def sampling_bns(kde, r, origin_data):
    bns = BNS(kde, R=r)
    seeds, disks = bns.apply_sample()
    data_processed = []
    for disk in disks:
        p = origin_data[disk["seedId"]]
        point = {
            "id": p['id'],
            "lat": p['lat'],
            "lng": p['lng'],
            "value": p['value'],
            # 以下是新的字段
            "diskId": disk["id"],
            "children": disk["children"],
            "radius": disk["r"],
        }
        data_processed.append(point)
    return data_processed, bns.rate

def sampling_ssbns(kde, label_data, r, min_R_rate=0):
    for i in range(len(kde)):
        kde[i].append(label_data[int(kde[i][0])]['label'])
    ssbns = ZDHXBNS(kde, R=r, min_r_rate=min_R_rate)

    seeds, disks = ssbns.apply_sample()
    data_processed = []

    for disk in disks:
        p = label_data[disk["seedId"]]
        point = {
            "id": p['id'],
            "lat": p['lat'],
            "lng": p['lng'],
            "value": p['value'],
            "label": p['label'],
            # 以下是新的字段
            "diskId": disk["id"],
            "children": disk["children"],
            "radius": disk["r"],
        }

        data_processed.append(point)
    return data_processed, ssbns.rate


def save_data(url, data):
    with open(url, 'w') as fw:
        json.dump(data, fw)


def data_prepare(file, n_cluster=10, method='jnb'):
    data = load_data(f'../dataSet/{file}.json')

    # 计算kde
    print(f'{file} kde ...')
    kde_data = get_kde(data)
    save_data(f'./kdeData/{file}_kde.json', kde_data)

    # 属性聚类
    print(f'{file} clustering ...')
    data = attribute_clustering(data, method=method, n_cluster=n_cluster)
    save_data(f'./clusteringData/{file}/{file}_{method}_class{n_cluster}.json', data)

if __name__ == '__main__':
    file = 'Occupation'
    # # 准备采样所需要的数据
    file_names = [file]
    # n_cluster = 10
    # method = 'jnb'
    # for file in file_names:
    #     data_prepare(file, n_cluster=n_cluster, method=method)
    #
    # 随机采样
    rates = [0.01, 0.05, 0.1]
    for file in file_names:
        data = load_data(f'../dataSet/{file}.json')
        for rate in rates:
            print(f'rs {rate} sampling ...')
            sampling_data = sampling_rs(data, rate)
            save_data(f'./samplingData/{file}/{file}_rs_{rate}.json', sampling_data)

    # # 蓝噪声采样
    # rates = [0.01, 0.05, 0.1]  #[Poverty 0.035,0.0138,0.009] [Health 0.03, 0.011, 0.007] [Density 0.035,0.0138,0.009] [Occupation 0.11, 0.055, 0.036]
    # n_cluster = 10
    # data = load_data(f'../dataSet/{file}.json')
    # kde = load_data(f'./kdeData/{file}_kde.json')
    # sampling_data, rate = sampling_bns(kde, 0.11, data)
    # print(rate)
    # if rate in rates:
    #     save_data(f'./samplingData/{file}/{file}_bns_{rate}.json', sampling_data)

    # # 分组蓝噪声采样 不设置最小半径
    # method = 'jnb'
    # rates = [0.01, 0.05, 0.1]  # [Poverty 0.15,0.058,0.035] [Health 0.1, 0.04, 0.024]
    # n_cluster = 10
    # data = load_data(f'./clusteringData/{file}/{file}_{method}_class{n_cluster}.json')
    # kde = load_data(f'./kdeData/{file}_kde.json')
    # sampling_data, rate = sampling_ssbns(kde, data, r=0.024, min_R_rate=0)
    # print(rate)
    # if rate in rates:
    #     save_data(f'./samplingData/{file}/{file}_ssbns_mr0_{rate}_{method}_class{n_cluster}.json', sampling_data)

    # # 分组蓝噪声采样 设置最小半径1.2
    # method = 'jnb'
    # min_R_rate = 1.2
    # rates = [0.01, 0.05, 0.1]  # [Poverty 0.05,0.022,0.013] [Health 0.037, 0.016, 0.01] [Density 0.05,0.02,0.0115] [Occupation 0.15,0.07,0.048]
    # n_cluster = 10
    # data = load_data(f'./clusteringData/{file}/{file}_{method}_class{n_cluster}.json')
    # kde = load_data(f'./kdeData/{file}_kde.json')
    # sampling_data, rate = sampling_ssbns(kde, data, r=0.15, min_R_rate=min_R_rate)
    # print(rate)
    # if rate in rates:
    #     save_data(f'./samplingData/{file}/{file}_ssbns_mr1.2_{rate}_{method}_class{n_cluster}.json', sampling_data)

    # # 模拟退火
    # method = 'jnb'
    # rates = [0.01, 0.05, 0.1]
    # n_cluster = 10
    # min_R_rate = 1.2
    # top = 0.2
    # temperature = 100000
    # iter = 500
    # failure = 200
    # decrease = 0.98
    # for rate in rates:
    #     path = f'./samplingData/{file}/{file}_ssbns_mr{min_R_rate}_{rate}_{method}_class{n_cluster}.json'
    #     out_path = f'./samplingData/{file}/shape{top}_{file}_ssbns_mr{min_R_rate}_{rate}_{method}_class{n_cluster}.json'
    #     os.system(f'node shapeOpt.js {file} {path} {out_path} {top} {temperature} {iter} {failure} {decrease}')

    # 评估
    method = 'jnb'
    n_cluster = 10
    min_R_rate = 1.2
    top = 0.2
    os.system(f'node index.js {file} {n_cluster} {method} {min_R_rate} {top}')
