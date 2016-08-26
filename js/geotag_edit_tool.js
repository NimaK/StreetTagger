
function CoordEditorViewModel() {
    var viewModel = this;
    this.origLat = ko.observable();
    this.origLng = ko.observable();
    this.newLat = ko.observable();
    this.newLng = ko.observable();
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
    
    this.newLat.subscribe(function(newLatVal) {
        this.isEdited(true);
        // TODO form validation on newLat field - does not belong here...?
        if (viewModel.editableMarker) {
            var newLat = new Number(newLatVal);
            // only change if editableMarker has already been created
            // marker position may be changed twice (position_changed event calls this method, does setPosition with same value - but position_changed only triggered once)
            viewModel.editableMarker.setPosition({
                'lat': newLat.valueOf(),
                'lng': viewModel.editableMarker.getPosition().lng()
            });
        }
    }, viewModel);
    
    // TODO fix - above and below are nearly identical
    this.newLng.subscribe(function(newLngVal) {
        this.isEdited(true);
        // TODO form validation on newLng field - does not belong here...?
        if (viewModel.editableMarker) {
            var newLng = new Number(newLngVal);
            // only change if editableMarker has already been created
            // marker position may be changed twice (position_changed event calls this method, does setPosition with same value - but position_changed only triggered once)
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
        console.log('download image');
        // update EXIF data with new location
        var lat = decimalToDms(viewModel.newLat(), true);
        var lng = decimalToDms(viewModel.newLng(), false);
        
        this.exifData.GPS[piexif.GPSIFD.GPSLatitude] = lat.DMS;
        this.exifData.GPS[piexif.GPSIFD.GPSLatitudeRef] = lat.direction;
        this.exifData.GPS[piexif.GPSIFD.GPSLongitude] = lng.DMS;
        this.exifData.GPS[piexif.GPSIFD.GPSLongitudeRef] = lng.direction;
        
        var exifBytes = piexif.dump(this.exifData);
        var newImage = piexif.insert(exifBytes, this.image.src);
        
        var dl = $('<a>')
            .attr('href', newImage)
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
            zoom = 12;
        }
        
        var markers = setupMapViews(pos, zoom, viewModel.hasGeotags());
        viewModel.origPosMarker = markers.origPosMarker;
        viewModel.origPosMarkerPano = markers.origPosMarkerPano;
        viewModel.editableMarker = markers.editableMarker;
        viewModel.editableMarkerPano = markers.editableMarkerPano;
        
        viewModel.editableMarker.addListener('position_changed', function() {
            // update viewmodel
            viewModel.newLat(this.position.lat());
            viewModel.newLng(this.position.lng());
        });
        var image = new Image();
        image.src = this.result;
        viewModel.image = image;
        updateCurrentImageDisplay(image, {'exifOrientation': viewModel.orientation()});
    };
}

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
        console.log(orientation);
        if (orientation === 3) {
            rotateBy = '180deg';
            $('#current_image').css('transform', 'rotate('+rotateBy+')');
        }
        // TODO: currently transformation by 90 doesn't work as desired
        else if (orientation === 6) {
          rotateBy = '90deg';
          //TODO - look into a better way to do this 
          // image rotates outside containing div (height too tall)
          // scale by container's height/width
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
}