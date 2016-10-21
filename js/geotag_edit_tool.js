
function CoordEditorViewModel() {
    var viewModel = this;
    this.origLat = ko.observable();
    this.origLng = ko.observable();
    this.newLat = ko.observable().extend({ numeric: 8 });
    this.newLng = ko.observable().extend({ numeric: 8 });
    this.orientation = ko.observable();
    
    this.isEdited = ko.observable(false);
    this.hasGeotags = ko.observable(false);
    
    this.origPosMarker = null;
    this.origPosMarkerPano = null;
    this.editableMarker = null;
    this.editableMarkerPano = null;
    
    this.exifData = null;
    this.image = null;
    this.filename = null;
    this.isImgLoading = ko.observable(false);
    
    this.newLat.subscribe(function(newLatVal) {
        this.isEdited(true);
        
        if (viewModel.editableMarker) {
            var newLat = new Number(newLatVal);
            // sync viewModel pos with editableMarker (which triggers editableMarkerPano pos to sync)
            viewModel.editableMarker.setPosition({
                'lat': newLat.valueOf(),
                'lng': viewModel.editableMarker.getPosition().lng()
            });
        }
    }, viewModel);
    
    // TODO - above and below are nearly identical - fix?
    this.newLng.subscribe(function(newLngVal) {
        this.isEdited(true);
        
        if (viewModel.editableMarker) {
            var newLng = new Number(newLngVal);
            // sync viewModel pos with editableMarker (which triggers editableMarkerPano pos to sync)
            viewModel.editableMarker.setPosition({
                'lat': viewModel.editableMarker.getPosition().lat(),
                'lng': newLng.valueOf()
            });
        }
    }, viewModel);
    
    this.clear = function() {
        this.origPosMarker && this.origPosMarker.setMap(null);
        this.origPosMarkerPano && this.origPosMarkerPano.setMap(null);
        this.editableMarker && this.editableMarker.setMap(null);
        this.editableMarkerPano && this.editableMarkerPano.setMap(null);
        
        this.origPosMarker = null;
        this.origPosMarkerPano = null;
        this.editableMarker = null;
        this.editableMarkerPano = null;
        
        this.origLat(null);
        this.origLng(null);
        this.newLat(null);
        this.newLng(null);
        this.orientation(null);

        this.exifData = null;
        this.image = null;
        this.filename = null;
        this.isEdited(false);
        
        clearCurrentImageDisplay();
    }
    
    this.uploadEvent = function(viewmodel, event) {
        var uploadInput = event.target;
        viewmodel.clear();
        if (uploadInput.files && uploadInput.files[0]) {
            var file = event.target.files[0];
            viewmodel.filename = file.name;
            viewmodel.isImgLoading(true);
            var reader = new FileReader();
            reader.onload = onFileReaderLoad;
            reader.readAsDataURL(file);
        }
    }
    
    this.resetImage = function(event) {
        // note: only for images with geotags (hasGeotags())
        this.newLat(this.origLat());
        this.newLng(this.origLng());
        
        var pos = {lat: this.origLat(), lng: this.origLng()};
        var zoom = 12;
        map.panTo(pos);
        map.setZoom(zoom);
        streetview.setPosition(pos);
        streetview.setVisible(true);
    }
    
    this.loadData = function(fileReader) {
        try {
            this.exifData = piexif.load(fileReader.result);
        } catch(e) {
            console.log('Error: invalid file type');
            alert('Error reading file. Please use an image supporting EXIF data (e.g. .jpeg or .tiff)');
            throw new TypeError('Invalid file');
        }
        var lat = dmsToDecimal(this.exifData.GPS[piexif.GPSIFD.GPSLatitude], this.exifData.GPS[piexif.GPSIFD.GPSLatitudeRef]);
        var lng = dmsToDecimal(this.exifData.GPS[piexif.GPSIFD.GPSLongitude], this.exifData.GPS[piexif.GPSIFD.GPSLongitudeRef]);
        var orientation = this.exifData['0th'][piexif.ImageIFD.Orientation];
        
        viewModel.origLat(lat);
        viewModel.origLng(lng);
        viewModel.newLat(lat);
        viewModel.newLng(lng);
        viewModel.orientation(orientation);
        viewModel.hasGeotags((lat && lng) ? true : false);
    }
    
    this.downloadImage = function() {
        // update EXIF data with new location
        var lat = decimalToDms(viewModel.newLat(), true);
        var lng = decimalToDms(viewModel.newLng(), false);
        
        this.exifData.GPS[piexif.GPSIFD.GPSLatitude] = lat.DMS;
        this.exifData.GPS[piexif.GPSIFD.GPSLatitudeRef] = lat.direction;
        this.exifData.GPS[piexif.GPSIFD.GPSLongitude] = lng.DMS;
        this.exifData.GPS[piexif.GPSIFD.GPSLongitudeRef] = lng.direction;
        
        var exifBytes = piexif.dump(this.exifData);
        var newImage = piexif.insert(exifBytes, this.image.src);
        
        var imgBlob = dataUriUtil.dataUriBase64ToBlob(newImage);
        var imgUrl = URL.createObjectURL(imgBlob);
        var dl = $('<a>')
            .attr('href', imgUrl)
            .attr('download', this.filename);
        $('#download_div').empty().append(dl);
        dl[0].click();
    }
    
    function onFileReaderLoad() {
        viewModel.loadData(this);
        
        var pos, zoom;
        if (!viewModel.hasGeotags()) {
            pos = map.getCenter();
            zoom = map.getZoom();
            viewModel.newLat(pos.lat());
            viewModel.newLng(pos.lng());
        }
        else {
            pos = {lat: viewModel.origLat(), lng: viewModel.origLng()};
            zoom = 14;
        }
        
        var markers = setupMapViews(pos, zoom, viewModel.hasGeotags());
        viewModel.origPosMarker = markers.origPosMarker;
        viewModel.origPosMarkerPano = markers.origPosMarkerPano;
        viewModel.editableMarker = markers.editableMarker;
        viewModel.editableMarkerPano = markers.editableMarkerPano;
        
        // setup marker listeners (map, streetview, and viewmodel need to be in sync)
        // - editableMarker change -> triggers update on editablePanoMarker
        // - editableMarker change -> triggers update on viewModel newLat/newLng
        // - editablePanoMarker change -> triggers update on editableMarker
        // - newLat/newLng change -> triggers update on editableMarker (via KO observable subscribe)
        
        viewModel.editableMarker.addListener('position_changed', function() {
            // update street view marker
            // check if position has already been synced
            // (listeners and subscribers call each other)
            // prevent from change propagating forever 
            if ((!this.position.lat() || !this.position.lng()) ||
                (viewModel.editableMarkerPano.getPosition().equals(this.position))) {
                return;
            }
            viewModel.editableMarkerPano.setPosition(this.position);
        });
        viewModel.editableMarkerPano.addListener('position_changed', function() {
            // update map marker
            // check if position has already been synced
            // (listeners and subscribers call each other)
            // prevent from change propagating forever 
            if ((!this.position.lat() || !this.position.lng()) ||
                (viewModel.editableMarker.getPosition().equals(this.position))) {
                return;
            }
            viewModel.editableMarker.setPosition(this.position);
        });
        viewModel.editableMarker.addListener('position_changed', function() {
            // update viewmodel
            // check if position has already been synced
            // (listeners and subscribers call each other)
            // prevent from change propagating forever 
            var lat = new Number(viewModel.newLat());
            var lng = new Number(viewModel.newLng());
            var vmPos = new google.maps.LatLng({lat: lat.valueOf(), lng: lng.valueOf()});
            if ((!this.position.lat() || !this.position.lng()) ||
                (this.position.equals(vmPos))) {
                return;
            }
            viewModel.newLat(this.position.lat());
            viewModel.newLng(this.position.lng());
        });
        
        var image = new Image();
        image.src = this.result;
        viewModel.image = image;
        updateCurrentImageDisplay(image, {'exifOrientation': viewModel.orientation()});
        viewModel.isImgLoading(false);
    };
}

ko.extenders.numeric = function(target, precision) {
    //create a writable computed observable to intercept writes to our observable
    var result = ko.pureComputed({
        read: target,  //always return the original observables value
        write: function(newValue) {
            var current = target(),
                roundingMultiplier = Math.pow(10, precision),
                newValueAsNum = isNaN(newValue) ? 0 : +newValue,
                valueToWrite = Math.round(newValueAsNum * roundingMultiplier) / roundingMultiplier;
 
            //only write if it changed
            if (valueToWrite !== current) {
                target(valueToWrite);
            } else {
                //if the rounded value is the same, but a different value was written, force a notification for the current field
                if (newValue !== current) {
                    target.notifySubscribers(valueToWrite);
                }
            }
        }
    }).extend({ notify: 'always' });
 
    //initialize with current value to make sure it is rounded appropriately
    result(target());
 
    //return the new computed observable
    return result;
};

ko.applyBindings(new CoordEditorViewModel());


function setupMapViews(pos, zoom, hasOrigPos) {
    map.panTo(pos);
    map.setZoom(zoom);
    streetview.setPosition(pos);
    streetview.setVisible(true);
    
    if (hasOrigPos) {
        var origPosMarker = new google.maps.Marker({
            position:pos, 
            map: map, 
            title: 'Original Position'
        });
        var origPosMarkerPano = new google.maps.Marker({
            position:pos, 
            map: streetview, 
            title: 'Original Position'
        });
    }
    var editableMarker = new google.maps.Marker({
        position:pos, 
        map: map,
        draggable: true,
        label: 'X'
    });
    var editableMarkerPano = new google.maps.Marker({
        position:pos, 
        map: streetview,
        draggable: true,
        label: 'X'
    });
    return {
        'origPosMarker': origPosMarker,
        'origPosMarkerPano': origPosMarkerPano,
        'editableMarker': editableMarker,
        'editableMarkerPano': editableMarkerPano
    };
}

function updateCurrentImageDisplay(image, imageProps) {
    $('#original_coords').show();
    $('#editable_coords').show();
    
    // display the uploaded image
    $('#current_image').css('background-image', 'url("'+image.src+'")');
    
    // rotate image based on EXIF orientation 
    var orientation = imageProps && imageProps.exifOrientation ? imageProps.exifOrientation : 1;
    var rotateBy = '';
    var scaleBy = null;
    if (orientation !== 1) {
        if (orientation === 3) {
            rotateBy = '180deg';
            $('#current_image').css('transform', 'rotate('+rotateBy+')');
        }
        else if (orientation === 6) {
          rotateBy = '90deg';
          // scale by container's height/width to keep it within containing element
          scaleBy = $('.image_container').height()/$('.image_container').width();
          //TODO-also need to rescale on window resize
        }
        else if (orientation === 8) {
          rotateBy = '-90deg';
          scaleBy = $('.image_container').height()/$('.image_container').width();
        }
        
        var transformSettings = 'rotate('+rotateBy+')';
        if (scaleBy) {
          transformSettings += ' scale('+scaleBy+')';
        }
        $('#current_image').css('transform', transformSettings);
    }
}

function clearCurrentImageDisplay() {
    $('#original_coords').hide();
    $('#editable_coords').hide();
    $('#current_image').css('background-image', 'none');
    $('#current_image').css('transform', '');
}

function stepByStepGuide() {
    $('#upload_image').tooltip('show');
}

function initGuide() {
    var template = $('<div>').addClass('tooltip-content')
        .append($('<button>').addClass('tooltip-button').append(
            $('<span>').addClass('fa fa-times')
        ))
        .append($('<button>').addClass('tooltip-button').append(
            $('<span>').addClass('fa fa-caret-right')
        ));
    // Step 1
    $('#upload_image').tooltip({
        trigger: 'manual', 
        placement: 'top',
        html: true,
        title: function() {
            var content = template.clone();
            content.find('button').has('span.fa-times').click(function() {
                $('#upload_image').tooltip('hide');
            });
            content.find('button').has('span.fa-caret-right').click(function() {
                $('#upload_image').tooltip('hide');
                $('#map').tooltip('show');
            });
            content.append('Select the image file that you want to update (jpeg or tiff)');
            return content;
        }
    });
    // Step 2
    $('#map').tooltip({
        trigger: 'manual', 
        placement: 'bottom',
        html: true,
        title: function() {
            var content = template.clone();
            content.find('button').has('span.fa-times').click(function() {
                $('#map').tooltip('hide');
            });
            content.find('button').has('span.fa-caret-right').click(function() {
                $('#map').tooltip('hide');
                $('#pano').tooltip('show');
            });
            content.append('Drag and drop the marker (with an "X") to the location where you want the photo to be set');
            return content;
        }
    });
    // Step 3
    $('#pano').tooltip({
        trigger: 'manual', 
        placement: 'right',
        html: true,
        title: function() {
            var content = template.clone();
            content.find('button').has('span.fa-times').click(function() {
                $('#pano').tooltip('hide');
            });
            content.find('button').has('span.fa-caret-right').click(function() {
                $('#pano').tooltip('hide');
                $('#download_image').tooltip('show');
            });
            content.append('You can use the Street View to compare how your photo\'s location compares to the one on Google Maps (Street View is not available in all locations)');
            return content;
        }
    });
    // Step 4
    $('#download_image').tooltip({
        trigger: 'manual', 
        placement: 'top',
        html: true,
        title: function() {
            var content = template.clone();
            content.find('button').has('span.fa-times').click(function() {
                $('#download_image').tooltip('hide');
            });
            content.find('button').has('span.fa-caret-right').remove();
            content.append('Click Download to save your image with the coordinates of the new location (stored in the image\'s EXIF GPS metadata)');
            return content;
        }
    });
}
