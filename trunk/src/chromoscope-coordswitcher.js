/*
 * Chromoscope Coordinate Switcher
 * Written by Stuart Lowe
 *
 * You can add a "tiles_eq" option to chromo.addWavelength({tiles_eq:"directory/"})
 * "tiles_eq" has the same format as "tiles" but specifies directories for the 
 * Equatorial projection. Ways to call:
 *  1) press the ',' key
 *  2) chromo.switchCoordinateSystem('G');
 *  3) chromo.switchCoordinateSystem('A');
 *
 * Changes in version 1.0 (2013-03-19):
 *   - created
 */


(function ($) {

	function init(chromo) {

		chromo.switchCoordinateSystem = function(coord){
			this.coordinate.system = coord;
			this.coordinate.active = coord;

			for(var s = 0; s < this.spectrum.length; s++){
				if(coord == "A"){
					if(!this.spectrum[s].tiles_gal) this.spectrum[s].tiles_gal = this.spectrum[s].tiles;
					if(this.spectrum[s].tiles_eq) this.spectrum[s].tiles = this.spectrum[s].tiles_eq;
				}else{
					if(this.spectrum[s].tiles_gal) this.spectrum[s].tiles = this.spectrum[s].tiles_gal;
				}				
			}
			console.log(this.spectrum[2].tiles)
			this.updateCoords();
			this.updateImages();
		}


		chromo.updateImages = function(){
		
			var visibleTiles = this.previousTiles;

			// Create an array of indices to layers that we will load
			var layers = new Array();

			// Set an array index
			var l = 0;

			// We want to load the nearest wavelength first
			// followed by the next nearest and then any that
			// are left but not currently visible.
			layers[l++] = Math.round(this.lambda);

			// Step out from the nominal wavelength to pre-load
			// other wavelengths as set by chromo.wavelength_load_range
			if(this.wavelength_load_range > 0){
				for(var w = 1; w <= this.wavelength_load_range ; w++){
					// Check if the lower wavelength is required
					if(layers[0]-w >= this.minlambda) layers[l++] = layers[0]-w;
					// Check if the higher wavelength is required
					if(layers[0]+w <= this.maxlambda) layers[l++] = layers[0]+w;
				}
			}

			this.visibleTilesMap = new Array(visibleTiles.length*layers.length);

			var counter = 0;

			// Work out the x,y pixel values for the user-defined range
			var pixels = Math.pow(2, this.zoom)
			
			// Loop over all the layers we've pre-selected
			for(var l = 0 ; l < layers.length ; l++){
				output = "";
				var idx = layers[l];

				// Loop over all the tiles that we want to load
				for (var v = 0; v < visibleTiles.length; v++, counter++) {
					if(idx >= 0) tileName = this.id+"_"+this.spectrum[idx].name+"x" + visibleTiles[v].x + "y" + visibleTiles[v].y + "z"+this.zoom;
					else tileName = this.id+"_"+this.annotations[-(idx+1)].name+"x" + visibleTiles[v].x + "y" + visibleTiles[v].y + "z"+this.zoom;

					this.visibleTilesMap[counter] = tileName;

					var tiles = this.spectrum[idx].tiles;
					tiles = (typeof tiles=="string") ? tiles : (typeof tiles["z"+this.zoom]=="string") ? tiles["z"+this.zoom] : tiles.z;
					var img = (inrange) ? this.cdn+tiles+visibleTiles[v].src+'.'+this.spectrum[idx].ext : this.spectrum[idx].blank;

					$('#'+tileName).attr('src',img);
				}
			}
		}

		chromo.registerKey(',',function(){
			this.switchCoordinateSystem((this.coordinate.system == 'G') ? 'A' : 'G');
		});

	}


	$.chromoscope.plugins.push({
		init: init,
		name: 'coordswitcher',
		version: '1.0'
	});
})(jQuery);

