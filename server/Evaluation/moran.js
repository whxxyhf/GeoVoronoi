const sylvester = require('sylvester');
function moran(M, X){
    var M = $M(M);
    var X = $V(X);
    var x_mean = X.sum() / X.cols();
    console.log(X, X.subtract(x_mean),X.subtract(x_mean).transpose().canMultiplyFromLeft(M), X.subtract(x_mean).dot(X.subtract(x_mean)))
    return X.subtract(x_mean).transpose().multiply(M).dot(X.subtract(x_mean)) / X.subtract(x_mean).dot(X.subtract(x_mean));
}

var w = [
    [0, 1, 1, 0, 0],
    [1, 0, 1, 1, 0],
    [1, 1, 0, 1, 0],
    [0, 1, 1, 0, 1],
    [0, 0, 0, 1, 0]
]
var x = [8, 6, 6, 3, 2]

console.log(moran(w,x));