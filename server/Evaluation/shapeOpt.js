const d3 = require("d3");
const fs = require("fs");
const parameters = process.argv.slice(2);
//读取文件的参数
const fileName = parameters[0]; 
const path = parameters[1]; 
const outPath = parameters[2]; 
const top = parameters[3];
const temperature = parameters[4];
const iter = parameters[5];
const fature = parameters[6];
const decrease = parameters[7];
// const rate = parameters[1];
// const n_cluster = parameters[3];
// const clusteringMethod = parameters[2];

// const min_r = parameters[4];


//设置生成维诺图的范围
const width = 973;
const height = 552;

    
const {samplingData,originDataDic} = load_data(path);
const {new_disks,destinationValueArray} = SA(samplingData,originDataDic,destinationFun_angle,top,temperature,iter,fature,decrease);
// const path = `./samplingData/${fileName}/${fileName}_ssbns_mr${min_r}_${rate}_${clusteringMethod}${n_cluster}.json`;
// const pathDestination = `../data/${method}${fileName}$class=${n_cluster}$rate=${rateArray[rate]}$min_r=${min_r}$count=${c}$knn=${top}$Destination.json`;
fs.writeFile(outPath,JSON.stringify(new_disks),err=>{
    if(err){
        console.log(err);
    }
    else{
        console.log("finished!!!");
    }
})
// fs.writeFile(pathDestination,JSON.stringify(destinationValueArray),err=>{
//     if(err){
//         console.log(err);
//     }
//     else{
//         console.log("finished!!!");
//     }
// })
    


function load_data(){
    const originPath = `../dataSet/${fileName}.json`;
    let samplingData = JSON.parse(fs.readFileSync(path));
    let originData = JSON.parse(fs.readFileSync(originPath));
    const latMinMax = d3.extent(originData,d=>d.lat);
    const lngMinMax = d3.extent(originData,d=>d.lng);
    const latScale = d3.scaleLinear(latMinMax,[0,width]);
    const lngScale = d3.scaleLinear(lngMinMax,[0,height]);
    const originDataDic = {};
    originData.forEach(v=>{
        v['x'] = latScale(v['lat']);
        v['y'] = lngScale(v['lng']);
        originDataDic[v['id']] = v;
    })
    samplingData.forEach((v,i) => {
        v['center'] = v['id'];
        v['centerX'] = v['lat'];
        v['centerY'] = v['lng'];
        v['diskId'] = i;
        v['x'] = latScale(v['lat']);
        v['y'] = lngScale(v['lng']);
    });
    return {'samplingData':samplingData,'originDataDic':originDataDic};
}

function getAngle (p1,p2,p3){
    const x1 = p1[0] - p3[0];
    const y1 = p1[1] - p3[1];
    const x2 = p2[0] - p3[0];
    const y2 = p2[1] - p3[1];
    const dot = x1 * x2 + y1 * y2
    const det = x1 * y2 - y1 * x2
    const angle = Math.atan2(det, dot) / Math.PI * 180
    return Math.round(angle + 360) % 360
}

function destinationFun_angle(samplingData){
    const points = samplingData.map(v=>[v.x,v.y]);
    let delaunay = d3.Delaunay.from(points);
    let voronoi = delaunay.voronoi([0,0,width,height]);
    let destination_angle = 0;
    let destination_value = 0;
    for(let j=0;j<samplingData.length;j++){
        if(samplingData[j].children.length>0){
            let polygon=voronoi.cellPolygon(j);
            let neighbors = samplingData.filter(v=>isInPolygon([v.x,v.y], polygon));
            let nieghbor_value = neighbors.map(v=>v.value);
            let std = Math.sqrt(d3.variance(nieghbor_value));
            let mean = d3.mean(nieghbor_value);
            // console.log(JSON.stringify(polygon))
            // polygon.push(polygon[1]);
            let angle_one_poly=[];//一个多边形的内角
            for(let k=0;k<polygon.length-1;k++){
                let angle = getAngle(polygon[k],polygon[k+1],[samplingData[j].x,samplingData[j].y]);
                // let angle = getAngle(polygon[k],polygon[k+2],polygon[k+1]);
                angle_one_poly.push(angle);
            }
            samplingData[j]['destination'] = Math.sqrt(d3.variance(angle_one_poly))/d3.mean(angle_one_poly);
            destination_value += std / mean;
        }
        else{
            samplingData[j]['destination'] = 0;
        }
        destination_angle+=samplingData[j]['destination'];
    }
    return {destination_angle, destination_value};
}

function destinationFun_angle_t(samplingData){
    const points_ = samplingData.map(v=>[v.x,v.y]);
    let delaunay = d3.Delaunay.from(points_);
    const {points, triangles} = delaunay;
    let destination_value = 0;
    for (let i = 0; i < (triangles.length - 2) / 3; i++) {
        let t0 = triangles[i * 3 + 0];
        let t1 = triangles[i * 3 + 1];
        let t2 = triangles[i * 3 + 2];
        let p=[[points[t0 * 2],points[t0 * 2 + 1]],[points[t1 * 2],points[t1 * 2 + 1]],[points[t2 * 2],points[t2 * 2 + 1]]];
        p.push(p[0]);
        p.push(p[1]);
        let angle_one_poly=[];//一个多边形的内角
        for(let k=0;k<p.length-2;k++){
            let angle = getAngle(p[k],p[k+2],p[k+1]);
            angle_one_poly.push(angle);
        }
        console.log((triangles.length - 0))
        samplingData[i]['destination'] = Math.sqrt(d3.variance(angle_one_poly))/d3.mean(angle_one_poly);
       
        destination_value+=samplingData[i]['destination'];
      }
   
    return destination_value;
}

function destinationFun_distance(samplingData){
    const points = samplingData.map(v=>[v.x,v.y]);
    let delaunay = d3.Delaunay.from(points);
    let voronoi = delaunay.voronoi([0,0,width,height]);
    let destination_value = 0;
    let length = [];
    for(let j=0;j<samplingData.length;j++){
        if(samplingData[j].children.length>1){
            let polygon=voronoi.cellPolygon(j);
            let length_one = [];
            for(let k=0;k<polygon.length-1;k++){
                // length_one.push(Math.sqrt(Math.pow(polygon[k][0]-samplingData[j]['x'],2)+Math.pow(polygon[k][1]-samplingData[j]['y'],2)));
                length_one.push(Math.sqrt(Math.pow(polygon[k][0]-polygon[k+1][0],2)+Math.pow(polygon[k][1]-polygon[k+1][1],2)));
            }
            let length_mean_one=d3.mean(length_one);
            let length_std_one=Math.sqrt(d3.variance(length_one));
            samplingData[j]['destination'] = length_std_one/length_mean_one;
        }
        else{
            samplingData[j]['destination'] = 0;
        }
        destination_value+=samplingData[j]['destination'];
    }
    //  let length_mean_one=d3.mean(length_one);
    //  let length_std_one=Math.sqrt(d3.variance(length));
    //  destination_value+=length_std_one///length_mean_one;
    return destination_value;
}

function SA(samplingData,originDataDic,destinationFun,top,T,maxIter,ccnt, decrease){
    let init_destination =  destinationFun(samplingData);
    let init_destination_angle = init_destination.destination_angle;
    let init_destination_value = init_destination.destination_value;
    let old_destination_angle = init_destination_angle;
    let old_destination_value = init_destination_value;
    let destination_value_array = [init_destination_angle];
    let state_arr = [];
    for(let iter=0;iter<maxIter;iter++){
        let new_disks = JSON.parse(JSON.stringify(samplingData));
        new_disks.sort((a,b)=>b['destination']-a['destination']);
        let count = parseInt(new_disks.length*top);
        for(let i=0;i<count;i++){
            let new_point_id = new_disks[i].children[Math.floor(Math.random()*new_disks[i].children.length)];
            new_disks[i].id = new_point_id;
            new_disks[i].lat = originDataDic[new_point_id].lat;
            new_disks[i].lng = originDataDic[new_point_id].lng;
            new_disks[i].x = originDataDic[new_point_id].x;
            new_disks[i].y = originDataDic[new_point_id].y;
        }
        let new_destination = destinationFun(new_disks);
        let new_destination_angle = new_destination.destination_angle;
        let new_destination_value = new_destination.destination_value;
        console.log(`iter:${iter},init_value:${init_destination_angle},current_value:${old_destination_angle},new_value:${new_destination_angle}`);
        if(new_destination_angle<=old_destination_angle && new_destination_value <= old_destination_value){
            samplingData=JSON.parse(JSON.stringify(new_disks));
            old_destination_value=new_destination_value;
            old_destination_angle=new_destination_angle;
            state_arr.push(1);
        }
        else{
            let p = Math.exp(-(new_destination_angle-old_destination_angle)/T);
            let random_rate = Math.random();
            if(random_rate<p){
                samplingData=JSON.parse(JSON.stringify(new_disks));
                old_destination_value=new_destination_value;
                old_destination_angle = new_destination_angle;
                state_arr.push(1);
            }
            else{
                state_arr.push(0);
            }
        }
        destination_value_array.push(old_destination_angle);
        T = T*decrease;
        if(state_arr.length<=ccnt){
            continue;
        }
        else{
            if(state_arr.slice(-ccnt).indexOf(1)<0){
                break;
            }
        }
    }
    return {new_disks:samplingData,destinationValueArray:{data:destination_value_array,maxIter,top,ccnt,T}};
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
