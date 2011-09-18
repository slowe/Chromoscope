/*
 * Chromoscope KML Add-on
 * Written by Stuart Lowe to parse KML files and display placemarkers
 *
 * You need to add this Javascript file and then call addKML() e.g.
 *
 * chromo.addKML();
 *
 */
 
Chromoscope.prototype.addKML = function(){

	this.kmls = [];	// KML files to add to this map

	this.bind("load",function(){
		// Check if any KML/JSON files were requested in the set up for Chromoscope or the query string
		if(typeof this.q.kml=="string") this.kmls = this.q.kml.split(';');
		if(typeof this.q.json=="string") this.kmls.push(this.q.json.split(';'));
		if(this.args){
			if(typeof this.args.kml=="string") this.kmls.push(this.args.kml.split(';'))
			if(typeof this.args.json=="string") this.kmls.push(this.args.json.split(';'));
		}
		if(this.kmls.length > 0) this.message('Loading '+this.q.kml+'.<br />It may take a few seconds.');
		for (var k = 0; k < this.kmls.length; k++) { this.readKML(this.kmls[k],30000); $(this.container+" .chromo_info").append("KML "+this.kmls[k]+"<br />"); }
	}).bind("getViewURL",function(){ 
		return '&kml='+this.q.kml
	});
}

// Get a locally hosted KML file
// Usage: readKML(kml,[overwrite],[duration],[callback])
//	kml (string) = The location of the KML/JSON file
//	overwrite (boolean) = Do we overwrite any previously loaded Placemarkers?
//	duration (number) = Number of milliseconds before reloading the KML
//	callback (function) = A function to call after this
Chromoscope.prototype.readKML = function(kml){
	if(typeof kml=="string"){
		// Relative link shouldn't have a protocol
		if(kml.indexOf('://') < 0){
			var duration = 0;
			var overwrite = false;
			for (var i = 1; i < Chromoscope.prototype.readKML.arguments.length; i++){
				var arg = Chromoscope.prototype.readKML.arguments[i];
				duration = (typeof arg=="number") ? arg : duration;
				overwrite = (typeof arg=="boolean") ? arg : overwrite;
			}
			// Keep a copy of this chromoscope for use in the AJAX callback
			var _obj = this;
			// If the URL of the KML already has a query string, we just add to it
			var kmlurl = (kml.indexOf('?') > 0) ? kml+'&'+Math.random() : kml+'?'+Math.random();

			this.message('Loading '+kml+'.',true);
			if(kml.indexOf(".json") > 0){
				var jqxhr = $.getJSON(kmlurl,function(data){
					var total = _obj.processJSON(data,overwrite,kml);
					if(typeof _obj.events.json=="function") _obj.events.json.call(_obj,{total:total,name:data.name});
					//if(callback) callback.call();
					if(duration > 0) setTimeout(function(json,duration){ _obj.readKML(json,duration); },duration);
				}).error(function(data) {
					_obj.message('Failed to load '+kml+'. It may not exist or be inaccessible.',true);
				});
			}else{
				// Bug fix for reading XML file in FF3
				$.ajaxSetup({async:false,'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); } });
				$.ajax({
					type: "GET",
					url: kmlurl,
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
						var ngroup = _obj.addPinGroup({id:kml,title:docname});

						_obj.message('Processing '+docname);
						if(!_obj.container) $('title').text(docname+' | Chromoscope');
						var total = _obj.processKML(xml,overwrite,ngroup);
						_obj.triggerEvent("kml",{total:total,name:$('Document',xml).children('name').text()});
						//if(callback) callback.call();
						if(duration > 0) setTimeout(function(kml,duration){ _obj.readKML(kml,duration); },duration);
					},
					error: function(data) {
						_obj.message('Failed to load '+kml+'. It may not exist or be inaccessible.',true);
					}
				});
			}
		}else{
			this.message('Due to web browser security, I can\'t load remote files. Sorry.',true);
		}
	}
}

// Parse a loaded KML file
// Usage: processKML(xml,[overwrite])
//	xml = The KML file as loaded by readKML()
//	overwrite (boolean) = Do we overwrite any previously loaded Placemarkers?
Chromoscope.prototype.processKML = function(xml,overwrite,group){

	var overwrite = overwrite ? true : false;
	if(overwrite) this.pins = new Array();
	if(!group) group = 0;
	docname = (this.pingroups[group].title) ? this.pingroups[group].title : "KML";

	var p = this.pins.length;
	var c = this;	// Keep a copy of this instance for inside the Placemark loop
	var i = 0;

	// Set the opacity of all the pins (mostly for IE)
	setOpacity($(this.container+" .kml"),1.0);

	//console.log("Time until running processKML: " + (new Date() - this.start) + "ms");
	var styles = new Array();
	this.pinstylecount = 0;
	this.pinstyleload = 0;
	var _obj = this;
	var added = 0;

	$('Style',xml).each(function(i){
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
				_obj.updatePins({delay:false,finish:true}); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		};
		styles[id].img.onerror = function(){

			//console.log("Time to error "+_obj.pinstyleload+":" + (new Date() - _obj.start) + "ms");

			if(++_obj.pinstyleload == _obj.pinstylecount){
				_obj.updatePins({delay:false,finish:true}); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		}
		styles[id].img.src = j.find('href').text();
		if(styles[id].img.src) _obj.pinstylecount++;
		//console.log("Time to start loading img "+id+" "+_obj.pinstylecount+":" + (new Date() - _obj.start) + "ms")
	});

	//console.log("Time to process styles: " + (new Date() - this.start) + "ms");
	$('Placemark',xml).each(function(i){

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
		var id_text = "";
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
		c.addPin({group:group,style:style,img:img,title:title,x:x,y:y,xunits:xu,yunits:yu,w:w,h:h,balloonstyle:balloonstyle,desc:desc,ra:ra,dec:dec},true);
		added++;
	});
	if(added > 0){
		this.addPinGroupSwitches(group);
		this.updatePins({delay:true});
		this.wrapPins();
	}
	//console.log("Time to end of processKML: " + (new Date() - this.start) + "ms");
	return added;
}

// Parse a loaded JSON file
// Usage: processJSON(json,[overwrite])
//	json = The JSON object as loaded by readKML()
//	overwrite (boolean) = Do we overwrite any previously loaded Placemarkers?
Chromoscope.prototype.processJSON = function(json,overwrite,group){

	var overwrite = overwrite ? true : false;
	if(overwrite) this.pins = new Array();
	if(!group) group = 0;
	docname = (this.pingroups[group].title) ? this.pingroups[group].title : "KML";

	var p = this.pins.length;
	var c = this;	// Keep a copy of this instance for inside the Placemark loop
	var i = 0;

	// Set the opacity of all the pins (mostly for IE)
	setOpacity($(this.body+" .kml"),1.0);

	//console.log("Time until running processJSON: " + (new Date() - this.start) + "ms");

	var styles = new Array();
	this.pinstylecount = 0;
	this.pinstyleload = 0;
	var _obj = this;
	var added = 0;

	for(i=0 ; i< json.styles.length ; i++){
		var j = json.styles[i];
		styles[j.id] = {id: j.id, img:new Image(), balloonstyle:j.BalloonStyle,x:j.hotSpot.x,y:j.hotSpot.y};
		// Preload the images. First set the onload then attach the src.
		// We'll update the pins again once all the style images have loaded
		styles[j.id].img.onload = function(){ 
			if(++_obj.pinstyleload == _obj.pinstylecount){
				_obj.updatePins({}); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		};
		styles[j.id].img.onerror = function(){
			if(++_obj.pinstyleload == _obj.pinstylecount){
				_obj.updatePins({delay:false,finish:true}); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		}
		if(j.icon) styles[j.id].img.src = j.icon;
		this.pinstylecount++;
	}
	//console.log("Time to process styles: " + (new Date() - this.start) + "ms");
	for(i = 0 ; i < json.placemarks.length ; i++){
		// Get the custom icon
		var img = "";
		var balloonstyle = "";
		var x, y, xunits, yunits, w, h = "";
		var style = json.placemarks[i].style;
		var id_text = "";
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
		c.addPin({group:group,style:style,img:img,title:json.placemarks[i].name,x:x,y:y,xunits:xu,yunits:yu,w:w,h:h,balloonstyle:balloonstyle,desc:json.placemarks[i].description,ra:json.placemarks[i].ra+180,dec:json.placemarks[i].dec},true);
		added++;
	}
	if(added > 0){
		this.updatePins({delay:true});
		this.wrapPins();
	}
	//console.log("Time to end of processKML: " + (new Date() - this.start) + "ms");
	return added;
}

