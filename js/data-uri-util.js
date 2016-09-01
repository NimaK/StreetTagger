var dataUriUtil = (function() {
    
    /* sliceSize property */
    var sliceSize = 1024;
    
    function setSliceSize(size) {
        sliceSize = size;
    }
    
    /* doSlice property */
    var doSlice;
    
    function setDoSlice(doSlice) {
        doSlice = doSlice;
        //doSlice ? 
        getBlobData = doSlice ? getBlobDataAtOnce : getBlobDataSliced;
    }
    
    /*
     * Gets the MIME/content type string from the beginning of the data URI
     */
    function getContentType(dataUriString) {
        if  (!(typeof(dataUriString) === 'string' || dataUriString instanceof String)) {
            return;
        }
        
        var re = /data:(.*);/;
        var result = re.exec(dataUriString);

        if (result && result[1]) {
            return result[1];
        }
    }
    
    /*
     * Gets the actual data, in base 64, from the data URI
     */
    function getBase64Data(dataUriString) {
        if (dataUriString && dataUriString.split) {
            var splitResults = dataUriString.split(';base64,');
            
            return splitResults[1];
        }
    }
    
    // The following blob functions are from:
    // http://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
    // with a few modifications
    /*
     * Get blob data in one slice.
     * => Fast in IE on new Blob(...)
     */
    function getBlobDataAtOnce(byteCharacters) {
        var byteNumbers = new Array(byteCharacters.length);

        for (var i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        return [byteArray];
    }

    /*
     * Get blob data in multiple slices.
     * => Slow in IE on new Blob(...)
     */
    function getBlobDataSliced(byteCharacters) {

        var slice,
            byteArrays = [],
            byteNumbers,
            byteArray;

        for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            slice = byteCharacters.slice(offset, offset + sliceSize);

            byteNumbers = new Array(slice.length);

            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            byteArray = new Uint8Array(byteNumbers);

            // Add slice
            byteArrays.push(byteArray);
        }

        return byteArrays;
    }
    
    function base64toBlob(base64Data, contentType) {

        var byteCharacters,
            //byteArray,
            //byteNumbers,
            blobData,
            blob;

        contentType = contentType || '';

        byteCharacters = atob(base64Data);

        // Get blob data sliced or not
        blobData = getBlobData(byteCharacters);

        blob = new Blob(blobData, { type: contentType });

        return blob;
    }
    
    /*
     * Convenience function - equivalent to base64toBlob(getBase64Data(data), getContentType(data))
     */
    function dataUriBase64ToBlob(b64DataUri) {
        var contentType = getContentType(b64DataUri);
        var b64Data = getBase64Data(b64DataUri);
        
        return base64toBlob(b64Data, contentType);
    }
    
    
    // from http://stackoverflow.com/questions/19999388/check-if-user-is-using-ie-with-jquery
    /**
     * detect IE
     * returns version of IE or false, if browser is not Internet Explorer
     */
    function detectIE() {
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
           // Edge (IE 12+) => return version number
           return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
    }
    
    // by default IE will use non-sliced function, others will use sliced
    // unless doSliced is changed by setter function
    var getBlobData = detectIE() ? getBlobDataAtOnce : getBlobDataSliced;
    
    
    // reveal public functions
    return {
        getContentType: getContentType,
        getBase64Data: getBase64Data,
        base64toBlob: base64toBlob,
        dataUriBase64ToBlob: dataUriBase64ToBlob,
        setSliceSize: setSliceSize,
        setDoSlice: setDoSlice
    }
    
})();
