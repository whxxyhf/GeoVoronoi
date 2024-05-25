const d3 = require("d3");
const fs = require("fs");
const xlsx= require("node-xlsx");
const sylvester = require('sylvester');

const parameters = process.argv.slice(2);
const fileName = parameters[0]
const rateArray = [0.01,0.05,0.1];
const count = 1;
const width = 400;
const height = 300;
const n_cluster = parseInt(parameters[1]);
const clsteringMethod = parameters[2];
const mr = Number(parameters[3]);
const top = Number(parameters[4]);
const methods = {'OUR':'ssbns','RS':'rs','BNS':'bns', 'Shape':'shape'};
const outData = [];

//获取原始数据
const originData = JSON.parse(fs.readFileSync(`../dataSet/${fileName}.json`));
//获得标签数据
const labelsData = JSON.parse(fs.readFileSync(`./clusteringData/${fileName}/${fileName}_${clsteringMethod}_class${n_cluster}.json`));
const idToLabel = {};
for(let i in labelsData){
  idToLabel[labelsData[i]['id']] = labelsData[i]['label'];
}
const latMinMax = d3.extent(originData,d=>d.lat);
const lngMinMax = d3.extent(originData,d=>d.lng);
const latScale = d3.scaleLinear(latMinMax,[0,width]);
const lngScale = d3.scaleLinear(lngMinMax,[0,height]);
originData.forEach(v => {
    v.lat=latScale(v.lat);
    v.lng=lngScale(v.lng);
});
for(let r=0;r<rateArray.length;r++){
    outData.push({name:String(rateArray[r]),data:[['Method','AV-MVAR','AV-MSTD','FSL-CV','FARE-MD', 'MEAN-DIFF', 'MEAN-ENTROPY']]})
    for(let method in methods){
        let metrics = calculateMatrics(method,rateArray[r]);
        if(method=='Shape')
          method=method+top;
        let data = [method];
        data.push(metrics.var_mean);
        data.push(metrics.std_mean);
        data.push(metrics.cv_length);
        data.push(metrics.cv_area);
        data.push(metrics.mean_difference);
        data.push(metrics.mean_entropy);
        outData[r].data.push(data);
    }
}
const buffer = xlsx.build(outData);
fs.writeFile(`./evaData/eva_${fileName}_mr=${mr}_method=${clsteringMethod}_class=${n_cluster}.xlsx`,buffer,err=>{
    if(err){
        console.log(err);
    }
    else{
        console.log("finished!!!");
    }
})

//不同采样率下的结果
function calculateMatrics(method,rate){
    let matrics_method;
        //获取评估数据
        let var_mean_arr_count=[];
        let std_mean_arr_count=[];
        let cv_length_arr_count=[];
        let cv_areas_arr_count=[];//所有面片相邻的面片面积变异系数数组
        let mean_value_diff_arr_count = [];
        let mean_entropy_arr_count = [];
        for(let i=0;i<count;i++){
          let path="";
          if(method=="OUR")
            path=`./samplingData/${fileName}/${fileName}_${methods[method]}_mr${mr}_${rate}_${clsteringMethod}_class${n_cluster}.json`;
          else if(method=="OURmr0")
            path=`./samplingData/${fileName}/${fileName}_${methods[method]}_mr${0}_${rate}_${clsteringMethod}_class${n_cluster}.json`;
          else if (method=="Shape")
            path=`./samplingData/${fileName}/shape${top}_${fileName}_ssbns_mr${mr}_${rate}_${clsteringMethod}_class${n_cluster}.json`;
          else
            path=`./samplingData/${fileName}/${fileName}_${methods[method]}_${rate}.json`;
            let samplingData = JSON.parse(fs.readFileSync(path));
            let points = samplingData.map(v=>([latScale(v.lat),lngScale(v.lng)]));
            let delaunay = d3.Delaunay.from(points);
            let voronoi = delaunay.voronoi([0,0,width,height]);
            let originLocData=JSON.parse(JSON.stringify(originData));
            let value_difference_arr = [];
            //获取每个盘里的信息熵
            let voronoiEntropy = [];
            //获取每个盘里的value值
            let voronoiValues = samplingData.map((v,j)=>{
              let polygons=voronoi.cellPolygon(j);

              let count=0;
              let values_one=[];
              let labels_one=[];
              for(let p=0;p<originLocData.length;p++){
                if(isInPolygon([originLocData[p].lat,originLocData[p].lng],polygons)){
                  count+=1;
                  values_one.push(originLocData[p].value);
                  labels_one.push(idToLabel[originLocData[p].id]);
                  originLocData.splice(p,1);
                  p--;
                }
              }
              value_difference_arr.push(Math.abs(v.value - d3.mean(values_one)));
              voronoiEntropy.push(calculateEntropy(labels_one));
              return values_one
            })
            mean_value_diff_arr_count.push(d3.mean(value_difference_arr));
            mean_entropy_arr_count.push(d3.mean(voronoiEntropy));
            //计算指标
            let var_arr=[];
            let std_arr=[];
            voronoiValues.forEach((v,i)=>{
                let var_one = d3.variance(v);
                var_arr.push(var_one);
                std_arr.push(Math.sqrt(var_one));
            })
            var_mean_arr_count.push(d3.mean(var_arr));
            std_mean_arr_count.push(d3.mean(std_arr));

            let length=[];
            let cv_area=[];
            for(let j=0;j<samplingData.length;j++){
                let polygon=voronoi.cellPolygon(j);
                let neighbors=voronoi.neighbors(j);
                //一个面片相邻面片的面积数组
                let area_arr=[];
                let length_one =[];
                for(let k=0;k<polygon.length-1;k++){
                  length_one.push(Math.sqrt(Math.pow(polygon[k][0]-polygon[k+1][0],2)+Math.pow(polygon[k][1]-polygon[k+1][1],2)));
                    let neighbor_item=neighbors.next();
                    if(neighbor_item.done===false){
                        let neighbor=voronoi.cellPolygon(neighbor_item.value);
                        area_arr.push(polygonArea(neighbor));
                    }
                }
                let area_mean_one=d3.mean(area_arr);
                let area_std_one=Math.sqrt(d3.variance(area_arr));
                cv_area.push(area_std_one/area_mean_one);

                let length_mean_one=d3.mean(length_one);
                let length_std_one=Math.sqrt(d3.variance(length_one));
                length.push(length_std_one/length_mean_one);
            }
            // let length_mean=d3.mean(length);
            // let length_std=Math.sqrt(d3.variance(length));
            cv_length_arr_count.push(d3.mean(length));
            cv_areas_arr_count.push(d3.mean(cv_area));
        }
        matrics_method={method:method,rate:rate,var_mean:d3.mean(var_mean_arr_count),std_mean:d3.mean(std_mean_arr_count),
        cv_length:d3.mean(cv_length_arr_count),cv_area:d3.mean(cv_areas_arr_count), mean_difference: d3.mean(mean_value_diff_arr_count), mean_entropy: d3.mean(mean_entropy_arr_count)};
    
    console.log(JSON.stringify(matrics_method));
    return matrics_method;
}

function calculateEntropy(labels){
  let length = labels.length;
  let labels_ = Array.from(new Set(labels));
  let h = 0;
  for(let i in labels_){
    let c = labels.filter(v=>i==v);
    let p = c.length / length;
    h += -p * Math.log2(p);
  }
  return h;
  
}

function polygonArea(points)
{
	let i, j;
	let area = 0;
	for (i = 0; i < points.length-1; i++)
	{
		j = (i + 1) % points.length;
		area += points[i][0] * points[j][1];
		area -= points[i][1] * points[j][0];
	}
	area /= 2;
	return Math.abs(area);
}

function moran(M, X){
  var M = $M(M);
  var X = $V(X);
  var x_mean = X.sum / X.cols;
  return X.subtract(x_mean).transpose().dot(M).dot(X.subtract(x_mean)) / X.subtract(x_mean).transpose().dot(X.subtract(x_mean));
}

function isInPolygon(checkPoint, polygonPoints) {
    //判断一个点是否在多边形内
    var counter = 0;
    var i;
    var xinters;
    var p1, p2;
    var pointCount = polygonPoints.length;
    p1 = polygonPoints[0];

    for (i = 1; i <= pointCount; i++) {
      p2 = polygonPoints[i % pointCount];
      if (
        checkPoint[0] > Math.min(p1[0], p2[0]) &&
        checkPoint[0] <= Math.max(p1[0], p2[0])
      ) {
        if (checkPoint[1] <= Math.max(p1[1], p2[1])) {
          if (p1[0] !== p2[0]) {
            xinters =
              ((checkPoint[0] - p1[0]) * (p2[1] - p1[1])) / (p2[0] - p1[0]) +
              p1[1];
            if (p1[1] === p2[1] || checkPoint[1] <= xinters) {
              counter++;
            }
          }
        }
      }
      p1 = p2;
    }
    if (counter % 2 === 0) {
      return false;
    } else {
      return true;
    }
  }

