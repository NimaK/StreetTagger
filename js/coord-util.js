
function dmsToDecimal(dmsArray, direction) {
    if (!dmsArray) {
        return null;
    }
    //input is array of arrays
    var deg = dmsArray[0][0] / dmsArray[0][1];
    var min = dmsArray[1][0] / dmsArray[1][1];
    var sec = dmsArray[2][0] / dmsArray[2][1];
    console.log(sec);
    console.log(sec/3600);
    var degrees = deg + (min / 60) + (sec / 3600);
    if (direction.match(/^(S|W)$/)) {
        degrees = degrees * -1;
    }
    
    return degrees;
}