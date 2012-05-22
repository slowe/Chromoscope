/*
 * Chromoscope KML Add-on
 * Written by Stuart Lowe to parse KML files and display placemarkers
 *
 * Changes in version 1.2 (2011-10-01):
 *   - Basic tour elements are now supported:
 *     wait, flyTo Placemark, open/close info balloons with animatedMove
 *
 * Changes in version 1.1 (2011-09-25):
 *   - Now a proper plugin
 *   - Allow multiple KML files using ';' separator
 *   - Can disable/enable KML files
 */

(function ($) {

	function init(chromo) {

		chromo.kmls = [];	// KML files to add to this map

		// Check if any KML/JSON files were requested in the set up for Chromoscope or the query string
		if(typeof chromo.q.kml=="string") chromo.kmls = chromo.q.kml.split(';');
		if(typeof chromo.q.json=="string") chromo.kmls.push(chromo.q.json.split(';'));
		if(chromo.args){
			if(typeof chromo.args.kml=="string") chromo.kmls.push(chromo.args.kml.split(';'))
			if(typeof chromo.args.json=="string") chromo.kmls.push(chromo.args.json.split(';'));
		}
	
		chromo.bind("load",function(){
			//console.log("Time to trigger KML load:" + (new Date() - chromo.start) + "ms");
			if(this.kmls.length > 0) this.message('Loading '+this.q.kml+'.<br />It may take a few seconds.');
			for (var k = 0; k < this.kmls.length; k++) {
				resp = this.readKML(this.kmls[k],30000);
				$(this.container+" .chromo_info").append("KML "+this.kmls[k]+"<br />");
			}
			//console.log("Time to end trigger KML load:" + (new Date() - this.start) + "ms");
		}).bind("getViewURL",function(){ 
			return (typeof this.q.kml=="string" ? '&kml='+this.q.kml : "");
		}).bind("processkml",function(){ this.findPin(this.q.pin); });

		// Get a locally hosted KML file
		// Usage: readKML(chromo,kml,[overwrite],[duration],[callback])
		//	chromo = The Chromoscope instance
		//	file (string) = The location of the KML/JSON file
		//	overwrite (boolean) = Do we overwrite any previously loaded Placemarkers?
		//	duration (number) = Number of milliseconds before reloading the KML
		//	callback (function) = A function to call after this
		chromo.readKML = function(file){
			//console.log("Time to start of readKML:" + (new Date() - this.start) + "ms");

			if(typeof file=="string"){
				// Relative link shouldn't have a protocol
				if(file.indexOf('://') < 0){

					var duration = 0;
					var overwrite = false;
					for (var i = 1; i < this.readKML.arguments.length; i++){
						var arg = this.readKML.arguments[i];
						duration = (typeof arg=="number") ? arg : duration;
						overwrite = (typeof arg=="boolean") ? arg : overwrite;
					}
					// Keep a copy of this chromoscope for use in the AJAX callback
					var _obj = this;
					// If the URL of the KML already has a query string, we just add to it
					var fileurl = (file.indexOf('?') > 0) ? file+'&'+Math.random() : file+'?'+Math.random();

					this.message('Loading '+file+'.',true);
					if(file.indexOf(".json") > 0){
						$.ajaxSetup({async:true});
						var jqxhr = $.getJSON(fileurl,function(data){
							var docname = data.name;
							var ngroup = _obj.addPinGroup({id:file,title:docname});
							_obj.message('Processing '+docname);
							if(!_obj.container) $('title').text(docname+' | Chromoscope');
							var total = _obj.processFile("json",data,overwrite,ngroup);
							_obj.trigger("kml",{total:total,name:docname});
							if(duration > 0) setTimeout(function(file,duration){ _obj.readKML(_obj.file,duration); },duration);
						}).error(function(data) {
							_obj.message('Failed to load '+file+'. It may not exist or be inaccessible.',true);
						});
					}else{
						// Bug fix for reading XML file in FF3
						$.ajaxSetup({async:true,'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); } });
						var resp = $.ajax({
							type: "GET",
							url: fileurl,
							dataType: ($.browser.msie) ? "text" : "xml",
							success: function(data) {
								var xml;
								// IE has special requirements
								if ( $.browser.msie ) {
									xml = new ActiveXObject("Microsoft.XMLDOM");
									xml.async = false;
									xml.loadXML(data);
								}else xml = data;
								var docname = $('Document',xml).children('name').text();
								var ngroup = _obj.addPinGroup({id:file,title:docname});
								_obj.message('Processing '+docname);
								if(!_obj.container) $('title').text(docname+' | Chromoscope');
								var total = _obj.processFile("kml",xml,overwrite,ngroup);
								_obj.trigger("kml",{total:total,name:$('Document',xml).children('name').text()});
								//if(callback) callback.call();
								if(duration > 0) setTimeout(function(file,duration){ _obj.readKML(file,duration); },duration);
							},
							error: function(data) {
								_obj.message('Failed to load '+file+'. It may not exist or be inaccessible.',true);
							}
						});
					}
				}else{
					this.message('Due to web browser security, I can\'t load remote files. Sorry.',true);
				}
			}
			//console.log("Time to end of readKML:" + (new Date() - this.start) + "ms");
		}

		// Parse a loaded KML/JSON file
		// Usage: processFile(filetype,xml,[overwrite])
		//	filetype = "kml" or "json"
		//	xml = The KML/JSON file as loaded by readKML()
		//	overwrite (boolean) = Do we overwrite any previously loaded Placemarkers?
		chromo.processFile = function(filetype,data,overwrite,group){

			var overwrite = overwrite ? true : false;
			filetype = (typeof filetype=="string") ? filetype : "kml";
			if(overwrite) this.pins = new Array();
			if(!group) group = 0;

			docname = (this.pingroups[group].title) ? this.pingroups[group].title : "KML";
			if(typeof data != "object") return 0;

			var p = this.pins.length;
			var c = this;	// Keep a copy of this instance for inside the Placemark loop
			var i = 0;

			// Set the opacity of all the pins (mostly for IE)
			setOpacity($(this.container+" .kml"),1.0);

			//console.log("Time until running processFile: " + (new Date() - this.start) + "ms");
			var styles = new Array();
			this.pinstylecount = 0;
			this.pinstyleload = 0;
			var _obj = this;
			var added = 0;
			
			if(filetype == "json"){
				for(i=0 ; i< data.styles.length ; i++){
					var j = data.styles[i];
					styles[j.id] = {id: j.id, img:new Image(), balloonstyle:j.BalloonStyle,x:j.hotSpot.x,y:j.hotSpot.y};
					// Preload the images. First set the onload then attach the src.
					// We'll update the pins again once all the style images have loaded
					styles[j.id].img.onload = function(){ 
						//console.log("Time to loaded style img "+_obj.pinstyleload+":" + (new Date() - _obj.start) + "ms");
						if(++_obj.pinstyleload == _obj.pinstylecount){
							_obj.updatePins({draw:false,finish:true}); 
							if(_obj.showintro) _obj.buildIntro();
							else $(_obj.container+" .chromo_message").hide();
						}
					};
					styles[j.id].img.onerror = function(){
						//console.log("Time to error "+_obj.pinstyleload+":" + (new Date() - _obj.start) + "ms");
						if(++_obj.pinstyleload == _obj.pinstylecount){
							_obj.updatePins({draw:false,finish:true}); 
							if(_obj.showintro) _obj.buildIntro();
							else $(_obj.container+" .chromo_message").hide();
						}
					}
					if(j.icon) styles[j.id].img.src = j.icon;
					this.pinstylecount++;
				}
				if(typeof data.tour=="object") _obj.bind("processkml",function(){ runTour(this,data.tour); });
				//console.log("Time to process styles: " + (new Date() - this.start) + "ms");
				for(i = 0 ; i < data.placemarks.length ; i++){
					// Get the custom icon
					var img = "";
					var balloonstyle = "";
					var x, y, xunits, yunits, w, h = "";
					var style = data.placemarks[i].style;
					var id = ($(this).attr('id')) ? "pin-"+$(this).attr('id') : "";
					if(typeof styles[style]=="object"){
						img = styles[style].img;
						balloonstyle = styles[style].balloonstyle
						x = (typeof styles[style].x=="undefined") ? "" : parseFloat(styles[style].x);
						y = (typeof styles[style].y=="undefined") ? "" : parseFloat(styles[style].y);
						xu = styles[style].xunits;
						yu = styles[style].yunits;
						w = (styles[style].img.width) ? styles[style].img.width : "";
						h = (styles[style].img.height) ? styles[style].img.height : "";
					}
					c.addPin({group:group,id:id,style:style,img:img,title:data.placemarks[i].name,x:x,y:y,xunits:xu,yunits:yu,w:w,h:h,balloonstyle:balloonstyle,desc:data.placemarks[i].description,ra:data.placemarks[i].ra+180,dec:data.placemarks[i].dec},true);
					added++;
				}
			}else{
				$('Style',data).each(function(i){
					var j = $(this);
					id = j.attr('id');
					// We currently use the <href> and <hotSpot> variables as defined in:
					// http://code.google.com/apis/kml/documentation/kmlreference.html#icon
					styles[id] = {id: id,img:new Image(),balloonstyle:j.find('BalloonStyle'),x:j.find('hotSpot').attr('x'),y:j.find('hotSpot').attr('y')};
					// Preload the images. First set the onload then attach the src.
					// We'll update the pins again once all the style images have loaded
					styles[id].img.onload = function(){

						//console.log("Time to loaded style img "+_obj.pinstyleload+":" + (new Date() - _obj.start) + "ms");

						if(++_obj.pinstyleload == _obj.pinstylecount){
							_obj.updatePins({draw:false,finish:true}); 
							if(_obj.showintro) _obj.buildIntro();
							else $(_obj.container+" .chromo_message").hide();
						}
					};
					styles[id].img.onerror = function(){

						//console.log("Time to error "+_obj.pinstyleload+":" + (new Date() - _obj.start) + "ms");

						if(++_obj.pinstyleload == _obj.pinstylecount){
							_obj.updatePins({draw:false,finish:true}); 
							if(_obj.showintro) _obj.buildIntro();
							else $(_obj.container+" .chromo_message").hide();
						}
					}
					styles[id].img.src = j.find('href').text();
					if(styles[id].img.src) _obj.pinstylecount++;
					//console.log("Time to start loading img "+id+" "+_obj.pinstylecount+":" + (new Date() - _obj.start) + "ms")
				});

				//console.log("Time to process styles: " + (new Date() - this.start) + "ms");
				$('gx\\:Tour',data).children().each(function(i){
					var name = $(this).find("name").text();
					var tour = [];
					$(this).children().each(function(i){
						var step = {
							type:$(this).context.localName,
							duration:Number($(this).find("gx\\:duration").text())*1000,
							Placemark: []
						};
						if($(this).find("gx\\:flyToMode")) step.flyToMode = $(this).find("gx\\:flyToMode").text();
						if(step.type == "FlyTo"){
							$(this).find("Camera").each(function(j){
								step.Camera = {
									longitude: Number($(this).find("longitude").text())+180,
									latitude: Number($(this).find("latitude").text())
								}
							});
							$(this).find("LookAt").each(function(j){
								step.LookAt = {
									longitude: Number($(this).find("longitude").text())+180,
									latitude: Number($(this).find("latitude").text()),
									range: Number($(this).find("range").text())
								}
							});

						}
						if(step.type == "AnimatedUpdate"){
							$(this).find("Placemark").each(function(j){
								step.Placemark.push({
									id: $(this).attr('targetId'),
									balloonVisibility: ($(this).find("gx\\:balloonVisibility").text()=="1") ? true : false
								})
							});
						}
						$(this).find("chromo\\:wavelength").each(function(j){ step.wavelength = $(this).text(); });
						$(this).find("chromo\\:labels").each(function(j){ step.labels = $(this).text(); });
						tour.push(step);
					})
					if(tour.length > 0) _obj.bind("processkml",function(){ this.showintro = false; runTour(this,tour); });
				}).remove();

				//console.log("Time to process styles: " + (new Date() - this.start) + "ms");
				$('Placemark',data).each(function(i){

					// Get the custom icon
					var img = "pin.png";
					var balloonstyle = "";
					var x, y, xu, yu, w, h = "";
					var style = "";
					if($(this).find("styleUrl").text()){
						style = $(this).find("styleUrl").text();
						style = style.substring(1);
					}
					var title = ($(this).find("name")) ? $(this).find("name").text() : "";
					var desc = ($(this).find("description")) ? $(this).find("description").text() : "";
					var ra = ($(this).find("longitude")) ? (parseFloat($(this).find("longitude").text())+180) : 0.0;
					var dec = ($(this).find("latitude")) ? parseFloat($(this).find("latitude").text()) : 0.0;
					var id = ($(this).attr('id')) ? "pin-"+$(this).attr('id') : "";
					if(typeof styles=="object" && style != "" && typeof styles[style]=="object"){
						img = styles[style].img;
						balloonstyle = styles[style].balloonstyle.find('text').text()
						x = (typeof styles[style].x=="undefined") ? "" : parseFloat(styles[style].x);
						y = (typeof styles[style].y=="undefined") ? "" : parseFloat(styles[style].y);
						xu = styles[style].xunits;
						yu = styles[style].yunits;
						w = (styles[style].img.width) ? styles[style].img.width : "";
						h = (styles[style].img.height) ? styles[style].img.height : "";
					}
					c.addPin({group:group,id:id,style:style,img:img,title:title,x:x,y:y,xunits:xu,yunits:yu,w:w,h:h,balloonstyle:balloonstyle,desc:desc,ra:ra,dec:dec},true);
					added++;
				});
			}
			if(added > 0){
				this.addPinGroupSwitches(group);
				this.updatePins({draw:true});
				this.wrapPins();
				this.trigger("processkml");
			}
			//console.log("Time to end of processFile: " + (new Date() - this.start) + "ms");
			return added;
		}

		// Step through a tour
		runTour = function(chromo,tour){
			var step = tour[0];
			// Check if any blocking animation is still running
			if(chromo.animating){
				var t = setTimeout(runTour,50,chromo,tour)
				return;
			}
			if(!step) return;
			if(step.type == "FlyTo"){
				kml_coord = 0;
				if(typeof step.LookAt=="object"){
					var nzoom = 0;
					if(step.LookAt.range){
						var deg = range2degrees(step.LookAt.range);
						var fov = 360*chromo.wide/chromo.mapSize;
						if(fov/deg > 2) while (fov/deg > 2){ nzoom++; fov /=2; }
						else if(deg/fov > 2) while (deg/fov > 2){ nzoom--; fov *=2; }
					}
					if(step.LookAt.longitude){
						kml_coord = Equatorial2Galactic(step.LookAt.longitude, step.LookAt.latitude);
						chromo.moveMap(kml_coord[0],kml_coord[1],chromo.zoom+nzoom,step.duration);
					}
				}
			}else if(step.type == "AnimatedUpdate"){
				for(var i = 0; i < step.Placemark.length ; i++){
					var id = "pin-"+step.Placemark[i].id;
					var matched = false;
					for(var p = 0 ; p < chromo.pins.length; p++){
						if(chromo.pins[p].id == id){
							if(step.Placemark[i].balloonVisibility) chromo.pins[p].showBalloon();
							else chromo.pins[p].hideBalloon();
							break;
						}
					}
				}
			}
			if(step.wavelength){
				if(Number(step.wavelength)) chromo.changeWavelength(Number(step.wavelength),step.duration);
				else if(step.wavelength.length == 1) chromo.changeWavelengthByName(step.wavelength,step.duration);
			}
			if(step.labels) chromo.toggleAnnotationsByName('l');

			// Remove this step from the list
			tour.shift();
			if(tour.length > 0){
				// Check for steps that happen in parallel
				if(step.type == "AnimatedUpdate" || step.type == "SoundCue") runTour(chromo,tour);
				// Set a timeout until the next step of the tour happen
				else var t = setTimeout(runTour,step.duration,chromo,tour);
			}

		}
		
		function range2degrees(r){
			//r = R*(k*sin(ß/2) - cos(ß/2) + 1)
			// Return field of view in degrees
			return 180*Math.acos(1 - r/6378000)/Math.PI;
		}

		//console.log("Time to end of KML init:" + (new Date() - this.start) + "ms");
	}

	$.chromoscope.plugins.push({
		init: init,
		name: 'kml',
		version: '1.2'
	});
})(jQuery);

