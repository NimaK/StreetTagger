
function dmsToDecimal(dmsArray, direction) {
    if (!dmsArray) {
        return null;
    }
    //input is array of arrays
    var deg = dmsArray[0][0] / dmsArray[0][1];
    var min = dmsArray[1][0] / dmsArray[1][1];
    var sec = dmsArray[2][0] / dmsArray[2][1];
    var degrees = deg + (min / 60) + (sec / 3600);
    if (direction.match(/^(S|W)$/)) {
        degrees = degrees * -1;
    }
    
    return degrees;
}

function decimalToDms(decDegrees, isLat) {
    var dmsArray = [];
    var direction;
    
    if (decDegrees < 0) {
        direction = isLat ? 'S' : 'W';
        decDegrees = decDegrees * -1;
    }
    else {
        direction = isLat ? 'N' : 'E';
    }
    
    var deg = Math.floor(decDegrees);
    var min = Math.floor(60 * (decDegrees - deg));
    var sec = (3600 * (decDegrees - deg)) - (60 * min);
    
    dmsArray.push([deg, 1]);
    dmsArray.push([min, 1]);
    dmsArray.push([sec * 100, 100]);
    
    return {'DMS': dmsArray, 'direction': direction};
}

function formatCoord(degrees) {
    if (degrees == undefined) {
        return 'None';
    }
    return degrees.toFixed(8);
}