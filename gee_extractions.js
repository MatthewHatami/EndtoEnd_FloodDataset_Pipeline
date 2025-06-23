
var admin2 = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2");
var s1 = ee.ImageCollection("COPERNICUS/S1_GRD");
var gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
var hydrosheds = ee.Image("WWF/HydroSHEDS/03VFDEM");
var s2 = ee.ImageCollection("COPERNICUS/S2_SR");
// select images by preferred dates, if we know heavy rain has started at certain days before the flood event
// consdier choosing the "before" image from before that time.

// current code is written for the Valencia, Spain flood in October 2024
// You can read more about this flood at this link: https://earthobservatory.nasa.gov/images/153533/valencia-floods


var before_start = '2024-10-01'
var before_end = '2024-10-25'

var after_start = '2024-11-01'
var after_end = '2024-11-15'


// we use Global Administrative Unit Layer(GAUL) to use boundaries shapefile of 
// choose areas from admin boundaries level 2 that we have already imported
var valencia = admin2.filter(ee.Filter.eq('ADM2_NAME', 'Valencia/València'))
var geometry = valencia.geometry()





// $$$$$$$$$$$$$$$$$$$$ Adding Sentinel-2 data as basemap
var img_rgb = s2.select(['B4', 'B3', 'B2']).filterDate('2022-05-01', '2022-05-30')
var img_rgb = img_rgb.mosaic().clip(geometry)
Map.addLayer(img_rgb, {min:0, max:3000, bands:['B4', 'B3', 'B2'], gamma:1.4}, 'Satellite_rgb')




// $$$$$$$$$$$$$$$$$$$$



//Map.addLayer(admin2)


// we import image collection for Sentinel-1 from Copernicus/S1_GRD


// before filtering the images we can check the first image of this image collection and see
// the characteristics of this image like the modes and bands
var filtered_ = s1 //this is an image collection
//print(filtered_.first())  // we can call .first() on an image collection to see its first image


// ------> Instrument mode and polarization filters (1, 2, 3)
// running code till the previous line will give us some information, we can see the bands as HH and HV,
// and in the properties we can see the intrumentMode as EW, these are not exactly what we want, 
// so we apply some tickets to get the bands (VV, VH) and instrument mode we want (IW)


// ------> Orbit pass filter (4)
// one more thing that we should consider is the orbit pass of the images. they can be captured
// in ascending or descending modes, but we don't want to mix those together since they have 
// different characteristics. so we also filter the image collection on one of these orbit passes


// ------> Resolution filter (5)
// images can be captured in different resolutions, its mostly 10 meters for SAR images but to make sure we apply this filter
// to keep all the images with the same resolution

// -----> region filter
// to filter it to our area of interest


var filtered = s1
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filter(ee.Filter.eq('resolution_meters', 10))
  .filter(ee.Filter.bounds(geometry))
  .select(['VV'])
  
  
  
  
//print(filtered.first())

// temporal filter
var beforeCollection = filtered.filter(ee.Filter.date(before_start, before_end))
print('before= ', beforeCollection)

var afterCollection = filtered.filter(ee.Filter.date(after_start, after_end))
print('after= ', afterCollection)


// checking the console we can see that we have 3 images in the "before" image collection, and 1 image in "after image collection
// when we have more than one image we can take different approaches, 
// in optical images since the mean can be affected by presence or absence of clouds, we should use "median" filter
// in sentinel 1 images, since the presence of clouds doesn't affect the pixel values we can use either "mean" or "median"
// another option is making a mosaic which takes the latest values of each pixel in overlaying images


// so all of the options above (mean, median, mosaic) turn an ImageCollection into a single image
// in case of the after Image Collection, although we have only one image, but it's still an ImageCollection
// and we can't clip an ImageCollection, so we apply mosaic on that as well, to make it a single image
var before = beforeCollection.mosaic().clip(geometry)
var after = afterCollection.mosaic().clip(geometry)


// now each of before/afterRGB images are single images with 3 bands, so we can visualize them
// in SAR images the pixel values are usually negative and a min of -25 and max of 0 would give a good visualization

var visParams = {
  min: -25,
  max: 0
}

// now we can visualize them and add them to the map
Map.addLayer(before, visParams, 'Before')
Map.addLayer(after, visParams, 'After')

// now starting from the most inner paranthesis, we first apply the toNatural function to our image to change it to Natural Units,
// then the output of that is used as input for RefinedLee function, and the output of RefinedLee is passed through the toDB function
// to have it back in decibel function

var beforeSmoothed = toDB(RefinedLee(toNatural(before)))
var afterSmoothed = toDB(RefinedLee(toNatural(after)))

Map.addLayer(beforeSmoothed, visParams, 'Before Smoothed')
Map.addLayer(afterSmoothed, visParams, 'After Smoothed')




// we can now define a threshold to find the flooded pixels
var difference = afterSmoothed.divide(beforeSmoothed);


//we optimize this value by checking the result with comparing before & after maps
var diffThreshold = 1.20 


// now we can calculate an initial estimation for flooded area


// to this flooded layer we also apply a selfMask() so 0 values would be removed
var flooded = difference.gt(diffThreshold).rename('water').selfMask()
Map.addLayer(flooded, {min:0, max:1, palette: ['orange']}, 'Initial Flood Estimate')



// now we can remove the permenant waters that might have been mistakenly labelled as flood
// for that purpose, we can use a JRC Global Surface Water Mapping (gsw)
var permanentWater = gsw.select('seasonality').gte(6).clip(geometry)

// in previous line we imported a layer for permanent water
// where there is water in 6 or more seasons in a year

// we can give a value of 0 to all pixels of permanent water and mask them out
var flooded = flooded.where(permanentWater, 0).selfMask()
Map.addLayer(permanentWater.selfMask(), {min:0, max:1, palette: ['blue']}, 'Permanent Water')



// something else we need to mask out is where the slope is more
// than 5% because water wont stay there 
// to have a DEM we can use the WWF HydroSHEDS Void-Filled

// now we can mask out where slope is less than slope threshold
// HINT: whatever comes inside updateMask(HERE) will be kept visible
var slopeThreshold = 5;
var terrain = ee.Algorithms.Terrain(hydrosheds);
var slope = terrain.select('slope');
var flooded = flooded.updateMask(slope.lt(slopeThreshold));






Map.addLayer(slope.gte(slopeThreshold).selfMask(), {min:0, max:1, palette: ['cyan']}, 'Steep Areas', false)




// Remove isolated pixels
// connectedPixelCount is Zoom dependent, so visual result will vary
var connectedPixelThreshold = 16;
var connections = flooded.connectedPixelCount()
var flooded = flooded.updateMask(connections.gt(connectedPixelThreshold))
Map.addLayer(connections.lte(connectedPixelThreshold).selfMask(), {min:0, max:1, palette: ['yellow']}, 'Disconnected Areas', false)

Map.addLayer(flooded, {min:0, max:1, palette: ['red']}, 'Flooded Areas');



var stats = flooded.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: geometry,
  scale: 30,
  maxPixels: 1e10,
  tileScale: 16
})
print('Flooded Area (Ha)', ee.Number(stats.get('water')).divide(10000))


// Convert the flooded raster to vectors (polygons)
var floodedVectors = flooded.reduceToVectors({
  geometry: geometry,
  scale: 10,
  geometryType: 'polygon',
  eightConnected: true,
  maxPixels: 1e13
});

// Export the vector data as a shapefile
Export.table.toDrive({
  collection: floodedVectors,
  description: 'Flood_Extent_Shapefile',
  fileFormat: 'SHP'
});


// Export the before image
Export.image.toDrive({
  image: before,
  description: 'Before_SAR_Image',
  scale: 10,
  region: geometry,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});

// Export the after image
Export.image.toDrive({
  image: after,
  description: 'After_SAR_Image',
  scale: 10,
  region: geometry,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});

// Export the flood mask
Export.image.toDrive({
  image: flooded,
  description: 'Flood_Mask',
  scale: 10,
  region: geometry,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});

// Export the permanent water layer
Export.image.toDrive({
  image: permanentWater,
  description: 'Permanent_Water_Layer',
  scale: 10,
  region: geometry,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});



//########################################################################
// Speckle Filtering Function (removing salt pepper noise from SAR images)
//########################################################################

// to do so, we use the Refined Lee filter developed by Guido Lemoine
// there is a function for it that we can use in our codes when working with SAR data

// the problem is though, the input to RefinedLee function should be an image in natural units, but our image is in dB,
// so we also have 2 functions to change the image to natural and back to dB

function toNatural(img) {
  return ee.Image(10.0).pow(img.select(0).divide(10.0));
}

//Function to convert to dB
function toDB(img) {
  return ee.Image(img).log10().multiply(10.0);
}

//Apllying a Refined Lee Speckle filter as coded in the SNAP 3.0 S1TBX:

//https://github.com/senbox-org/s1tbx/blob/master/s1tbx-op-sar-processing/src/main/java/org/esa/s1tbx/sar/gpf/filtering/SpeckleFilters/RefinedLee.java
//Adapted by Guido Lemoine

// by Guido Lemoine
function RefinedLee(img) {
  // img must be in natural units, i.e. not in dB!
  // Set up 3x3 kernels 
  var weights3 = ee.List.repeat(ee.List.repeat(1,3),3);
  var kernel3 = ee.Kernel.fixed(3,3, weights3, 1, 1, false);

  var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
  var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);

  // Use a sample of the 3x3 windows inside a 7x7 windows to determine gradients and directions
  var sample_weights = ee.List([[0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0]]);

  var sample_kernel = ee.Kernel.fixed(7,7, sample_weights, 3,3, false);

  // Calculate mean and variance for the sampled windows and store as 9 bands
  var sample_mean = mean3.neighborhoodToBands(sample_kernel); 
  var sample_var = variance3.neighborhoodToBands(sample_kernel);

  // Determine the 4 gradients for the sampled windows
  var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
  gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
  gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
  gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());

  // And find the maximum gradient amongst gradient bands
  var max_gradient = gradients.reduce(ee.Reducer.max());

  // Create a mask for band pixels that are the maximum gradient
  var gradmask = gradients.eq(max_gradient);

  // duplicate gradmask bands: each gradient represents 2 directions
  gradmask = gradmask.addBands(gradmask);

  // Determine the 8 directions
  var directions = sample_mean.select(1).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
  directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
  directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
  directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
  // The next 4 are the not() of the previous 4
  directions = directions.addBands(directions.select(0).not().multiply(5));
  directions = directions.addBands(directions.select(1).not().multiply(6));
  directions = directions.addBands(directions.select(2).not().multiply(7));
  directions = directions.addBands(directions.select(3).not().multiply(8));

  // Mask all values that are not 1-8
  directions = directions.updateMask(gradmask);

  // "collapse" the stack into a singe band image (due to masking, each pixel has just one value (1-8) in it's directional band, and is otherwise masked)
  directions = directions.reduce(ee.Reducer.sum());  

  //var pal = ['ffffff','ff0000','ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', '000000'];
  //Map.addLayer(directions.reduce(ee.Reducer.sum()), {min:1, max:8, palette: pal}, 'Directions', false);

  var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));

  // Calculate localNoiseVariance
  var sigmaV = sample_stats.toArray().arraySort().arraySlice(0,0,5).arrayReduce(ee.Reducer.mean(), [0]);

  // Set up the 7*7 kernels for directional statistics
  var rect_weights = ee.List.repeat(ee.List.repeat(0,7),3).cat(ee.List.repeat(ee.List.repeat(1,7),4));

  var diag_weights = ee.List([[1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0], 
    [1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]]);

  var rect_kernel = ee.Kernel.fixed(7,7, rect_weights, 3, 3, false);
  var diag_kernel = ee.Kernel.fixed(7,7, diag_weights, 3, 3, false);

  // Create stacks for mean and variance using the original kernels. Mask with relevant direction.
  var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
  var dir_var = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));

  dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
  dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));

  // and add the bands for rotated kernels
  for (var i=1; i<4; i++) {
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
  }

  // "collapse" the stack into a single band image (due to masking, each pixel has just one value in it's directional band, and is otherwise masked)
  dir_mean = dir_mean.reduce(ee.Reducer.sum());
  dir_var = dir_var.reduce(ee.Reducer.sum());

  // A finally generate the filtered value
  var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));

  var b = varX.divide(dir_var);

  var result = dir_mean.add(b.multiply(img.subtract(dir_mean)));
  return(result.arrayFlatten([['sum']]));
}



