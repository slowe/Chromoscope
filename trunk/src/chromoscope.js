/*
 * Chromoscope v1.3.3
 * Written by Stuart Lowe for the Planck/Herschel Royal Society
 * Summer Exhibition 2009. Developed as an educational resource.
 *
 * This application will run locally or can be run on a web
 * server. The only part that requires an internet connection
 * is the search tool which makes use of strudel.org.uk/lookUP/
 *
 * To run locally you'll need to download the appropriate 
 * tile sets and code.
 *
 * Changes in version 1.3.3 (2011-07-25):
 *   - Added KML title to page title if not in a container
 *   - Added key binding
 *   - Added event binding
 *   - addWavelength() and addAnnotationLayer() are now chainable
 *   - Fixed <BalloonStyle> parsing from KML
 *   - Added ability to load from KML-like JSON file (.json extension)
 *   - moveMap() can animate again
 *   - Speeded up KML pin display by changing to IDs instead of classes
 *   - Pressing shift will show cursor coordinates
 */

// Manually define one global variable to hold the Chromoscope instance.
var chromo_active

// Get the URL query string and parse it
jQuery.query = function() {
        var r = {length:0};
        var q = location.search;
	if(q && q != '#'){
		// remove the leading ? and trailing &
		q = q.replace(/^\?/,'').replace(/\&$/,'');
		jQuery.each(q.split('&'), function(){
			var key = this.split('=')[0];
			var val = this.split('=')[1];
			if(/^[0-9.]+$/.test(val)) val = parseFloat(val);	// convert floats
			r[key] = val;
			r['length']++;
		});
	}
        return r;
};

// Define the keyboard capture
$(document).keydown(function(e){
	if(!chromo_active) return true;
	if(!e) e=window.event;
	var code = e.keyCode || e.charCode || e.which || 0;
	chromo_active.keypress(code,e)
}).keypress(function(e){
	if(!chromo_active) return true;
	if(!e) e=window.event;
	var code = e.keyCode || e.charCode || e.which || 0;
	chromo_active.keypress(code,e)
});

// Extend jQuery
$(function(){
	// Disable text selection thanks to http://chris-barr.com/entry/disable_text_selection_with_jquery/
	$.extend($.fn.disableTextSelect = function() {
		return this.each(function(){
			if($.browser.mozilla) $(this).css('MozUserSelect','none'); //Firefox
			else if($.browser.msie) $(this).bind('selectstart',function(){return false;}); //IE
			else $(this).mousedown(function(){return false;}); //Opera, etc.
		});
	});

	$.extend($.fn.addTouch = function(){
		// Adapted from http://code.google.com/p/rsslounge/source/browse/trunk/public/javascript/addtouch.js?spec=svn115&r=115
		this.each(function(i,el){
			// Pass the original event object because the jQuery event object
			// is normalized to w3c specs and does not provide the TouchList.
			$(el).bind('touchstart touchmove touchend touchcancel touchdbltap',function(){ handleTouch(event); });
		});
		var handleTouch = function(event){
			var touches = event.changedTouches,
			first = touches[0],
			type = '';
			switch(event.type){
				case 'touchstart':
					type = 'mousedown';
					break;
				case 'touchmove':
					type = 'mousemove';
					break;        
				case 'touchend':
					type = 'mouseup';
					break;
				case 'touchdbltap':
					type = 'dblclick';
					break;
				default:
					return;
			}
			var simulatedEvent = document.createEvent('MouseEvent');
			simulatedEvent.initMouseEvent(type, true, true, window, 1, first.screenX, first.screenY, first.clientX, first.clientY, false, false, false, false, 0/*left*/, null);
			first.target.dispatchEvent(simulatedEvent);
			event.preventDefault();
		};
	});
});


// Declare the Chromoscope object
function Chromoscope(input){

	this.version = "1.3.3 beta";

	this.q = $.query();
	this.zoom = -1;
	this.maxZoom = 6;		// Maximum zoom level
	this.wavelength_speed = 0.05;	// Alters the speed of wavelength transitions
	this.wavelength_load_range = 1;	// The number of wavelengths either side of nominal to load simultaneously
	this.spatial_preload = 1;	// The number of tiles off the edge of the map to load (high takes more memory but makes it more responsive)
	this.performance = false;	// Displays the time to process checkTiles()
	this.cdn = '';			// Do we use a content distribution network to reduce bandwidth?
	this.id = 'chromoscope';	// An internal id
	this.container = '';		// Attach to an element rather than fullscreen
	this.ra;			// Set the Right Ascension via the init function
	this.dec;			// Set the Declination via the init function
	this.l;				// Set the Galactic longitude via the init function
	this.b;				// Set the Galactic latitude via the init function
	this.lambda = 0;		// Current pseudo-wavelength
	
	// Variables
	this.tileSize = 256;		// In pixels
	this.maxOpacity = 1.0;
	this.minOpacity = 0.0;
	this.spectrum = new Array();	// Wavelength layers
	this.annotations = new Array();	// Annotation layers
	this.pins = new Array();	// For information pin/balloons
	this.times = new Array(10);	// Processing times for map moving updates
	this.keys = new Array();	// Keyboard commands
	this.kmls = new Array();	// KML files to add to this map
	this.tidx = 0;			// Current index of the times array
	this.clock = 0;			// Holds the time

	// Language Settings
	this.lang = (navigator.language) ? navigator.language : navigator.userLanguage;			// Set the user language
	this.langshort = this.lang.substring(0,2);
	this.langs = new Array();
	// Country codes at http://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
	this.langs[0] = {code:'en',name:'English'};
	this.langs[1] = {code:'cy',name:'Cymraeg'};
	this.langs[2] = {code:'de',name:'Deutsch'};
	this.langs[3] = {code:'es',name:'Espa&#241;ol'};
	this.langs[4] = {code:'fr',name:'Fran&#231;ais'};
	this.langs[5] = {code:'ga',name:'Gaeilge'};
	this.langs[6] = {code:'it',name:'Italiano'};
	this.langs[7] = {code:'pl',name:'Polski'};
	this.langs[8] = {code:'pt',name:'Portugu&#234s'};
	this.langs[9] = {code:'sv',name:'Svenska'};
	this.langs[10] = {code:'tr',name:'T&#252;rk&#231;e'};
	this.phrasebook = new Language({code:'en'});

	// The map div control and properties
	this.sliderbar = true;		// Display the slider bar?
	this.zoomctrl = true;		// Display the zoom control
	this.title = true;		// Display the title?
	this.showintro = true;		// Display the introductory message
	this.showshare = true;		// Display the share link
	this.showabout = true;		// Display the about link
	this.showlangs = true;		// Display the languages link
	this.showcoord = true;		// Display the coordinates
	this.showcontext = true;	// Display the context menu (right-click)
	this.compact = false;		// Hide parts of the interface if small
	this.mapSize = 256;
	this.dragging = false;
	this.allowdrag = true;
	this.draggingSlider = false;
	this.moved = false;
	this.ignorekeys = false;	// Allow/disallow keyboard control
	this.coordtype = 'G';		// The coordinate type to display 'G' for Galactic and 'A' for equatorial
	this.pushstate = !!(window.history && history.pushState);	// Do we update the address bar?
	this.y = 0;
	this.x = 0;
	this.wide = 480;
	this.tall = 320;
	this.dragStartTop;
	this.dragStartLeft;
	this.previousRange = [];
	this.previousTiles = [];
	this.previousTilesMap = [];
	this.previousMinLambda = 0;
	this.previousMaxLambda = 0;
	this.previousZoom = 0;
	this.visibleTilesMap = [];
	this.minlambda = this.lambda;
	this.maxlambda = this.lambda+1;
	this.dir = "";			// The location for resources such as the close image and language files
	this.start = new Date();

	this.events = {move:"",zoom:"",slide:"", wcsupdate:"",kml:"",json:"",pinopen:"",pinclose:""};	// Let's add some events
	this.init(input);
}

// Set variables defined in the query string
// The default behaviour is to show the intro message. We will over-ride this
// with the query string option 'showintro'. If 'showintro' isn't set manually
// in the query string we will only show it if there is no query string; we
// will assume that having a query string means this is a shared link and in
// that case the intro message can be confusing to the person following the link.
Chromoscope.prototype.init = function(inp){
	if(this.q.showintro) this.showintro = (this.q.showintro == "true") ? true : false;
	else{
		if(this.q.length > 0) this.showintro = false;
	}
	if(this.q.sliderbar) this.sliderbar = (this.q.sliderbar == "true") ? true : false;
	if(this.q.zoomctrl) this.zoomctrl = (this.q.zoomctrl == "true") ? true : false;
	if(this.q.compact) this.compact = (this.q.compact == "true") ? true : false;
	if(this.q.title) this.title = (this.q.title == "true") ? true : false;
	if(this.q.kml=="string") this.kmls[this.kmls.length] = this.q.kml;
	if(this.q.json=="string") this.kmls[this.kmls.length] = this.q.json;
	if(this.q.performance) this.performance = true;

	// Overwrite with variables passed to the function
	if(inp){
		if(inp.wavelength_speed) this.wavelength_speed = inp.wavelength_speed;
		if(inp.wavelength_load_range) this.wavelength_load_range = inp.wavelength_load_range;
		if(inp.spatial_preload) this.spatial_preload = inp.spatial_preload;
		if(typeof inp.lang=="string") this.langshort = inp.lang;
		if(typeof inp.title=="boolean") this.title = inp.title;
		if(typeof inp.performance=="boolean") this.performance = inp.performance;
		if(typeof inp.ignorekeys=="boolean") this.ignorekeys = inp.ignorekeys;
		if(typeof inp.showintro=="boolean") this.showintro = inp.showintro;
		if(typeof inp.showshare=="boolean") this.showshare = inp.showshare;
		if(typeof inp.showabout=="boolean") this.showabout = inp.showabout;
		if(typeof inp.showlangs=="boolean") this.showlangs = inp.showlangs;
		if(typeof inp.showcoord=="boolean") this.showcoord = inp.showcoord;
		if(typeof inp.showcontext=="boolean") this.showcontext = inp.showcontext;
		if(typeof inp.sliderbar=="boolean") this.sliderbar = inp.sliderbar;
		if(typeof inp.zoomctrl=="boolean") this.zoomctrl = inp.zoomctrl;
		if(typeof inp.compact=="boolean") this.compact = inp.compact;
		if(typeof inp.pushstate=="boolean") this.pushstate = inp.pushstate;
		if(typeof inp.cdn=="string") this.cdn = inp.cdn;
		if(typeof inp.container=="string"){ this.container = inp.container; this.id = inp.container.substring(1); }
		if(typeof inp.ra=="number") this.ra = inp.ra;
		if(typeof inp.dec=="number") this.dec = inp.dec;
		if(typeof inp.l=="number") this.l = inp.l;
		if(typeof inp.b=="number") this.b = inp.b;
		if(typeof inp.zoom=="number") this.zoom = inp.zoom;
		if(typeof inp.maxZoom=="number") this.maxZoom = inp.maxZoom;
		if(typeof inp.lambda=="number") this.lambda = inp.lambda;
		if(typeof inp.langs=="object") this.langs = inp.langs;
		if(typeof inp.kml=="string") this.kmls[this.kmls.length] = inp.kml;
		if(typeof inp.json=="string") this.kmls[this.kmls.length] = inp.json;
		if(typeof inp.dir=="string") this.dir = inp.dir;
	}
	if(this.pushstate){
		window.onpopstate = function(event) {
			// Can't use moveMap because it updates the state event chromo_active.moveMap(event.state.l,event.state.b,event.state.z);
		};
	}

}

function Language(inp){
	if(!inp) inp = { code: 'en' }
	this.code = (inp.code) ? inp.code :'en';
	this.name = (inp.name) ? inp.name :'English';
	this.translator = (inp.translator) ? inp.translator :'';
	this.lang = (inp.lang) ? inp.lang :'Change language:';
	this.version = (inp.version) ? inp.version :'version';
	this.help = (inp.help) ? inp.help :'Help';
	this.helpmenu = (inp.helpmenu) ? inp.helpmenu : inp.help;
	this.helpdesc = (inp.helpdesc) ? inp.helpdesc : '<span class="keyboard">The keyboard controls are:<ul class="chromo_controlkeys"></ul></span><span class="nokeyboard"><ul class="chromo_controlbuttons"></ul></span> <span class="keyboard">Created by <a href="http://www.strudel.org.uk/">Stuart Lowe</a>, <a href="http://www.orbitingfrog.com/">Rob Simpson</a>, and <a href="http://www.astro.cardiff.ac.uk/contactsandpeople/?page=full&id=493">Chris North</a>.</span>';	
	this.about = (inp.about) ? inp.about :'About';
	this.share = (inp.share) ? inp.share :'Share';
	this.sharewith = (inp.sharewith) ? inp.sharewith :'Share it with';
	this.switchtext = (inp.switchtext) ? inp.switchtext : 'switch to __WAVELENGTH__ view of the sky';
	this.search = (inp.search) ? inp.search : 'search';
	this.press = (inp.press) ? inp.press : 'Press __KEY__';
	this.close = (inp.close) ? inp.close : 'Close';
	this.closedesc = (inp.closedesc) ? inp.closedesc : 'click to close';
	this.switchannotation = (inp.switchannotation) ? inp.switchannotation :' show or hide __ANNOTATION__';
	this.showhide = (inp.showhide) ? inp.showhide : 'show or hide all screen furniture (except the credit line)';
	this.up = (inp.up) ? inp.up : 'higher energy (reduce the wavelength)';
	this.down = (inp.down) ? inp.down : 'lower energy (increase the wavelength)';
	this.zoomin = (inp.zoomin) ? inp.zoomin : 'zoom in';
	this.zoomout = (inp.zoomout) ? inp.zoomout : 'zoom out';
	this.nozoomin = (inp.nozoomin) ? inp.nozoomin : 'Can\'t zoom in any more'
	this.nozoomout = (inp.nozoomout) ? inp.nozoomout : 'Can\'t zoom out any more'
	this.url = (inp.url) ? inp.url : 'The URL for this view is:';
	this.intro = (inp.intro) ? inp.intro : '<p>Ever wanted X-ray specs or super-human vision? Chromoscope lets you explore our Galaxy (the Milky Way) and the distant Universe in <a href="http://blog.chromoscope.net/data/">a range of wavelengths</a> from X-rays to the longest radio waves.</p><p>Change the wavelength using the <em>slider</em> in the top right of the screen and explore space using your mouse. If you get stuck, click &quot;Help&quot; in the bottom left.</p>';
	this.gal = (inp.gal) ? inp.gal : 'http://en.wikipedia.org/wiki/Galactic_coordinate_system';
	this.galcoord = (inp.galcoord) ? inp.galcoord : 'Galactic Coordinates';
	this.eq = (inp.eq) ? inp.eq : 'http://en.wikipedia.org/wiki/Equatorial_coordinate_system';
	this.eqcoord = (inp.eqcoord) ? inp.eqcoord : 'Equatorial Coordinates';
	this.gamma = (inp.gamma) ? inp.gamma : 'Gamma ray';
	this.xray = (inp.xray) ? inp.xray : 'X-ray';
	this.optical = (inp.optical) ? inp.optical : 'Visible';
	this.halpha = (inp.halpha) ? inp.halpha : 'Hydrogen &alpha;';
	this.farir = (inp.farir) ? inp.farir : 'Far-IR';
	this.microwave = (inp.microwave) ? inp.microwave : 'Microwave';
	this.radio = (inp.radio) ? inp.radio : 'Radio';
	this.labels = (inp.labels) ? inp.labels : 'Labels';
	this.centre = (inp.centre) ? inp.centre : 'Centre map at this point';
	this.wikisky = (inp.wikisky) ? inp.wikisky : 'View in Wikisky';
	this.wwt = (inp.wwt) ? inp.wwt : 'View in WorldWideTelescope';
	this.nearby = (inp.nearby) ? inp.nearby : 'Objects within 10&prime;';
}

// Try to load the external phrasebook as JSON.
// Usage: this.getLanguage('fr')
Chromoscope.prototype.getLanguage = function(lang){
	if(!lang) lang = 'en';
	var _obj = this;
	// Bug fix for reading local JSON file in FF3
	$.ajaxSetup({async:false,'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); } });
	// Get the JSON language file
	$.getJSON(this.dir+lang+'.js',function(json){ if(json.code == lang) _obj.changeLanguage(json); })
}

// Change the phrasebook and update the user interface.
// Usage: this.changeLanguage({code:'en'})
Chromoscope.prototype.changeLanguage = function(data){
	this.phrasebook = new Language(data);
	this.langshort = this.phrasebook.code;
	this.buildHelp(true);
	this.buildLinks();
	this.buildLang();
	if(this.showintro) this.buildIntro();
	this.makeWavelengthSlider();
	var body = (!this.container) ? "body" : this.container;
	$(body+" .chromo_version").html(this.phrasebook.version+" "+this.version);
	if($.browser.opera && $.browser.version == 9.3){ $(".keyboard").hide(); $(".nokeyboard").show(); }
}

// Reset the map
Chromoscope.prototype.reset = function(){

	this.setMagnification(-1);
	this.moveMap(0,0,this.minZoom())
	
	// Turn off the annotation layers
	if(this.q.annotations == null || !this.q.annotations){
		for(var i=0 ; i < this.annotations.length ; i++) setOpacity($(this.container+" ."+this.annotations[i].name),0.0);
	}

	if(this.spectrum.length > 0){
		// Use a user suggested wavelength or default to visible
		if(this.q.w){
			if(typeof this.q.w=="number"){
				this.setWavelength(this.q.w);
				this.checkTiles();
				this.changeWavelength(0);
			}else if(typeof this.q.w=="string") this.changeWavelengthByName(this.q.w);
		}else{
			var templ = 'v';
			for(var i=0 ; i < this.spectrum.length ; i++){
				if(this.spectrum[i].useasdefault){
					templ = this.spectrum[i].key;
					break;
				}
			}
			this.changeWavelengthByName(templ);
		}
		// Now position the map
		this.positionMap();

		// Fix for IE as it does its own thing to the opacities.
		if(jQuery.browser.msie) this.changeWavelength(0);
	}
	this.wrapPins();
}

Chromoscope.prototype.activate = function(){ chromo_active = this; }

Array.prototype.avg = function() {
	var av = 0;
	var n = 0;
	var len = this.length;
	for (var i = 0; i < len; i++) {
		var e = +this[i];
		if(!e && this[i] !== 0 && this[i] !== '0') e--;
		if (this[i] == e) {av += e; n++;}
	}
	return av/n;
}

// This is the main function which sets everything up.
// Usage: loadChromoscope([callback])
//	callback = An optional function that will be called after this executes.
Chromoscope.prototype.load = function(callback){

	// Does the container actually exist?
	if(this.container){
		// No container so build a message to say that
		if($(this.container).length == 0){

			// No message holder so let's make one of those first
			if($(".chromo_message").length == 0) $(document).append('<div class="chromo_message"></div>');
			$(".chromo_message").css({width:"500px","text-align":"center"});
			this.message("The element <strong>"+this.container+"</strong> doesn't seem to exist.",2000);
			this.container = '';
			return true;
		}
		var body = this.container;
		$(this.container).bind('mouseover', {me:this}, function(e){
			e.data.me.activate(); //ChromoscopeActivate(e.data.me)
		}).bind('mouseout', function(e){
			chromo_active = "";
		});

	}else var body = 'body';
 
	// Add any query string defined kml files
	// Should we only do this if only one instance?
	if(this.q.kml) this.kmls[this.kmls.length] = this.q.kml;
	if(this.q.json) this.kmls[this.kmls.length] = this.q.json;

	// Check for defined elements. If they don't exist let's create them
	if($(body+" .chromo_outerDiv").length == 0) $(body).append('<div class="chromo_outerDiv"><div class="chromo_innerDiv"></div></div>');
	if(this.title && $(body+" .chromo_title").length == 0) $(body).append('<div class="chromo_title"><h1><a href="#">Chromoscope</a></h1><h2 class="chromo_version"></h2></div>');
	if($(body+" .chromo_attribution").length == 0) $(body).append('<p class="chromo_attribution"></p>');
	if($(body+" .chromo_info").length == 0) $(body).append('<p class="chromo_info"></p>');
	if($(body+" .chromo_message").length == 0) $(body).append('<div class="chromo_message"></div>');
	if($(body+" .chromo_layerswitcher").length == 0) $(body).append('<div class="chromo_layerswitcher"></div>');
	
	this.processLayers();

	// Make sure the container is absolutely positioned.
	if(this.container) $(this.container).css('position','relative');
	else $(body+" .chromo_outerDiv").css({position:'absolute',height:'0px'});

	// Opera 10.10 doesn't like transparency and for some reason jQuery sometimes thinks it is version 9.8
	if($.browser.opera && $.browser.version < 10.3){ this.annotations = ""; this.wavelength_load_range = 0; this.spatial_preload = 1; }

	if(!this.title) $(body+" .chromo_title").toggle();
	$(body+" .chromo_version").html(this.phrasebook.version+" "+this.version);
	$(body+" .chromo_outerDiv").append('<div id="chromo_zoomer" style="width:50px;height:50px;display:none;"><div style="position:absolute;width:10px;height:10px;left:0px;top:0px;border-top:2px solid white;border-left:2px solid white;"></div><div style="position:absolute;width:10px;height:10px;right:0px;top:0px;border-top:2px solid white;border-right:2px solid white;"></div><div style="position:absolute;width:10px;height:10px;right:0px;bottom:0px;border-bottom:2px solid white;border-right:2px solid white;"></div><div style="position:absolute;width:10px;height:10px;left:0px;bottom:0px;border-bottom:2px solid white;border-left:2px solid white;"></div></div>');
	//$(body+" .chromo_innerDiv").disableTextSelect();	//No text selection

	// Define the mouse events
	$(body+" .chromo_outerDiv").mousedown({me:this},function(ev){
		var chromo = ev.data.me;
		if(ev.button != 2 && chromo.allowdrag){
			// Don't do anything for a right mouse button event
			this.dragStartLeft = ev.clientX;
			this.dragStartTop = ev.clientY;
			this.y = $(chromo.container+" .chromo_innerDiv").position().top;
			this.x = $(chromo.container+" .chromo_innerDiv").position().left;
			this.dragging = true;
			this.moved = true;
			this.clock = new Date();
			$(chromo.container+" .chromo_innerDiv").css({cursor:'grabbing',cursor:'-moz-grabbing'});	
			return false;
		}
	}).mousemove({me:this},function(ev){
		var chromo = ev.data.me;
		if(this.dragging){
			newtop = this.y + (ev.clientY - this.dragStartTop);
			newleft = this.x + (ev.clientX - this.dragStartLeft);
			this.mapSize = Math.pow(2, this.zoom)*this.tileSize;
			newpos = chromo.limitBounds(newleft,newtop);
			$(chromo.container+" .chromo_innerDiv").css("top",newpos.top);
			$(chromo.container+" .chromo_innerDiv").css("left",newpos.left);
			var check = true;
			if(this.performance){
				var tempclock = new Date();
				if(tempclock - this.clock < 500) check = false;
			}
			// We don't need to constantly check the tiles. Only
			// recheck if we haven't checked within the past 0.5s
			if(check){
				chromo.checkTiles();
				this.clock = tempclock;
				var coords = chromo.getCoords();
				if(typeof chromo.events.move=="function") chromo.events.move.call(chromo,{position:coords,zoom:chromo.zoom});
			}
		}
		// If the shift key is pressed we will show the cursor position
		if(ev.shiftKey==1){
			var offx = ($(chromo.container).length > 0) ? $(chromo.container).offset().left : 0;
			var offy = ($(chromo.container).length > 0) ? $(chromo.container).offset().top : 0;
			chromo.updateCoords((ev.clientX)-offx,(ev.clientY)-offy);
		}
	}).mouseup({me:this},function(ev){
		var chromo = ev.data.me;
		if(!chromo) return;
		// Bind the double tap to double click
		if('ontouchstart' in document.documentElement){
			var delay = 500;
			var now = new Date().getTime();
			if(!this.lastTouch) this.lastTouch = now + 1;
			var delta = now - this.lastTouch;
			this.lastTouch = now;
			if(delta < delay && delta > 0){
				chromo.changeMagnification(1,ev.pageX,ev.pageY);
				chromo.updateCoords();
				return false;
			}
		}
		chromo.checkTiles();
		chromo.updateCoords();
		$(chromo.container+" .chromo_innerDiv").css({cursor:''});
		this.dragging = false;
		// Fix for IE as it seems to set any tiles off-screen to 0 opacity by itself
		if(jQuery.browser.msie) chromo.changeWavelength(0);
	}).dblclick({me:this},function (ev) {
		var chromo = ev.data.me;
		if(!chromo) return;
		chromo.changeMagnification(1,ev.pageX,ev.pageY);
		chromo.updateCoords();
		return false;
	}).bind('mousewheel',{me:this},function(ev, delta) {
		var chromo = ev.data.me;
		if(!chromo) return;
		if(delta > 0) chromo.changeMagnification(1,ev.pageX,ev.pageY);
		else chromo.changeMagnification(-1,ev.pageX,ev.pageY);
		return false;
	})

	// Define keyboard commands
	this.registerKey(38,function(){ // user presses the down arrow key  (37 was left)
		this.changeWavelength(-this.wavelength_speed);
		this.checkTiles();
	}).registerKey(40,function(){ // user presses the up arrow key  (39 was right)
		this.changeWavelength(this.wavelength_speed);
		this.checkTiles();
	}).registerKey([107,61,187,33],function(){ // user presses the + (107 for Firefox, 187 for Safari, 33 for pageup)
		this.changeMagnification(1);
	}).registerKey([109,189,34],function(){ // user presses the - (109 for Firefox, 189 for Safari, 34 for pagedown)
		this.changeMagnification(-1);
	}).registerKey(['h','?'],function(){ // 63 is question mark
		this.toggleByID(".chromo_help");
	}).registerKey('i',function(){
		$(this.container+" .chromo_info").toggle();
	}).registerKey('k',function(){
		$(this.container+" .chromo_layerswitcher").toggle();
	}).registerKey('c',function(){
		$(this.container+" .chromo_help").hide();
		$(this.container+" .chromo_message").hide();
	}).registerKey('.',function(){
		$(this.container+" h1").toggle();
		$(this.container+" h2").toggle();
		$(this.container+" .chromo_message").hide();
		$(this.container+" .chromo_layerswitcher").toggle();
		$(this.container+" .chromo_helplink").toggle();
		$(this.container+" .chromo_help").hide();
		$(this.container+" .chromo_info").hide();
	});

	// If we have a touch screen browser, we should convert touch events into mouse events.
	if('ontouchstart' in document.documentElement) $(body+" .chromo_outerDiv").addTouch();

	this.activate(); //ChromoscopeActivate(this)
	this.setViewport();

	// For a Wii make text bigger, hide annotation layer and keyboard shortcuts
	if(navigator.platform == "Nintendo Wii" || ('ontouchstart' in document.documentElement && (this.wide <= 800 || this.tall < 600))){ $(body+" .chromo_layerswitcher").css({'font-size':'1.5em'}); this.annotations = ""; $(".keyboard").css({'display':'none'}); $(".nokeyboard").css({'display':'show'}); this.wavelength_load_range = 0; this.spatial_preload = 1; }

	if(this.q.kml) this.message('Loading '+this.q.kml+'.<br />It may take a few seconds.');
	else if(this.q.json) this.message('Loading '+this.q.json+'.<br />It may take a few seconds.');
	

	// Set the default zoom level
	this.setMagnification(this.zoom);

	if(this.spectrum.length == 0){
		$(this.container+" .chromo_message").css({width:"400px","text-align":"center"});
		this.message("No wavelengths have been added to your HTML file so there's nothing to see. :-(",2000);
	}else{
		// Sort out wavelength order and slider bar
		if(this.q.o) this.orderWavelengths(this.q.o.split(","));
		if(this.sliderbar) this.makeWavelengthSlider();

		// Turn off the annotation layer
		if(this.q.annotations == null || !this.q.annotations) this.toggleAnnotationsByName('l');

		// Use a user suggested wavelength or default to visible
		if(typeof this.q.w!="undefined"){
			if(typeof this.q.w=="number"){
				this.setWavelength(this.q.w);
				this.checkTiles();
				this.changeWavelength(0);
			}else if(typeof this.q.w=="string") this.changeWavelengthByName(this.q.w);
		}else if(this.lambda != 0){
			this.setWavelength(this.lambda);
			this.checkTiles();
			this.changeWavelength(0);
		}else{
			var templ = 'v';
			for(var i=0 ; i < this.spectrum.length ; i++){
				if(this.spectrum[i].useasdefault){
					templ = this.spectrum[i].key;
					break;
				}
			}
			this.changeWavelengthByName(templ);
		}

		// Now position the map
		this.positionMap();

		// Fix for IE as it does its own thing to the opacities.
		if(jQuery.browser.msie) this.changeWavelength(0);

	}

	this.buildHelp();
	this.buildLinks();
	this.buildLang();
	if(this.showintro) this.buildIntro();
	if(this.showcontext) this.buildContextMenu();
	
	// Disable keyboard commands on input text fields
	$(this.container+" input[type=text]").live("focus",{sky:this},function(e){
		if(!e.data.sky.ignorekeys) e.data.sky.ignorekeys = true;
	}).live("blur",{sky:this},function(e){
		if(e.data.sky.ignorekeys) e.data.sky.ignorekeys = false;
	});

	if($.browser.opera && $.browser.version == 9.3){ $(".keyboard").hide(); $(".nokeyboard").show(); }

	$(this.container+" .chromo_title a").bind('click', jQuery.proxy( this, "reset" ) );


	// Now load a language if required
	if(this.q.lang) this.getLanguage(this.q.lang)
	else{ this.getLanguage(this.langshort); }

	// Make it sortable (if we have the jQuery/UI options available)
	if(typeof $().sortable=="function"){
		var cur = ($.browser.mozilla) ? 'move' : 'grabbing'; 
		$(this.container+" .chromo_keys").sortable({containment:'parent',forcePlaceHolderSize:true,placeholder:'chromo_key_highlight',cursor:cur});
		$(this.container+" .chromo_keys").bind('sortupdate',{el:this},function (event,ui){ event.data.el.orderWavelengths($(this).sortable('toArray')); });
	}

	// If kml is defined as a string load it up
	// We need to send the callback function into it
	// because we don't want to execute the callback
	// until the AJAX XML request comes back.
	for (var k = 0; k < this.kmls.length; k++) { this.readKML(this.kmls[k],callback,30000); $(this.container+" .chromo_info").append("KML "+this.kmls[k]+"<br />"); }

	// If we haven't done any XML loading, we should
	// now execute the callback function
	if(this.kmls.length == 0 && typeof callback=="function") callback.call();
	$(this.container+" .chromo_info").html("Took " + (new Date() - this.start) + "ms to load.")
}

// Construct the Help box
Chromoscope.prototype.buildHelp = function(overwrite){
	var body = (!this.container) ? "body" : this.container;

	// Construct the help box
	var txt = this.phrasebook.helpdesc;
	if(this.phrasebook.translator) txt += '<br /><br />'+this.phrasebook.name+': '+this.phrasebook.translator;
	if($(body+" .chromo_help").length == 0) $(body).append('<div class="chromo_help">'+txt+'</div>');
	else{ if(overwrite) $(body+' .chromo_help').html(txt); }
	var buttons = "<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('k')\">Hide/show the wavelength slider</a></li>";
	buttons += "<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('+')\">Zoom in</a></li>";
	buttons += "<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('-')\">Zoom out</a></li>";
	var h = (this.phrasebook.helpmenu) ? this.phrasebook.helpmenu : this.phrasebook.help;
	var keys = "<li><strong>h</strong> - "+h+"</li>";
	for(var i=0 ; i < this.spectrum.length ; i++){
		if(this.spectrum[i].key) {
			if(typeof this.spectrum[i].title=="object"){
				var l = (!this.spectrum[i].title[this.langshort]) ? 'en' : this.langshort;
				var t = this.spectrum[i].title[l]
			}else{
				if(this.phrasebook[this.spectrum[i].title]) var t = this.phrasebook[this.spectrum[i].title];
				else var t = this.spectrum[i].title;
			}
			var s = this.phrasebook.switchtext.replace("__WAVELENGTH__",t)
			keys += "<li><strong>"+this.spectrum[i].key+'</strong> - '+s+"</li>";
		}
	}
	for(var i=0 ; i < this.annotations.length ; i++){
		if(this.annotations[i].key){
			var s = this.phrasebook.switchannotation.replace("__ANNOTATION__",this.annotations[i].title)
			keys += "<li><strong>"+this.annotations[i].key+'</strong> - '+s+"</li>";
		}
	}
	keys += "<li><strong>.</strong> - "+this.phrasebook.showhide+"</li>";
	keys += "<li><strong>&uarr;</strong> - "+this.phrasebook.up+"</li>";
	keys += "<li><strong>&darr;</strong> - "+this.phrasebook.down+"</li>";
	keys += "<li><strong>+</strong> - "+this.phrasebook.zoomin+"</li>";
	keys += "<li><strong>&minus;</strong> - "+this.phrasebook.zoomout+"</li>";
	$(body+" .chromo_controlbuttons").html(buttons);
	$(body+" .chromo_controlkeys").html(keys);

	if(!this.ignorekeys || !this.container){
		$(body+" .chromo_help").prepend(this.createClose());
		var w = (this.wide > 600) ? 600 : this.wide;
		$(body+" .chromo_help").css("width",(w-50)+"px");
		this.centreDiv(".chromo_help");
	}

	// Construct the help link
	if($(body+" .chromo_helplink").length == 0) $(body).append('<p class="chromo_helplink"></p>');

	this.centreDiv(".chromo_help");
}

// Construct the links
Chromoscope.prototype.buildLinks = function(overwrite){
	var body = (!this.container) ? "body" : this.container;

	if($(body+" .chromo_helplink").length == 0) $(body).append('<p class="chromo_helplink"></p>');

	// Construct the Make a Link
	var str = "";
	if(!this.compact) str = '<span class="chromo_helphint chromo_link">'+this.phrasebook.help+'</span>';
	if(!this.compact && this.showabout) str+= ' | <a href="http://blog.chromoscope.net/about/" class="chromo_about">'+this.phrasebook.about+'</a>';
	if(!($.browser.opera && $.browser.version == 9.3)){
		if(!this.compact && this.showshare) str += ' | <span class="chromo_linkhint chromo_link">'+this.phrasebook.share+'</span>';
		if(this.langs.length > 1 && !this.compact && this.showlangs){
			if(str) str += ' | ';
			str += '<span class="chromo_langhint chromo_link">Language ('+this.langshort+')</span>';
		}
		if(this.showcoord){
			if(str) str += ' | '
			str += '<span class="chromo_coords"></span>';
		}
	}
	$(body+" .chromo_helplink").html(str);
	$(body+" .chromo_linkhint").bind('click', jQuery.proxy( this, "createLink" ) );
	$(body+" .chromo_langhint").bind('click',{id:'.chromo_lang'}, jQuery.proxy( this, "toggleByID" ) );
	$(body+" .chromo_helphint").bind('click',{id:'.chromo_help'}, jQuery.proxy( this, "toggleByID" ) );
	$(body+" .chromo_close").bind('click',{id:'.chromo_help'}, jQuery.proxy( this, "toggleByID" ) );
	// Allow coordinates to be converted
	$(this.container+" .chromo_coords").css({cursor:'pointer'});
	$(body+" .chromo_coords").bind('click',{el:this},function (event){
		event.data.el.coordtype = (event.data.el.coordtype == "G") ? "A" : "G";
		event.data.el.updateCoords(); 
	});

	if(!($.browser.opera && $.browser.version == 9.3)) this.updateCoords();
}

// Construct the context-sensitive menu
Chromoscope.prototype.buildContextMenu = function(){
	var body = (!this.container) ? "body" : this.container;
	$(body+' .chromo_outerDiv').bind("contextmenu",{el:this,body:body},function(e){
		var body = e.data.body;
		var offset = 2;
		var offx = ($(e.data.el.container).length > 0) ? $(e.data.el.container).offset().left : 0;
		var offy = ($(e.data.el.container).length > 0) ? $(e.data.el.container).offset().top : 0;
		var newtop = (e.clientY)-offy;
		var newleft = (e.clientX)-offx;
		var coords = e.data.el.getCoords(newleft,newtop);
		var radec = Galactic2Equatorial(coords.l,coords.b);
		if($(body+" .chromo_context").length == 0) $(body).append('<div class="chromo_context" style="color:black;background-color:#eee;position:absolute;padding:2px;font-size:0.9em;z-index:1001;cursor:default;"></div>');
		var output = '<ul style="margin:0px;padding:0px;font-size:0.9em;list-style:none;display:block;">'+(e.data.el.buildContextMenuItems({l:coords.l,b:coords.b,z:e.data.el.zoom,ra:radec.ra,dec:radec.dec}))+'</ul>';
		$(body+" .chromo_context").html(output).bind('mouseleave', {el:e.data.el,body:body}, function(e){ $(e.data.body+' .chromo_context').hide(); e.data.el.dragging = false; });
		$(body+" .chromo_context li a").css({padding:'3px',display:'block',textDecoration:'none',color:'black'});
		$(body+" .chromo_context li a").hover( function(){
			$(this).css('background-color', '#ccc');
		},function(){
			$(this).css('background-color', 'transparent');
		});
		var w = $(body+" .chromo_context").outerWidth();
		var h = $(body+" .chromo_context").outerHeight();
		if(newleft+w > e.data.el.wide) newleft -= w-2*offset;
		if(newtop+h > e.data.el.tall) newtop -= h-(2*offset);
		$(body+" .chromo_context").css({left:(newleft-offset)+'px',top:(newtop-offset)+'px',width:'200px'}).show();
		e.data.el.dragging = false;
		return false;
	});
}

// Function that returns <li> items for the context-sensitive menu.
// Inputs are:
// 	inp.l = Galactic longitude (decimal degrees)
// 	inp.b = Galactic latitude (decimal degrees)
// 	inp.z = zoom level
// 	inp.ra = Right Ascension (decimal hours)
// 	inp.dec = Declination (decimal degrees)
Chromoscope.prototype.buildContextMenuItems = function(inp){
	return '<li><a href="#" onClick="javascript:chromo_active.moveMap('+inp.l+','+inp.b+','+inp.z+');return false;">'+(this.phrasebook.centre)+'</a><li><a href="http://server1.wikisky.org/v2?ra='+inp.ra+'&de='+inp.dec+'&zoom='+(inp.z-2)+'&img_source=DSS2">'+this.phrasebook.wikisky+'</a></li><li><a href="http://www.worldwidetelescope.org/wwtweb/goto.aspx?object=ViewShortcut&ra='+(inp.ra)+'&dec='+inp.dec+'&zoom='+(0.3*60*360/Math.pow(2,inp.z))+'">'+this.phrasebook.wwt+'</a></li><li><a href="http://simbad.u-strasbg.fr/simbad/sim-coo?Coord='+inp.l.toFixed(4)+'+'+inp.b.toFixed(4)+'&CooFrame=Gal&CooEpoch=2000&CooEqui=2000&Radius=10">'+this.phrasebook.nearby+' (Simbad)</a></li><li><a href="http://nedwww.ipac.caltech.edu/cgi-bin/nph-objsearch?search_type=Near+Position+Search&in_csys=Galactic&in_equinox=J2000.0&lon='+inp.l+'&lat='+inp.b+'&radius=10&hconst=73&omegam=0.27&omegav=0.73&corr_z=1&z_constraint=Unconstrained&z_value1=&z_value2=&z_unit=z&ot_include=ANY&nmp_op=ANY&out_csys=Equatorial&out_equinox=J2000.0&obj_sort=Distance+to+search+center&of=pre_text&zv_breaker=30000.0&list_limit=20&img_stamp=YES">'+this.phrasebook.nearby+' (NED)</li>';
}

// Construct the Language Switcher
Chromoscope.prototype.buildLang = function(overwrite){
	var body = (!this.container) ? "body" : this.container;
	
	var lang = '<ul>';
	for(l = 0; l < this.langs.length ; l++) if(this.langs[l].code != this.langshort) lang += '<li><a href="?lang='+this.langs[l].code+'" onClick="javascript:chromo_active.getLanguage(\''+this.langs[l].code+'\');return false;">'+this.langs[l].name+' ('+this.langs[l].code+')</a></li>'; else this.langlong = this.langs[l].name;
	lang += '</ul>';
	if($(body+" .chromo_lang").length == 0) $(body).append('<div class="chromo_lang chromo_popup">'+lang+'</div>');
	else $(body+" .chromo_lang").html(lang);
	var w = (this.wide > 160) ? 160 : this.wide;
	$(body+" .chromo_lang").css("width",(w)+"px");

	var p = $(body+" .chromo_langhint").position();
	var h = $(body+" .chromo_helplink").position();
	if(p){
		var l = (h.left+p.left-$(body+" .chromo_lang").outerWidth()/2+$(body+" .chromo_langhint").outerHeight()/2);
		if(l < 10) l = 10;
		var t = (h.top-$(body+" .chromo_lang").outerHeight()-10);
		$(body+" .chromo_lang").css({position:'absolute',left:l+'px',top:t+'px'});
	}
	$(body+" .chromo_lang").hide();
}

// Construct the Language Switcher
Chromoscope.prototype.showVideoTour = function(){
	var body = (!this.container) ? "body" : this.container;
	var w = 560;
	var h = 340;
	var scale = 1;
	if(w > this.wide*0.8) w = this.wide*0.8; h = w*0.6;
	if(h > this.tall*0.75) h = this.tall*0.75; w = h*1.6;

	$(body+" .chromo_help").hide();
	$(body+" .chromo_message").css({width:(w)+"px","text-align":"center"});
	this.message(this.createClose()+'<object width="'+w+'" height="'+h+'"><param name="movie" value="http://www.youtube.com/v/eE7-6fQ9_48&hl=en_GB&fs=1&"></param><param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param><embed src="http://www.youtube.com/v/eE7-6fQ9_48&hl=en_GB&fs=1&" type="application/x-shockwave-flash" allowscriptaccess="always" allowfullscreen="true" width="'+w+'" height="'+h+'"></embed></object>');
	$(body+" .chromo_message .chromo_close").bind('click',{id:'.chromo_message'}, jQuery.proxy( this, "toggleByID" ) );
}

// Construct the splash screen
Chromoscope.prototype.buildIntro = function(delay){
	var body = (!this.container) ? "body" : this.container;
	var w = 600;
	// iPhones have wide but not very tall screens so we make the intro a bit wider if the screen height is small.
	if(this.tall <= 640) w *= 1.2;
	if(w > 0.8*this.wide) w = 0.8*this.wide;
	$(body+" .chromo_message").css({width:w+"px","text-align":"left"});
	if(this.showintro) this.message(this.createClose()+this.phrasebook.intro)
	$(body+" .chromo_message .chromo_close").bind('click',{id:'.chromo_message'}, jQuery.proxy( this, "toggleByID" ) );
	if(this.showintro && delay > 0) $(body+" .chromo_message").delay(delay).fadeOut(500)
}

Chromoscope.prototype.showLang = function(){
	var body = (!this.container) ? "body" : this.container;
	$(body+" .chromo_lang").show();
}

// If the window resizes (e.g. going fullscreen)
// we need to recalculate the screen properties
// and re-position things.
$(window).resize(function(){
	chromo_active.setViewport();
	chromo_active.positionMap({l:chromo_active.l,b:chromo_active.b});
	chromo_active.centreDiv(".chromo_help");
	chromo_active.centreDiv(".chromo_message");
});

// Register keyboard commands and associated functions
Chromoscope.prototype.registerKey = function(charCode,fn,txt){
	if(typeof fn!="function") return this;
	if(typeof charCode!="object") charCode = [charCode];
	for(c = 0 ; c < charCode.length ; c++){
		ch = (typeof charCode[c]=="string") ? charCode[c].charCodeAt(0) : charCode[c];
		available = true;
		for(i = 0 ; i < this.keys.length ; i++){
			if(this.keys.charCode == ch) available = false;
		}
		if(available){
			this.keys.push({charCode:ch,char:String.fromCharCode(ch),fn:fn});
			if(txt) $(this.container+" .chromo_controlkeys").append('<li><strong>'+String.fromCharCode(ch)+'</strong> - '+txt+'</li>');
		}
	}
	return this;
}

// Press a key
Chromoscope.prototype.keypress = function(charCode,event){
	if(this.ignorekeys) return true;
	for(i = 0 ; i < this.keys.length ; i++){
		if(this.keys[i].charCode == charCode){
			this.keys[i].fn.call(this,{event:event});
			break;
		}
	}	
}

// Disable keyboard control
function disableKeys(option){ if(chromo_active) chromo_active.ignorekeys = option; }

// Enable keyboard control
function allowKeyPress(){ if(chromo_active) { return !chromo_active.ignorekeys; } else { return false; } }

// A fake key press. Allows us to use the 
// functionality of the key press commands 
// without the user pressing anything.
function simulateKeyPress(character) {
	evtype = (character == '+' || character == '-') ? "keydown" : "keypress";
	jQuery.event.trigger({ type : evtype, which : character.charCodeAt(0)});
}

// Define the size and position of the main viewport
Chromoscope.prototype.setViewport = function(){
	this.wide = (this.container) ? $(this.container).width() : $(window).width();
	this.tall = (this.container) ? $(this.container).height() : $(window).height();
	if(this.compact){
		$(this.container).css("font-size","0.7em");
		$(this.container+" .chromo_title").css("font-size","1em");
	}
	$(this.container+" .chromo_outerDiv").css('width',this.wide);
	$(this.container+" .chromo_outerDiv").css('height',this.tall);
	$(this.container+" .chromo_outerDiv").css({left:0,top:0});
}

// Build a structure containing information about a wavelength layer.
// Usage: chromo_active.spectrum[s++] = new Wavelength({useasdefault:false,key:'f',name:'farir',tiles:'IR-tiles/',ext:'jpg',title:'Far-IR',attribution:'IRAS/NASA'});
//	useasdefault (boolean) = If true this will be the starting wavelength displayed
//	key (string) = A keyboard shortcut to go to this wavelength
//	name (string) = An internal ID for this wavelength. Should be unique.
//	tiles (string) = The path to the directory containing the tiles. Can be remote.
//	ext (string) = The file extension. Likely to be jpg if using the Google Maps Image Cutter 
//	title (string) = The text that will appear in the wavelength slider
//	attribution (string) = The text that contains the credit line. Can contain HTML links.
function Wavelength(input){
	return new ChromoscopeLayer(input);
}

// Build a structure containing information about an annotation layer. It has the same inputs aas Wavelength
// Usage: chromo_active.annotations[0] = new AnnotationLayer({opacity:0.4,key:'l',name:'labels',tiles:'labels-tiles/',ext:'jpg'});
//	opacity (number) = The opacity of this layer
//	key (string) = A keyboard shortcut to toggle this annotation
//	name (string) = An internal ID for this annotation. Should be unique.
//	tiles (string) = The path to the directory containing the tiles. Can be remote.
//	ext (string) = The file extension. Likely to be jpg if using the Google Maps Image Cutter 
function AnnotationLayer(input){
	return new ChromoscopeLayer(input);
}

function ChromoscopeLayer(input){
	if(input){
		this.useasdefault = (input.useasdefault) ? true : false;	
		this.layer = (input.layer) ? input.layer : null;
		this.opacity = (input.opacity) ? input.opacity : 0.0;
		this.title = (input.title) ? input.title : '';
		this.name = (input.name) ? input.name : '';
		this.attribution = (input.attribution) ? input.attribution : '';
		this.key = (input.key) ? input.key : '';
		this.tiles = (input.tiles) ? input.tiles : '';
		this.ext = (input.ext) ? input.ext : 'jpg';
		this.range = {longitude:[-180,180],latitude:[-90,90],x:[0,0],y:[0,0]};
		this.limitrange = false;
		this.blank = (input.blank) ? input.blank : 'blank.jpg';
		if(typeof input.range=="object"){
			if(typeof input.range.longitude=="object") this.range.longitude = input.range.longitude;
			if(typeof input.range.latitude=="object") this.range.latitude = input.range.latitude;
			this.limitrange = true;
		}
	}
}

// Add to the wavelength array
Chromoscope.prototype.addWavelength = function(input){
	this.spectrum[this.spectrum.length] = new Wavelength(input);
	if(typeof input.key=="string"){
		var character = input.key;
		this.registerKey(input.key,function(){
			this.changeWavelengthByName(character);
			this.checkTiles();
		});
	}
	return this;
}

// Add to the annotations array
Chromoscope.prototype.addAnnotationLayer = function(input){
	this.annotations[this.annotations.length] = new AnnotationLayer(input);
	if(typeof input.key=="string"){
		var character = input.key;
		this.registerKey(input.key,function(){
			this.toggleAnnotationsByName(character);
			this.checkTiles(true);
		});
	}
	return this;
}

// Rearrange the order of the wavelengths.
// This input array can either be the keys or the 
// IDs for the wavelengths in the slider.
Chromoscope.prototype.orderWavelengths = function(order){
	var tempspec = new Array();
	var k = 0;
	for(var j=0 ; j < order.length ; j++){
		for(var i=0 ; i < this.spectrum.length ; i++){
			if(order[j] == this.container+'-key-'+this.spectrum[i].key || order[j] == this.spectrum[i].key) tempspec[k++] = this.spectrum[i];
		}
	}
	this.spectrum = tempspec;
}

// Add to the wavelength array
Chromoscope.prototype.cloneLayers = function(other){
	this.spectrum = other.spectrum;
	this.annotations = other.annotations;
}

// Construct the wavelength slider and give it mouse events
Chromoscope.prototype.makeWavelengthSlider = function(){

	var body = (!this.container) ? "body" : this.container;
	$(body+" .chromo_layerswitcher span").css('margin','5px');

	var layerswitch = "<div class=\"chromo_sliderbar\"><div class=\"chromo_slider\"></div></div><div class=\"chromo_keys\">";
	for(var i=0 ; i < this.spectrum.length ; i++){
		if(typeof this.spectrum[i].title=="object"){
			var l = (!this.spectrum[i].title[this.langshort]) ? 'en' : this.langshort;
			var t = this.spectrum[i].title[l]
		}else{
			if(this.phrasebook[this.spectrum[i].name]) var t = this.phrasebook[this.spectrum[i].name];
			else var t = this.spectrum[i].title;
		}
		var p = (this.spectrum[i].key) ? this.phrasebook.press.replace("__KEY__",this.spectrum[i].key) : "";
		layerswitch += '<span id="'+this.container+'-key-'+this.spectrum[i].key+'" title="'+p+'" class="chromo_key legend-'+this.spectrum[i].key+'">'+t+'</span>';
	}
	layerswitch += '</div>'
	$(body+" .chromo_layerswitcher").html(layerswitch);
	$(body+" .chromo_layerswitcher").disableTextSelect();	//No text selection
	for(var i=0 ; i < this.spectrum.length ; i++){
		if(this.spectrum[i].key) {
			$(body+" .legend-"+this.spectrum[i].key).bind("click",{key:this.spectrum[i].key,el:this},function(e){
				// Extract the key from the name
				e.data.el.changeWavelengthByName(e.data.key);
				e.data.el.checkTiles();
			});
		}
	}
	
	var margin_t = parseInt($(body+" .legend-"+this.spectrum[0].key).css('margin-top'));
	var h_full = parseInt($(body+" .legend-"+this.spectrum[this.spectrum.length-1].key).position().top + $(body+" .legend-"+this.spectrum[this.spectrum.length-1].key).outerHeight());
	var h = $(body+" .legend-"+this.spectrum[0].key).outerHeight();
	var w = $(body+" .chromo_sliderbar").outerWidth() - parseInt($(body+" .chromo_sliderbar").css('margin-right'));

	// Add some padding for the wavelength slider
	$(body+" .chromo_layerswitcher").css('padding-right',(h*2)+'px');
	$(body+" .chromo_slider").css({height:h,width:h*1.2,"margin-left":"-"+(h*0.2)+"px"});
	$(body+" .chromo_sliderbar").css({'margin-right':-(h)+'px',height:h_full,width:h*0.8,'margin-top':margin_t+'px'})
	
	$(this.container+" .chromo_sliderbar").bind('mousemove',{h:h,margin_t:margin_t},jQuery.proxy( this, "dragIt" ) );
	$(this.container+" .chromo_slider").bind('mousedown',{state:true},jQuery.proxy( this, "draggable" ) );
	$(this.container+" .chromo_sliderbar").bind('mouseup',{state:false},jQuery.proxy( this, "draggable" ) );
	$(this.container+" .chromo_slider").bind('mouseup',{state:false},jQuery.proxy( this, "draggable" ) );
	$(this.container+" .chromo_sliderbar").addTouch();
	$(this.container+" .chromo_slider").addTouch();
	this.positionSlider();
	if(this.zoomctrl) this.makeZoomControl();
}

// Set the draggingSlider property
Chromoscope.prototype.draggable = function(event){
	this.draggingSlider = event.data.state;
	if (this.draggingSlider){
		var cur = ($.browser.mozilla) ? '-moz-grabbing' : 'grabbing';
		$(this.container+" .chromo_slider").css({cursor:cur});
		$(this.container+" .chromo_sliderbar").css({cursor:cur});
	}else{
		$(this.container+" .chromo_slider").css({cursor:'pointer'});
		$(this.container+" .chromo_sliderbar").css({cursor:'default'});
	}
}

// Update the wavelength slider position
Chromoscope.prototype.dragIt = function(event){
	if (this.draggingSlider){
		var yheight = $(this.container+" .chromo_sliderbar").height() - (event.data.h);
		if(this.container) var yoff = $(this.container+" .chromo_layerswitcher").position().top + event.data.margin_t + (event.data.h)/2 + $(this.container).offset().top;
		else var yoff = $(".chromo_layerswitcher").position().top + event.data.margin_t + (event.data.h)/2;
		var fract = ((event.pageY)-yoff)/(yheight);
		this.changeWavelength(fract*(this.spectrum.length-1) - this.lambda);
		this.checkTiles();
	}
}

// Construct the wavelength slider and give it mouse events
Chromoscope.prototype.makeZoomControl = function(){
	var h = $(this.container+" .legend-"+this.spectrum[0].key).outerHeight();
	var zoomer = "<div style=\"float:right;margin-right:-"+(h*1.25)+"px;width:"+(h*1.2)+"px;\"><div class=\"chromo_zoom chromo_zoomin\" title=\""+this.phrasebook.zoomin+"\">+</div><div class=\"chromo_zoom chromo_zoomout\" title=\""+this.phrasebook.zoomout+"\">&minus;</div></div>";
	$(this.container+" .chromo_layerswitcher").append(zoomer);
	$(this.container+" .chromo_zoom").css({cursor:"pointer",padding:"0px",width:h+"px",height:"1.2em","text-align":"center","margin-bottom":"5px"});
	$(this.container+" .chromo_zoomin").bind('click', jQuery.proxy( this, "zoomIn" ) );
	$(this.container+" .chromo_zoomout").bind('click', jQuery.proxy( this, "zoomOut" ) );
}

// Process each wavelength and annotation. Build the wavelength slider and add key commands.
Chromoscope.prototype.processLayers = function(){
	for(var i=0 ; i < this.spectrum.length ; i++){
		var s = this.spectrum[i];
		if(s.name) $(this.container+" .chromo_innerDiv").append('<div class="map '+s.name+'"></div>');
		setOpacity($(this.container+" ."+s.name),this.opacity);
	}
	for(var i=0 ; i < this.annotations.length ; i++){
		var a = this.annotations[i];
		if(a.name) $(this.container+" .chromo_innerDiv").append('<div class="annotation '+a.name+'"></div>');
		setOpacity($(this.container+" ."+a.name),a.opacity);
	}
}

// Show or hide any element by the ID or style.
// Usage: toggleByID("#chromo_message")
Chromoscope.prototype.toggleByID = function(event){
	var id = (typeof event=="object") ? event.data.id : event;
	if($(this.container+" "+id).css("display") == 'none') $(this.container+" "+id).show();
	else $(this.container+" "+id).hide();
}

// Position the map based using query string parameters
// if they exist otherwise the map is centred.
Chromoscope.prototype.positionMap = function(c){
	if(typeof c=="object") this.moveMap(c.l,c.b,this.zoom);
	if(!this.moved){
		if(this.q.ra && this.q.dec){
			var coord = Equatorial2Galactic(this.q.ra, this.q.dec);
			this.moveMap(coord[0],coord[1],this.q.z);
		}else if(this.q.l || this.q.b){
			if(!this.q.l) this.q.l = 0.0;
			if(!this.q.b) this.q.b = 0.0;
			this.moveMap(this.q.l,this.q.b,this.q.z);
		}else if(this.ra && this.dec){
			var coord = Equatorial2Galactic(this.ra, this.dec);
			this.moveMap(coord[0],coord[1],this.zoom);
		}else if(this.l || this.b){
			if(!this.l) this.l = 0.0;
			if(!this.b) this.b = 0.0;
			this.moveMap(this.l,this.b,this.zoom);
		}else{
			if(typeof this.q.z=="number" && this.q.z!=this.zoom) this.setMagnification(this.q.z);
			this.centreMap();
		}
	}
}


// Set the bounds to stop us going above the north
// Galactic pole or below the south. Also allow
// wrapping in x.
Chromoscope.prototype.limitBounds = function(left,top,virtual){
	virtual = (typeof virtual=="boolean") ? virtual : false;
	// no wrapping in x
	//if(newleft < this.wide - this.mapSize) newleft = this.wide - this.mapSize
	//if(newleft > 0) newleft = 0;
	// wrapping in x
	if(left > 0){
		left -= this.mapSize;
		if(!virtual){
			$(this.container+" .chromo_innerDiv").css({left:left});
			this.checkTiles();
		}
	}
	if(left < -this.mapSize){
		left += this.mapSize;
		if(!virtual){
			$(this.container+" .chromo_innerDiv").css({left:left});
			this.checkTiles();
		}
	}
	// no wrapping in y
	if(top < this.tall - this.mapSize*0.75) top = this.tall - this.mapSize*0.75;
	if(top > -this.mapSize*0.25) top = -this.mapSize*0.25;
	return {left:left,top:top}
}

// Position the map at a specific set of Galactic coordinates 
// (l,b), zoom level and with a certain duration
// Usage: moveMap(l,b,z,[duration])
//	l (number) = Galactic longitude (degrees)
//	b (number) = Galactic latitude (degrees)
//	z (number) = Zoom level. A value of -1 should be used if you don't want to affect the zoom.
//	duration (number) = The duration of the transition in milliseconds (default = 0)
Chromoscope.prototype.moveMap = function(l,b,z,duration){
	z = (z && z >= 0) ? z : 5;
	duration = (duration) ? duration : 0;
	var oldmapSize = this.mapSize;
	if(z > 0) this.setMagnification(z);

	l = l%360;
	var newl = (l <= 180) ? -(l) : (360-l);
	var newleft = -((newl)*this.mapSize/360)+(this.wide - this.mapSize)/2;
	var newtop = ((b)*this.mapSize/360)+(this.tall - this.mapSize)/2;
	var el = $(this.container+" .chromo_innerDiv");

	if(duration){
		var newpos = this.limitBounds(newleft,newtop,true);
		if(el.position().left-newpos.left > this.mapSize/2) el.css({left:el.position().left-this.mapSize});
		var _obj = this;
		el.animate(newpos,{
			duration:duration,
			step:function(now,fx){ _obj.checkTiles(); },
			complete:function(){
				_obj.checkTiles();
				_obj.updateCoords();
				if(typeof _obj.events.move=="function") _obj.events.move.call(_obj,{position:{l:l,b:b},zoom:z});			
			}
		});
	}else{
		var newpos = this.limitBounds(newleft,newtop);
		el.css(newpos);
		if(jQuery.browser.msie) this.changeWavelength(0);
		this.checkTiles();
		this.updateCoords();
		if(typeof this.events.move=="function") this.events.move.call(this,{position:{l:l,b:b},zoom:z});
	}
}

// Update the coordinate holder
Chromoscope.prototype.updateCoords = function(x,y){
	var coords = this.getCoords(x,y);
	this.l = coords.l;
	this.b = coords.b;
	if(this.coordtype == 'G') var label = ''+coords.l.toFixed(2)+'&deg;, '+coords.b.toFixed(2)+'&deg; <a href="'+this.phrasebook.gal+'" title="'+this.phrasebook.galcoord+'" style="text-decoration:none;">Gal</a>'; //$(this.container+" .chromo_coords").html(''+coords.l.toFixed(2)+'&deg;, '+coords.b.toFixed(2)+'&deg; <a href="'+this.phrasebook.gal+'" title="'+this.phrasebook.galcoord+'" style="text-decoration:none;">Gal</a>')
	else{
		radec = Galactic2Equatorial(coords.l,coords.b);
		var label = ''+radec.ra_h+'h'+radec.ra_m+'m'+radec.ra_s+'s, '+radec.dec_d+'&deg;'+radec.dec_m+'&prime;'+radec.dec_s+'&Prime; <a href="'+this.phrasebook.eq+'" title="'+this.phrasebook.eqcoord+'" style="text-decoration:none;">J2000</a>';
		//$(this.container+" .chromo_coords").html(''+radec[0].toFixed(2)+'&deg;, '+radec[1].toFixed(2)+'&deg; <a href="'+this.phrasebook.eq+'" title="'+this.phrasebook.eqcoord+'" style="text-decoration:none;">J2000</a>')
	}
	if(this.showcoord){ $(this.container+" .chromo_coords").html(label); }
	// Call an attached event
	if(this.coordlabel != label && typeof this.events.wcsupdate=="function") this.events.wcsupdate.call(this,{position:coords,zoom:this.zoom});
	// Store the current value of the coordinate label
	this.coordlabel = label;
	//if(this.pushstate) history.pushState({l:this.l,b:this.b,z:this.zoom,w:this.lambda,spec:this.spectrum},"Chromoscope ("+this.l+","+this.b+")",this.getViewURL());
}

// Centre the map
Chromoscope.prototype.centreMap = function(){
	this.mapSize = Math.pow(2, this.zoom)*this.tileSize;
	$(this.container+" .chromo_innerDiv").css({top:(this.tall - this.mapSize)/2,left:(this.wide - this.mapSize)/2});
	this.checkTiles();
}

// Centre a <div>, or other element, by name 
// within the current container
// Usage: this.centreDiv(".chromo_help")
Chromoscope.prototype.centreDiv = function(el){
	$(this.container+' '+el).css({left:(this.wide-$(this.container+' '+el).outerWidth())/2,top:(this.tall-$(this.container+' '+el).outerHeight())/2});
}

// Check which tiles should be visible in the innerDiv
Chromoscope.prototype.checkTiles = function(changeForced){

	var visibleRange = this.getVisibleRange();
	var changeW = (this.minlambda != this.previousMinLambda || this.maxlambda != this.previousMaxLambda) ? true : false;
	var changeXY = (visibleRange.xstart != this.previousRange.xstart || visibleRange.ystart != this.previousRange.ystart) ? true : false;
	var changeZ = (this.zoom == this.previousZoom) ? false : true;
	
	// Has the range changed?
	if(changeXY || changeW || changeZ || changeForced){

		// If the zoom level has changed, we should 
		// remove all tiles instantly
		if(changeZ) $(this.container+' .tile').remove();
		

		if(this.performance) var stime = new Date();

		// add each tile to the inner div, checking first to see
		// if it has already been added
		var visibleTiles = (changeW && this.previousTiles.length > 0 && this.zoom == this.previousZoom && !changeForced) ? this.previousTiles : this.getVisibleTiles(visibleRange);

		// Create an array of indices to layers that we will load
		layers = new Array();

		// Set an array index
		l = 0;

		// We want to load the nearest wavelength first
		// followed by the next nearest and then any that
		// are left but not currently visible.
		layers[l++] = Math.round(this.lambda);

		// Step out from the nominal wavelength to pre-load
		// other wavelengths as set by chromo_active.wavelength_load_range
		if(this.wavelength_load_range > 0){
			for(w = 1; w <= this.wavelength_load_range ; w++){
				// Check if the lower wavelength is required
				if(layers[0]-w >= this.minlambda) layers[l++] = layers[0]-w;
				// Check if the higher wavelength is required
				if(layers[0]+w <= this.maxlambda) layers[l++] = layers[0]+w;
			}
		}
		// Now add the annotation layers
		for(var a=0 ; a < this.annotations.length ; a++){
			if( getOpacity($(this.container+" ."+this.annotations[a].name)) > 0) layers[l++] = -(a+1);
		}

		this.visibleTilesMap = new Array(visibleTiles.length*layers.length);

		var counter = 0;

		// Work out the x,y pixel values for the user-defined range
		var pixels = Math.pow(2, this.zoom)

		// Loop over all the layers we've pre-selected
		for(var l = 0 ; l < layers.length ; l++){
			output = "";
			idx = layers[l];

			if(idx >= 0){
				if(this.spectrum[idx].limitrange){
					// Work out the x,y range from the user-specified longitude,latitude range
					var coord1 = Galactic2XY(this.spectrum[idx].range.longitude[0],this.spectrum[idx].range.latitude[0],pixels);
					var coord2 = Galactic2XY(this.spectrum[idx].range.longitude[1],this.spectrum[idx].range.latitude[1],pixels);
					this.spectrum[idx].range.x = [coord1[0],coord2[0]];
					this.spectrum[idx].range.y = [coord1[1],coord2[1]];
					if(this.spectrum[idx].range.longitude[1] == 180) this.spectrum[idx].range.x[1] -= pixels;
				}
			}

			// Loop over all the tiles that we want to load
			for (v = 0; v < visibleTiles.length; v++, counter++) {
				if(idx >= 0) tileName = this.id+"_"+this.spectrum[idx].name+"x" + visibleTiles[v].x + "y" + visibleTiles[v].y + "z"+this.zoom;
				else tileName = this.id+"_"+this.annotations[-(idx+1)].name+"x" + visibleTiles[v].x + "y" + visibleTiles[v].y + "z"+this.zoom;

				this.visibleTilesMap[counter] = tileName;

				// Check if this tile was previously loaded
				match = false;
				for (p = 0; p < this.previousTilesMap.length; p++) {
					if(this.previousTilesMap[p] == tileName){ match = true; break; }
				}
				// Did not exist before so needs to be added
				if(!match){
					if ($("#"+tileName).length == 0) {
						inrange = true;
						if(idx >= 0){
							if(this.spectrum[idx].limitrange){
								// Check if the x,y coordinates for this tile are within the user-defined range
								if(((visibleTiles[v].x+pixels)%pixels)+1 <= (this.spectrum[idx].range.x[1]) || ((visibleTiles[v].x+pixels)%pixels) >= this.spectrum[idx].range.x[0] || visibleTiles[v].y >= this.spectrum[idx].range.y[0] || visibleTiles[v].y <= this.spectrum[idx].range.y[1]-1) inrange = false;
							}
							var tiles = this.spectrum[idx].tiles;
							tiles = (typeof tiles=="string") ? tiles : (typeof tiles["z"+this.zoom]=="string") ? tiles["z"+this.zoom] : tiles.z;
							var img = (inrange) ? this.cdn+tiles+visibleTiles[v].src+'.'+this.spectrum[idx].ext : this.spectrum[idx].blank;
							extrastyle = (jQuery.browser.msie) ? 'filter:alpha(opacity='+(this.spectrum[idx].opacity/100)+')' : '';
							output += '<img src="'+img+'" id="'+tileName+'" class="tile" style="position:absolute;left:'+(visibleTiles[v].x * this.tileSize)+'px; top:'+(visibleTiles[v].y * this.tileSize) +'px; '+extrastyle+'" />\n';
						} else {
							if(this.annotations[-(idx+1)].limitrange){
								// Check if the x,y coordinates for this tile are within the user-defined range
								if(((visibleTiles[v].x+pixels)%pixels)+1 <= (this.annotations[-(idx+1)].range.x[1]) || ((visibleTiles[v].x+pixels)%pixels) >= this.annotations[-(idx+1)].range.x[0] || visibleTiles[v].y >= this.annotations[-(idx+1)].range.y[0] || visibleTiles[v].y <= this.annotations[-(idx+1)].range.y[1]-1) inrange = false;
							}
							var tiles = this.annotations[-(idx+1)].tiles;
							tiles = (typeof tiles=="string") ? tiles : (typeof tiles["z"+this.zoom]=="string") ? tiles["z"+this.zoom] : tiles.z;
							var img = (inrange) ? this.cdn+tiles+visibleTiles[v].src+'.'+this.annotations[-(idx+1)].ext : this.spectrum[idx].blank;
							extrastyle = (jQuery.browser.msie) ? 'filter:alpha(opacity='+(this.annotations[-(idx+1)].opacity/100)+')' : '';
							output += '<img src="'+img+'" id="'+tileName+'" class="tile" style="position:absolute;left:'+(visibleTiles[v].x * this.tileSize)+'px; top:'+(visibleTiles[v].y * this.tileSize) +'px; '+extrastyle+'" />\n';
						}
					}
				}
			}
			// Write the layer
			if(idx >= 0) $(this.container+" ."+this.spectrum[idx].name).append(output);
			else $(this.container+" ."+this.annotations[-(idx+1)].name).append(output);
		}
		// Set all the tiles sizes
		$(this.container+' .tile').css({width:this.tileSize,height:this.tileSize});
		
		if(!changeZ || changeForced){
			for (p = 0; p < this.previousTilesMap.length; p++) {
				match = false;
				for (v = 0; v < this.visibleTilesMap.length; v++) {
					if(this.previousTilesMap[p] == this.visibleTilesMap[v]){
						match = true;
						v = this.visibleTilesMap.length;
						// If it exists we can skip the rest of this for loop
						break;
					}
				}
				// No longer exists so can be removed
				if(!match) $(this.container+" ."+this.previousTilesMap[p]).remove();
			}
		}

		this.previousTiles = visibleTiles;
		this.previousTilesMap = this.visibleTilesMap;
		this.previousRange = visibleRange;
		this.previousZoom = this.zoom;
		this.previousMinLambda = this.minlambda;
		this.previousMaxLambda = this.maxlambda;

		// Fix for IE as it seems to set any tiles off-screen to 0 opacity by itself
		if(jQuery.browser.msie) this.changeWavelength(0);

		// Do we want to preload images off the edges?
		if(this.performance){
			// Check how long this took to do
			var etime = new Date();
			this.times[this.tidx] = (etime-stime)
			this.tidx = (this.tidx == this.times.length-1) ? 0 : this.tidx+1;
			// Average previously stored times to reduce noise
			$(this.container+" .chromo_info").html('checkTiles took '+parseInt((etime-stime))+'ms (avg='+parseInt(this.times.avg())+')').show()
		}

	}
	// If we've loaded any KML we need to position the pins and 
	// balloons here. It wouldn't be necessary but because their 
	// content might take a little while to load, we can't trust
	// their initial positions.
	if((changeXY && this.pins.length > 0 && !changeZ) || changeForced) this.wrapPins();
}

// Used by checkTiles(), this calculates the visible x,y range.
Chromoscope.prototype.getVisibleRange = function(coordtype){

	if(coordtype){
		// Work out the X,Y coordinates
		var l = -$(this.container+" .chromo_innerDiv").position().left;
		var r = l+this.wide;
		var t = -$(this.container+" .chromo_innerDiv").position().top;
		var b = t+this.tall;
		if(coordtype == "G"){
			// Convert to normalized Galactic coordinates
			l = 180-(360*(l/this.mapSize))%360;
			r = 180-(360*(r/this.mapSize))%360;
			t = 180-(360*(t/this.mapSize))%360;
			b = 180-(360*(b/this.mapSize))%360;
		}
		return { left: l, right: r, top: t, bottom: b }
	}else{
		var startX = Math.abs(Math.floor($(this.container+" .chromo_innerDiv").position().left / this.tileSize)) - this.spatial_preload;
		//startX = (startX < 0) ? 0 : startX;
		var startY = Math.abs(Math.floor($(this.container+" .chromo_innerDiv").position().top / this.tileSize)) - this.spatial_preload;
		startY = (startY < 0) ? 0 : startY;
		var spatialpre2 = (2*this.spatial_preload);
		var tilesX = Math.ceil($(this.container+" .chromo_outerDiv").width() / this.tileSize) + spatialpre2;
		var tilesY = Math.ceil($(this.container+" .chromo_outerDiv").height() / this.tileSize) + spatialpre2;
		var visibleIndices = {	xstart:startX,
					xend:(tilesX + startX),
					ystart:startY,
					yend:(tilesY + startY)};
		return visibleIndices;
	}
}

// Get an array of tiles which are visible within the provided range
// Usage: getVisibleTiles(visibleRange)
Chromoscope.prototype.getVisibleTiles = function(range){

	var xr = (range.xend-range.xstart);
	var yr = (range.yend-range.ystart);
	var xyr = xr*yr;
	var visibleTileArray = new Array(xyr);
	var counter = 0;
	var tmpTile;
	for (x = range.xstart; x < range.xend; x++) {
		for (y = range.ystart; y < range.yend; y++) {
			tmpTile = this.getTileURL(x,y,0);
			visibleTileArray[counter++] = {x:tmpTile.x,y:tmpTile.y,src:tmpTile.src};
		}
	}
	return visibleTileArray;
}

// Get an array of pin objects which are visible within the provided range
// Usage: getVisiblePins()
Chromoscope.prototype.getVisiblePins = function(){
	var visiblePins = Array(0)
	var r = this.getVisibleRange('X');
	for (var i in this.pins) {

		var x = this.pins[i].x;
		var y = this.pins[i].y;

		if ((x > r.left) && (x < r.right) && (y > r.top) && (y < r.bottom)) visiblePins.push(this.pins[i]);
	}
	return visiblePins;
}

// Get the URL for the particular tile at x,y
Chromoscope.prototype.getTileURLGsky = function(x,y,s) {
	var pixels = Math.pow(2, this.zoom);
	return {x:x%pixels,y:(y)%(pixels),src:x+'_'+y+'_'+this.zoom,s:s};
}

// Get the URL for the particular tile at x,y
Chromoscope.prototype.getTileURL = function(x,y,s) {
	var pixels = Math.pow(2, this.zoom);
	var d=(x+pixels)%(pixels);
	var e=(y+pixels)%(pixels);
	var f="t";
	for(var g=0 ; g < this.zoom ; g++){
		pixels=pixels/2;
		if(e<pixels){
			if(d<pixels){f+="q"}
			else{f+="r";d-=pixels}
		}else{
			if(d<pixels){f+="t";e-=pixels}
			else{f+="s";d-=pixels;e-=pixels}
		}
	}
	return {x:x,y:y,src:f,s:s}
}

// Set the currently visible wavelength by pseudo-wavelength
// Usage: setWavelength(l)
//	l (number) = The internal pseudo-wavelength. First layer has l=0, second layer has l=1 etc
Chromoscope.prototype.setWavelength = function(l){

	// Round it to 2 decimal places
	this.lambda = Math.round(l*100)/100;
	if(this.lambda < 0) this.lambda = 0;
	if(this.lambda > this.spectrum.length-1) this.lambda = this.spectrum.length-1;

	if(this.wavelength_load_range > 0){
		var wr = Math.floor(this.wavelength_load_range);
		this.minlambda = (Math.floor(this.lambda-wr) > 0) ? Math.floor(this.lambda-wr) : 0;
		this.maxlambda = (Math.ceil(this.lambda+wr) > this.spectrum.length-1) ? this.spectrum.length-1 : Math.ceil(this.lambda+wr);
	}else{
		this.minlambda = this.lambda;
		this.maxlambda = this.lambda;
	}
	this.updateCredit();
	this.positionSlider();
	if(typeof this.events.slide=="function") this.events.slide.call(this,{lambda:this.lambda});
}

Chromoscope.prototype.updateCredit = function(){
	var l = Math.floor(this.lambda);
	var h = Math.ceil(this.lambda);
	var z = this.zoom
	var c1 = this.spectrum[l].attribution;
	c1 = (typeof c1=="string") ? c1 : (typeof c1["z"+z]=="string") ? c1["z"+z] : c1.z;

	if(h == l) $(this.container+" .chromo_attribution").html(c1);
	else{
		var c2 = this.spectrum[h].attribution;
		c2 = (typeof c2=="string") ? c2 : (typeof c2["z"+z]=="string") ? c2["z"+z] : c2.z;
		$(this.container+" .chromo_attribution").html(''+c1+' &amp; '+c2+'');
	}
}

// Position the slider control on the slider bar
// Usage: positionSlider()
Chromoscope.prototype.positionSlider = function(low,high){
	// For slider
	if(this.sliderbar){
		var low = Math.floor(this.lambda);
		var high = Math.ceil(this.lambda);
		var y = 0;
		if(low == high) y = $(this.container+" .legend-"+this.spectrum[low].key).position().top;
		else {
			ylow = $(this.container+" .legend-"+this.spectrum[low].key).position().top;
			yhigh = $(this.container+" .legend-"+this.spectrum[high].key).position().top;
			y = ylow + (yhigh-ylow)*(this.lambda-low);
		}
		$(this.container+" .chromo_slider").css('margin-top',y);
	}	
}

// Change the visible wavelength by a pseudo-wavelength amount.
// The gap between wavelengths is 1.0.
// Usage: changeWavelength(0.1)
Chromoscope.prototype.changeWavelength = function(byWavelength){

	this.setWavelength(this.lambda + byWavelength);
	var low = Math.floor(this.lambda);
	var high = Math.ceil(this.lambda);
	var output = '';

	for(var idx=0 ; idx < this.spectrum.length ; idx++){
			if(idx < low || idx > high){
				this.spectrum[idx].opacity = 0;
				setOpacity($(this.container+" ."+this.spectrum[idx].name),0);
			}
			if(idx == low || idx == high){
				newOpacity = (idx == low) ? (1-(this.lambda-low)).toFixed(2) : (1+(this.lambda-high)).toFixed(2);
				newOpacity = Math.min(this.maxOpacity,Math.max(this.minOpacity, newOpacity));
				this.spectrum[idx].opacity = newOpacity;
				setOpacity($(this.container+" ."+this.spectrum[idx].name),newOpacity);
			}
	}
}

// Change the visible wavelength by the keyboard shortcut character
Chromoscope.prototype.changeWavelengthByName = function(character){
	if(!character) return;
	var matched = 0;
	var backup = 0;
	for(var i=0 ; i < this.spectrum.length ; i++){
		backup = (this.spectrum[i].useasdefault) ? i : backup;
		if(character == this.spectrum[i].key){
			this.setWavelength(i);
			this.spectrum[i].opacity = this.maxOpacity;
			setOpacity($(this.container+" ."+this.spectrum[i].name),this.spectrum[i].opacity);
			matched = 1;
		}else{
			this.spectrum[i].opacity = 0;
			setOpacity($(this.container+" ."+this.spectrum[i].name),0);
		}
	}
	if(!matched){
		this.setWavelength(backup);
		this.spectrum[backup].opacity = this.maxOpacity;
		setOpacity($(this.container+" ."+this.spectrum[backup].name),this.spectrum[backup].opacity);
	}
}

// Show/hide the annotation layer by keyboard shortcut character
// Usage: toggleAnnotationsByName('l')
Chromoscope.prototype.toggleAnnotationsByName = function(character){
	if(!character) return;
	for(var i=0 ; i < this.annotations.length ; i++){
		if(character == this.annotations[i].key){
			if(getOpacity($(this.container+" ."+this.annotations[i].name)) == this.annotations[i].opacity) setOpacity($(this.container+" ."+this.annotations[i].name),0);
			else setOpacity($(this.container+" ."+this.annotations[i].name),this.annotations[i].opacity);
		}
	}
}

// Return the minimum zoom level
Chromoscope.prototype.minZoom = function() {
	var n = Math.ceil(this.wide/this.tileSize);
	var n_h = Math.ceil(this.tall*2/this.tileSize);
	var minZoom = 0;
	var i = 1;
	while(i <= n || i <= n_h){
		minZoom++;
		i*=2;
	};
	return minZoom;
}

// Set the zoom level
// Usage: setMagnification(z)
//	z (number) = The zoom level
Chromoscope.prototype.setMagnification = function(z) {
	this.zoom = Math.round(z*100)/100
	var minZ = this.minZoom();
	if(this.zoom < minZ){ 
		this.zoom = minZ;
		if(z >= 0) this.message(this.phrasebook.nozoomout,1000);
	}
	if(this.zoom > this.maxZoom){
		this.zoom = this.maxZoom;
		if(z >= 0) this.message(this.phrasebook.nozoomin,1000);
	}
	var oldmapSize = this.mapSize;
	this.mapSize = Math.pow(2, this.zoom)*this.tileSize;
	this.zoomPins(oldmapSize,this.mapSize);
	this.updateCredit();
	if(typeof this.events.zoom=="function") this.events.zoom.call(this,{zoom:this.zoom});
}

// Alter the magnification
// Usage: changeMagnification(byZoom,[x],[y])
//	byZoom (integer) = The relative change in zoom level
//	x (number) = The x position to zoom in/out around (optional)
//	y (number) = The y position to zoom in/out around (optional)
Chromoscope.prototype.changeMagnification = function(byZoom,x,y){
	if(this.container){
		// The x,y need to be corrected with the container offset.
		// Offset() is preferable to position() to deal with CSS
		// nesting issues.
		x -= Math.round($(this.container).offset().left);
		y -= Math.round($(this.container).offset().top);
	}
	originalzoom = this.zoom;
	
	this.setMagnification(this.zoom + byZoom);
	if(this.zoom == originalzoom) return;

	// Store the position of the map relative to the map holder
	this.y = $(this.container+" .chromo_innerDiv").position().top;
	this.x = $(this.container+" .chromo_innerDiv").position().left;

	// Get the position
	pos = this.getNewPosition(this.x,this.y,byZoom);
	if(byZoom > 0){
		xoff = (x) ? (this.wide/2 - x) : 0;
		yoff = (y) ? (this.tall/2 - y) : 0;
	}else{
		xoff = (x) ? -(this.wide/2 - x)*0.5 : 0;
		yoff = (y) ? -(this.tall/2 - y)*0.5 : 0;
	}

	var newpos = this.limitBounds(pos.left + xoff,pos.top + yoff);
	$(this.container+" .chromo_innerDiv").css(newpos);

	this.checkTiles();
}


Chromoscope.prototype.zoomOut = function(){ this.changeMagnification(-1); }
Chromoscope.prototype.zoomIn = function(){ this.changeMagnification(1); }


Chromoscope.prototype.getNewPosition = function(templeft,temptop,z){
	byZoom = Math.pow(2, z);
	var newtop = temptop;
	var newleft = templeft;
	var w = this.wide/2;
	var h = this.tall/2;
	if(z > 0){
		if(temptop.length > 1){
			for(var i = 0 ; i < templeft.length ; i++){
				newtop[i] = (temptop[i]*byZoom) - h;
				newleft[i] = (templeft[i]*byZoom) - w;
			}
		}else{
			newtop = (temptop*byZoom) - h;
			newleft = (templeft*byZoom) - w;
		}
	}else if(z < 0){
		if(temptop.length > 1){
			for(var i = 0 ; i < templeft.length ; i++){
				newtop[i] = (temptop[i]-h)*byZoom + h;
				newleft[i] = (templeft[i]-w)*byZoom + w;
			}
		}else{
			newtop = (temptop-h)*byZoom + h;
			newleft = (templeft-w)*byZoom + w;
		}
	}
	return { left: newleft, top: newtop }
}

// Get the Galactic coordinates for the current map centre
Chromoscope.prototype.getCoords = function(offx,offy){
	if(!offx) var offx = $(this.container+" .chromo_outerDiv").width()*0.5;
	if(!offy) var offy = $(this.container+" .chromo_outerDiv").height()*0.5;
	var scale = 360/this.mapSize;
	var p = $(this.container+" .chromo_innerDiv").position();
	var l = (offx-p.left)*scale;
	var b = (p.top+this.mapSize*0.5-offy)*scale;
	l = l % 360;
	l = 180-l;
	return {l:l, b:b}
}

// Create a web link to this view
Chromoscope.prototype.createLink = function(){
	var url = this.getViewURL();
	var safeurl = url.replace('&','%26');
	$(this.container+" .chromo_message").css({"text-align":"center"})
	$(this.container+" .chromo_message").css({width:400});
	var icons = '<a href="http://twitter.com/home/?status=Spotted+this+with+@chromoscope+'+safeurl+'"><img src="twitter.gif" title="Tweet this" /></a><a href="http://www.facebook.com/sharer.php?u='+safeurl+'"><img src="facebook.gif" title="Share with Facebook" /></a><a href="http://www.blogger.com/blog-this.g?t=&amp;n=Chromoscope&amp;u='+safeurl+'"><img src="blogger.gif" title="Add to Blogger" /></a><a href="http://del.icio.us/post?url='+safeurl+'"><img src="delicious.gif" title="Tag with del.icio.us" /></a><a href="http://slashdot.org/bookmark.pl?title=Chromoscope&amp;url='+safeurl+'"><img src="slashdot.gif" title="Slashdot this" /></a><a href="http://digg.com/submit?phase=2&url='+safeurl+'"><img src="digg.gif" title="Digg this" /></a><a href="http://www.mixx.com/submit?page_url='+safeurl+'"><img src="mixx.png" title="Add to Mixx" /></a>';
	var share = (this.phrasebook.sharewith.indexOf("__ICONS__") > 0) ? this.phrasebook.sharewith.replace("__ICONS__",icons) : this.phrasebook.sharewith+icons;
	this.message(this.createClose()+this.phrasebook.url+'<input type="text" class="chromo_createdLink" value="'+url+'" style="width:100%;" /><br /><p class="social">'+share+' </p>')
	$(this.container+" .chromo_message .chromo_close").bind('click',{id:'.chromo_message'}, jQuery.proxy( this, "toggleByID" ) );
	$(this.container+" .chromo_createdLink").focus(function(){
		$(this).select();
	})
}

Chromoscope.prototype.getViewURL = function(){
//	var coords = this.getCoords();
	var w = "";
	for(i = 0; i < this.spectrum.length; i++){
		w += this.spectrum[i].key; 
		w += (i == this.spectrum.length-1) ? '' : ',';
	}
	var url = window.location.protocol + "//" + window.location.host + "" + window.location.pathname+'?l='+this.l.toFixed(4)+'&b='+this.b.toFixed(4)+'&w='+this.lambda.toFixed(2)+'&o='+w+'&z='+this.zoom;
	if(typeof this.q.kml=="string") url += '&kml='+this.q.kml;
	return url;
}

// Return the HTML for a close button
Chromoscope.prototype.createClose = function(type){
	var w = 28;
	// In the case of the Wii or a small touch screen we should make the close control larger
	if(navigator.platform == "Nintendo Wii" || ('ontouchstart' in document.documentElement && (this.wide <= 800 || this.tall <= 600))) w *= 2;
	return '<span class="chromo_close"><img src="'+this.dir+'close.png" style="width:'+w+'px;" title="'+this.phrasebook.closedesc+'" /></span>';
}

// Return the HTML for a close button
Chromoscope.prototype.createCloseOld = function(){
	var s = this.phrasebook.close.replace('C','<span style="text-decoration:underline;">C</span>')
	return '<div class="chromo_close" title="'+this.phrasebook.closedesc+'">'+s+'</div>';
}
// Make a message
Chromoscope.prototype.message = function(html,delay){
	if(delay) $(this.container+" .chromo_message").html(html).show().delay((typeof delay=="number") ? delay : 2000).fadeOut(500);
	else $(this.container+" .chromo_message").html(html).show();
	this.centreDiv(".chromo_message");
}
// Bind events
Chromoscope.prototype.bind = function(ev,fn){
	if(typeof ev!="string" || typeof fn!="function") return this;
	if(ev == "move") this.events.move = fn;
	else if(ev == "zoom") this.events.zoom = fn;
	else if(ev == "slide") this.events.slide = fn;
	else if(ev == "wcsupdate") this.events.wcsupdate = fn;
	else if(ev == "kml") this.events.kml = fn;
	else if(ev == "json") this.events.json = fn;
	else if(ev == "pinopen") this.events.pinopen = fn;
	else if(ev == "pinclose") this.events.pinclose = fn;
	return this;
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
			var callback = null;
			var duration = 0;
			var overwrite = true;
			for (var i = 1; i < Chromoscope.prototype.readKML.arguments.length; i++){
				var arg = Chromoscope.prototype.readKML.arguments[i];
				callback = (typeof arg=="function") ? arg : callback;
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
					var total = _obj.processJSON(data,overwrite);
					if(typeof _obj.events.json=="function") _obj.events.json.call(_obj,{total:total,name:data.name});
					if(callback) callback.call();
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
						_obj.message('Processing '+docname);
						if(!_obj.container) $('title').text(docname+' | Chromoscope');
						var total = _obj.processKML(xml,overwrite);
						if(typeof _obj.events.kml=="function") _obj.events.kml.call(_obj,{total:total,name:$('Document',xml).children('name').text()});
						if(callback) callback.call();
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
Chromoscope.prototype.processKML = function(xml,overwrite){
	var overwrite = overwrite ? true : false;
	if(overwrite){ this.pins = new Array(); }
	this.makePinHolder();

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
		// We currently use the <href> and <hotSpot> variables as defined in:
		// http://code.google.com/apis/kml/documentation/kmlreference.html#icon
		styles[j.attr('id')] = {id: j.attr('id'),img:new Image(),balloonstyle:j.find('BalloonStyle'),x:j.find('hotSpot').attr('x'),y:j.find('hotSpot').attr('y')};
		// Preload the images. First set the onload then attach the src.
		// We'll update the pins again once all the style images have loaded
		styles[j.attr('id')].img.onload = function(){ 
			if(++_obj.pinstyleload == _obj.pinstylecount){
				_obj.updatePins(""); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		};
		styles[j.attr('id')].img.onerror = function(){
			if(++_obj.pinstyleload == _obj.pinstylecount){
				_obj.updatePins("",false,true); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		}
		styles[j.attr('id')].img.src = j.find('href').text();
		if(styles[j.attr('id')].img.src) _obj.pinstylecount++;
	});
	//console.log("Time to process styles: " + (new Date() - this.start) + "ms");
	$('Placemark',xml).each(function(i){
		// Get the custom icon
		var img = "";
		var balloonstyle = "";
		var x, y, xunits, yunits, w, h = "";
		var style = $(this).find("styleUrl").text();
		style = style.substring(1);
		var id_text = "";
		if(typeof styles[style]=="object"){
			img = styles[style].img;
			balloonstyle = styles[style].balloonstyle.find('text').text()
			x = (typeof styles[style].x=="undefined") ? "" : parseFloat(styles[style].x);
			y = (typeof styles[style].y=="undefined") ? "" : parseFloat(styles[style].y);
			xu = styles[style].xunits;
			yu = styles[style].yunits;
			w = (styles[style].img.width) ? styles[style].img.width : "";
			h = (styles[style].img.height) ? styles[style].img.height : "";
		}
		c.addPin({id:p++,style:style,img:img,title:$(this).find("name").text(),x:x,y:y,xunits:xu,yunits:yu,w:w,h:h,balloonstyle:balloonstyle,desc:($(this).find("description").text()),ra:parseFloat($(this).find("longitude").text())+180,dec:parseFloat($(this).find("latitude").text())},true);
		added++;
	});
	this.updatePins("",true);
	this.wrapPins();
	//console.log("Time to end of processKML: " + (new Date() - this.start) + "ms");
	return added;
}

// Parse a loaded JSON file
// Usage: processJSON(json,[overwrite])
//	json = The JSON object as loaded by readKML()
//	overwrite (boolean) = Do we overwrite any previously loaded Placemarkers?
Chromoscope.prototype.processJSON = function(json,overwrite){
	var overwrite = overwrite ? true : false;
	if(overwrite){ this.pins = new Array(); }
	this.makePinHolder();

	var p = this.pins.length;
	var c = this;	// Keep a copy of this instance for inside the Placemark loop
	var i = 0;

	// Set the opacity of all the pins (mostly for IE)
	setOpacity($(this.container+" .kml"),1.0);

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
				_obj.updatePins(""); 
				if(_obj.showintro) _obj.buildIntro();
				else $(_obj.container+" .chromo_message").hide();
			}
		};
		styles[j.id].img.onerror = function(){
			if(++_obj.pinstyleload == _obj.pinstylecount){
				_obj.updatePins("",false,true); 
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
		c.addPin({id:p++,style:style,img:img,title:json.placemarks[i].name,x:x,y:y,xunits:xu,yunits:yu,w:w,h:h,balloonstyle:balloonstyle,desc:json.placemarks[i].description,ra:json.placemarks[i].ra+180,dec:json.placemarks[i].dec},true);
		added++;
	}
	this.updatePins("",true);
	this.wrapPins();
	//console.log("Time to end of processKML: " + (new Date() - this.start) + "ms");
	return added;
}

// Create a layer to hold pins
Chromoscope.prototype.makePinHolder = function(loc) {
	loc = (typeof loc=="string") ? loc : 'kml';
	body = (this.container) ? this.container : 'body';
	if($(body+" ."+loc).length == 0){
		$(body+" .chromo_innerDiv").append('<span class="map '+loc+'" id="'+body+'-holder-'+loc+'"></span>');
		holder = $(body+" ."+loc);
		holder.css("z-index",this.spectrum.length+this.annotations.length+1);
		holder.css({left:0,top:0,width:this.mapSize*2,height:this.mapSize,position:'absolute'});
	}
	return loc;
}

// Add to the pin array
Chromoscope.prototype.addPin = function(input,delayhtml){
	if(typeof delayhtml=="undefined") delayhtml = false;
	this.pins[this.pins.length] = new Pin(input,this,delayhtml);
}

Chromoscope.prototype.removePin = function(id){
	var body = (this.container) ? this.container : 'body';
	$(body+' .balloon-'+id).remove();
	$(body+' .pin-'+id).remove();
	
	for(var p = 0 ; p < this.pins.length; p++){
		if(this.pins[p].id == id) this.pins.pop();
	}
}

// Define a pin
// Usage: chromo_active.pins[p] = new Pin({id:1,img:'something.png',title:'Title',desc:'A description',glon:120.0,glat:5.2},chromo_active,delayhtml)
//	id = The unique ID which will refer to this pin
//	img (string) = The location of an image file to use as a pin. Can be remote.
//	x (number) = The x position of the pin
//	y (number) = The y position of the pin
//	xunits (string) = pixels/fraction
//	yunits (string) = pixels/fraction
//	w (number) = The width of the pin
//	h (number) = The height of the pin
//	title (string) = The title in the popup balloon (it will be an <h3>).
//	desc (string) = The description shown in the popup balloon. Can contain HTML.
//	ra (number) = The Right Ascension of the pin (optional: instead of glon)
//	dec (number) = The declination of the pin (optional: instead of glat)
//	glon (number) = The Galactic longitude of the pin
//	glat (number) = The Galactic latitude of the pin
//	chromo_active = The element that this will attach to
//	delayhtml = True if you want to add a lot of pins one-after-the-other. You'll need to call updatePins("",true)
function Pin(input,el,delayhtml){
	if(input){
		this.el = el;
		this.id = (input.id) ? input.id : el.pins.length;
		this.loc = (input.loc) ? el.container+input.loc : el.container+" .kml";
		var kml_coord;
		if(input.ra && input.dec){
			this.ra = (input.ra) ? input.ra : 0.0;
			this.dec = (input.dec) ? input.dec : 0.0;
			kml_coord = Equatorial2Galactic(this.ra, this.dec);
			this.glon = kml_coord[0];
			this.glat = kml_coord[1];
		}else{
			this.glon = (input.glon) ? input.glon : 0.0;
			this.glat = (input.glat) ? input.glat : 0.0;
		}
		kml_coord = Galactic2XY(this.glon,this.glat,el.mapSize);
		this.input= input;
		this.style = input.style;
		this.info = { id:'',style:'', html:'', visible:false, width:((typeof input.width=="number") ? input.width : 0) };
		this.info.style = (input.balloonstyle) ? input.balloonstyle : "";

		if(typeof input.img=="object") this.img = input.img;
		else{
			this.img = new Image();
			this.img.src = (typeof input.img=="string" && input.img.length > 0) ? input.img : 'pin.png';
		}

		this.pin_h = (typeof input.h=="number") ? input.h : (this.img.height) ? this.img.height : 30;
		this.pin_w = (typeof input.w=="number") ? input.w : (this.img.width) ? this.img.width : 30;
		// Have we guessed the dimensions?
		this.dimensionguess = (this.pin_h==30 && this.pin_w==30) ? true : false;
		this.pin_x = (typeof input.x=="number") ? input.x : 0.5;
		this.pin_y = (typeof input.y=="number") ? input.y : 1;
		this.xunits = (typeof input.xunits=="string") ? input.xunits : "fraction";
		this.yunits = (typeof input.yunits=="string") ? input.yunits : "fraction";

		this.x = kml_coord[0];
		this.y = kml_coord[1];
		this.title = (input.title) ? input.title : '';
		this.desc = (input.desc) ? input.desc : '';
		this.info.id = "balloon-"+this.id;
		this.pin = "pin-"+this.id;
		this.pinid = el.container+"-"+this.pin;
		this.html = '<div class="pin" title="'+this.title+'" id="'+this.pinid+'" style="position:absolute;display:block;width:'+this.pin_w+';height:'+this.pin_h+'"><img src="'+this.img.src+'" style="width:100%;height:100%;" /></div>';
		this.isplaced = false;
		this.isbound = false;
		var contents = "";

		// Deal with KML balloon styles
		if(this.info.style){
			// We need to replace the $[name] and $[description]
			var text = this.info.style;
			text = text.replace("$[name]",this.title)
			contents = text.replace("$[description]",this.desc)
		}else{
			// There is no user-provided styling so apply a basic style
			contents = (input.msg) ? input.msg : '<h3>'+this.title+'</h3><p>'+this.desc+'</p>';
		}
		// Make the <div> to hold the contents of the balloon
		this.info.html = '<div class="balloon '+this.info.id+'" style="position:absolute;">'+contents+el.createCloseOld()+'</div>';

		if(!this.dimensionguess){
			// Position the pin and add the event to it
			this.xoff = (this.xunits=="pixels") ? this.pin_x : this.pin_w*this.pin_x;
			this.yoff = (this.yunits=="pixels") ? this.pin_y : this.pin_h*this.pin_y;
		}
		if(!delayhtml){
			$(this.loc).append(this.html);
			this.jquery = $("#"+this.pinid);
			this.xoff = (this.xunits=="pixels") ? this.pin_x : this.pin_w*this.pin_x;
			this.yoff = (this.yunits=="pixels") ? this.pin_y : this.pin_h*this.pin_y;
			this.jquery.css({left:(parseInt(this.x - this.xoff)),top:(parseInt(this.y - this.yoff))});
			this.jquery.bind('click',{p:this,el:el},function(e){
				e.data.el.toggleBalloon(e.data.p);
	 		});
	 		this.jquery.show();
			this.isplaced = true;
	 		this.isbound = true;
		}
	}
}

Chromoscope.prototype.updatePins = function(style,delayedhtml,finish){
	max = this.pins.length;
	// Construct the HTML for all the pins in one go as
	// this is quicker than adding them one at a time
	if(delayedhtml){
		var html = "";
		for(var p = 0 ; p < max ; p++) html += this.pins[p].html;
		$(this.pins[0].loc).append(html);
	}
	for(var p = 0 ; p < max ; p++) this.updatePin(p,style,finish);
}

Chromoscope.prototype.updatePin = function(p,style,finish){
	var pin = this.pins[p];
	if(!pin.jquery) pin.jquery = $("#"+pin.pinid);
	if(pin.dimensionguess && (pin.img.width || finish)){
		pin.pin_h = pin.img.height ? pin.img.height : 30;
		pin.pin_w = pin.img.width ? pin.img.width : 30;
		pin.dimensionguess = false;
		pin.xoff = (pin.xunits=="pixels") ? pin.pin_x : pin.pin_w*pin.pin_x;
		pin.yoff = (pin.yunits=="pixels") ? pin.pin_y : pin.pin_h*pin.pin_y;
		pin.jquery.css({left:(parseInt(pin.x - pin.xoff)),top:(parseInt(pin.y - pin.yoff)),width:pin.pin_w,height:pin.pin_h});
		pin.isplaced = true;
	}else{
		if(!pin.isplaced){
			pin.jquery.css({left:(parseInt(pin.x - pin.xoff)),top:(parseInt(pin.y - pin.yoff))});
			pin.isplaced = true;
		}
	}
	if(style && pin.style != style) pin.jquery.hide();
	else pin.jquery.show();
	if(!pin.isbound){
		pin.jquery.bind('click',{p:pin,el:pin.el},function(e){ e.data.el.toggleBalloon(e.data.p); });
		pin.isbound = true;
	}
}

Chromoscope.prototype.toggleBalloon = function(pin){
	if(pin.info.visible){
		$(pin.loc+" ."+pin.info.id).remove();
		pin.info.visible = false;
		if(typeof this.events.pinclose=="function") this.events.pinclose.call(this,{pin:pin});
	}else this.showBalloon(pin);
}

Chromoscope.prototype.showBalloon = function(pin,duration){
	var rad = 10;

	var id = pin.loc+" ."+pin.info.id;
	$(id).remove();
	pin.info.visible = false;
	$(pin.loc).append(pin.info.html);

	if(pin.info.width > 0) $(id).css({'width':pin.info.width});
	var w = $(id).outerWidth();
	var h = $(id).outerHeight();

	// Correction for (e.g. IE < 9) where the width goes crazy
	if(w > this.wide){
		w = (w > 500) ? 330 : w/2;
		$(id).css({'width':w});
	}

	// Remove all previous arrows that exist
	$(id+' .arrowtop').remove();
	$(id+' .arrow').remove();
	
	// Position the balloon relative to the pin
	pin.info.x = -w/2;
	if((pin.y-h-rad) < this.mapSize*0.25){
		pin.info.y = pin.pin_h*0.25;
		$(id).prepend('<div class="arrowtop"></div>');
		$(id+" .arrowtop").css({'left':((parseInt(w/2)-rad))});
	}else{
		pin.info.y = -h-rad;
		$(id).append('<div class="arrow"></div>');
		$(id+" .arrow").css({'left':((parseInt(w/2)-rad))});
	}
	$(id).css({'left':parseInt(pin.x+pin.info.x),'top':(pin.y+pin.info.y)});

	if(duration && duration > 0) $(id).fadeIn(duration);
	else $(id).show();
	pin.info.visible = true;
	
	// Attach event
	$(id+" .chromo_close").bind('click',{id:id,pin:pin},function(e){
		$(e.data.id).remove(); e.data.pin.info.visible = false;
		if(typeof e.data.pin.el.events.pinclose=="function") e.data.pin.el.events.pinclose.call(e.data.pin.el,{pin:e.data.pin});
	});
	$(id).bind('mouseover',{me:this},function(e){
		e.data.me.allowdrag = false;
	}).bind('mouseout',{me:this},function(e){
		e.data.me.allowdrag = true;
	})
	if(typeof this.events.pinopen=="function") this.events.pinopen.call(this,{pin:pin});
}


// Close all open balloons, move to current pin and then show its balloon
Chromoscope.prototype.pressPin = function(i,input){
	if(i >= 0 && i < this.pins.length){
		var z = (input.zoom) ? input.zoom : this.minZoom();
		this.moveMap(this.pins[i].glon,this.pins[i].glat,z)
		this.toggleBalloon(this.pins[i]);
		this.wrapPins();
	}
}

// Go through each pin and reposition it on the map
Chromoscope.prototype.wrapPins = function(i){
	if(this.pins.length == 0) return true;
	max = (typeof i=="number") ? i : this.pins.length;
	i = (typeof i=="number") ? i : 0;
	var x = $(this.container+" .chromo_innerDiv").position().left;
	var y = $(this.container+" .chromo_innerDiv").position().top;

	for(var p = i ; p < max ; p++){
		//var pos = x+this.pins[p].x;
		if(this.pins[p].x < -x-this.tileSize){
			this.pins[p].x += this.mapSize;
		}
		while(this.pins[p].x > -x+this.mapSize-this.tileSize){
			this.pins[p].x -= this.mapSize;
		}
		this.pins[p].jquery.css({left:(parseInt(this.pins[p].x)-this.pins[p].xoff)});
		if(this.pins[p].info.visible) $(this.container+" ."+this.pins[p].info.id).css({'left':((this.pins[p].x)+this.pins[p].info.x),'top':((this.pins[p].y)+this.pins[p].info.y)});
	}
}

// If we zoom the map, we don't have to recalculate everything, 
// just scale the positions by the zoom factor
Chromoscope.prototype.zoomPins = function(oldmapSize,newmapSize){
	if(!chromo_active) return true;
	if(newmapSize != oldmapSize){
		body = (this.container) ? this.container : 'body';
		$(body+" .kml").css({width:newmapSize*2,height:newmapSize});
		scale = newmapSize/oldmapSize;
		for(var p = 0 ; p < this.pins.length ; p++){
			this.pins[p].x *= scale;
			this.pins[p].y *= scale;
			// Update the pin position
			this.pins[p].jquery.css({left:((this.pins[p].x) - this.pins[p].xoff),top:((this.pins[p].y) - this.pins[p].yoff)});
		}
		// If the info balloon is visible, update its position too
		for(var p = 0 ; p < this.pins.length ; p++){
			if(this.pins[p].info.visible) $(this.container+" ."+this.pins[p].info.id).css({'left':((this.pins[p].x)+this.pins[p].info.x),'top':((this.pins[p].y)+this.pins[p].info.y)});
		}
	}
}

// ===================================
// Generic functions that are independent 
// of the chromo container

// A cross browser way to get the opacity of an element
// Usage: getOpacity($("#chromo_message"))
function getOpacity(el){
	if(typeof el=="string") el = $(el);
	if(jQuery.browser.msie) return (el.css("filter").replace(/[^0-9.]*/g,""))/100;
	else return parseFloat(el.css("opacity")).toFixed(3); // Only need 3dp precision - this stops floating point errors in Chrome
}

// A cross browser way to set the opacity of an element
// Usage: setOpacity($("#chromo_message"),0.4)
function setOpacity(el,opacity){
	if(typeof el=="string") el = $(el);
	if(jQuery.browser.msie){
		el.css("filter","alpha(opacity="+Math.floor(opacity*100)+")");
		el.children().css("filter","alpha(opacity="+Math.floor(opacity*100)+")");
	}else el.css("opacity",opacity);
}

// Coordinate based functions
// Convert Ra/Dec (1950 or 2000) to Galactic coordinates
function Equatorial2Galactic(ra, dec, epoch){
	var d2r = Math.PI/180;	// degrees to radians
	var OB = 23.4333334*d2r;
	dec *= d2r;
	ra *= d2r;
	var a = (epoch && epoch == 1950) ? 27.4 : 27.128251;	// The RA of the North Galactic Pole
	var d = (epoch && epoch == 1950) ? 192.25 : 192.859481;	// The declination of the North Galactic Pole
	var l = (epoch && epoch == 1950) ? 33.0 : 32.931918;	// The ascending node of the Galactic plane on the equator
	var sdec = Math.sin(dec);
	var cdec = Math.cos(dec);
	var sa = Math.sin(a*d2r);
	var ca = Math.cos(a*d2r)
	
	var GT = Math.asin(cdec*ca*Math.cos(ra-d*d2r)+sdec*sa);
	var GL = Math.atan((sdec-Math.sin(GT)*sa)/(cdec*Math.sin(ra- d*d2r)*ca))/d2r;
	var TP = sdec-Math.sin(GT)*sa;
	var BT = cdec*Math.sin(ra-d*d2r)*ca;
	if(BT<0) GL=GL+180;
	else {
		if (TP<0) GL=GL+360;
	}
	GL = GL + l;
	if (GL>360) GL = GL - 360;

	LG=Math.floor(GL);
	LM=Math.floor((GL - Math.floor(GL)) * 60);
	LS=((GL -Math.floor(GL)) * 60 - LM) * 60;
	GT=GT/d2r;

	D = Math.abs(GT);
	if (GT > 0) BG=Math.floor(D);
	else BG=(-1)*Math.floor(D);
	BM=Math.floor((D - Math.floor(D)) * 60);
	BS = ((D - Math.floor(D)) * 60 - BM) * 60;
	if (GT<0) {
		BM=-BM;
		BS=-BS;
	}
	return [GL,GT];
}

function Galactic2Equatorial(l, b, epoch){
	var d2r = Math.PI/180;	// degrees to radians
	var r2d = 180/Math.PI;	// degrees to radians
	var NGP_a = (epoch && epoch == 1950) ? 27.4 : 27.13;	// The RA of the North Galactic Pole
	var NGP_d = (epoch && epoch == 1950) ? 192.25 : 192.859481;	// The declination of the North Galactic Pole
	var AN_l = (epoch && epoch == 1950) ? 33.0 : 32.93;	// The ascending node of the Galactic plane on the equator

	l *= d2r;
	b *= d2r;

	LAL_LGAL = AN_l*d2r;
	LAL_ALPHAGAL = NGP_d*d2r;
	LAL_DELTAGAL = NGP_a*d2r;

	sDGal = Math.sin(LAL_DELTAGAL);
	cDGal = Math.cos(LAL_DELTAGAL);
	l = l-LAL_LGAL;

	sB = Math.sin(b);
	cB = Math.cos(b);
	sL = Math.sin(l);
	cL = Math.cos(l);

	/* Compute components. */
	sinD = cB*cDGal*sL + sB*sDGal;
	sinA = cB*cL;
	cosA = sB*cDGal - cB*sL*sDGal;

	/* Compute final results. */
	delta = Math.asin(sinD)*r2d;
	alpha = (Math.atan2( sinA, cosA ))*r2d + NGP_d;

	alpha = alpha%360.0;
	var ra_h = parseInt(alpha/15);
	var ra_m = parseInt((alpha/15-ra_h)*60);
	var ra_s = ((alpha/15-ra_h-ra_m/60)*3600).toFixed(2);
	var ra = (ra_h+ra_m/60+ra_s/3600);
	if(ra_h < 10) ra_h = "0"+ra_h;
	if(ra_m < 10) ra_m = "0"+ra_m;
	if(ra_s < 10) ra_s = "0"+ra_s;
	var dec_sign = (delta >= 0) ? 1 : -1;
	var dec_d = parseInt(Math.abs(delta));
	var dec_m = parseInt((Math.abs(delta)-dec_d)*60);
	var dec_s = ((Math.abs(delta)-dec_d-dec_m/60)*3600).toFixed(1);
	return {ra:ra,ra_h:ra_h,ra_m:ra_m,ra_s:ra_s,dec:delta,dec_d:dec_d*dec_sign,dec_m:dec_m,dec_s:dec_s};
}

// Convert from Galactic longitude/latitude to X,Y coordinates within the full sky
// Usage: var xycoords = Galactic2XY(l,b,mapSize)
function Galactic2XY(l,b,mapSize){
	if(l < 180) l = -(l);
	else l = (360-l);
	var x = (l*mapSize/360  + mapSize/2);
	var y = (mapSize/2 - (b*mapSize/360));
	return [x,y];
}

// Convert from RA/Dec to X,Y coordinates within the full sky
// Usage: var xycoords = Equatorial2XY(ra,dec)
function Equatorial2XY(ra,dec,mapSize){
	var coords = Equatorial2Galactic(ra, dec);
	return Galactic2XY(coords[0],coords[1],mapSize);
}
