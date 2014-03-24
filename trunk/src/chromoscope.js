/*
 * Chromoscope v1.4.4
 * Written by Stuart Lowe for the Planck/Herschel Royal Society
 * Summer Exhibition 2009. Developed as an educational resource.
 *
 * This application will run locally or can be run on a web
 * server. To run locally you'll need to download the appropriate 
 * tile sets and code.
 *
 * Changes in version 1.4.4 (2014-03-22):
 *   - Bug fix for showintro
 *
 * Changes in version 1.4.3 (2013-03-19):
 *   - Allow tile sets for two coordinate systems
 * 
 * Changes in version 1.4.2 (2013-01-11):
 *   - Bug fix for share icons in different directory
 *   - Bug fix for touch devices
 *   - Now uses jQuery 1.7.1
 *
 * Changes in version 1.4.1 (2012-06-13):
 *   - Right-to-left language support
 *   - Added Hebrew, Japanese
 *   - Completed Danish
 *   - Bug fix for kml in share link
 *   - Bug fix for show/hide search link
 *
 * Changes in version 1.4 (2011-10-01):
 *   - Added core search form to search through KML placemarkers
 *   - Turned into a jQuery plugin. Requires a change to the setup line
 *      chromo = $.chromoscope("body",{lang:'en',showintro:true});
 *   - Removed global variable
 *   - Can now display tilesets that are in Equatorial coordinates
 *
 */

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

// Extend jQuery
(function ($) {


	// Declare the Chromoscope object
	function Chromoscope(input){

		this.version = "1.4.3";

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
		this.body = 'body'		// Where this chromoscope gets placed
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
		this.pingroups = new Array();	// Layers to hold pins/balloons
		this.pins = new Array();	// For information pin/balloons
		this.times = new Array(10);	// Processing times for map moving updates
		this.keys = [];			// Keyboard commands
		this.tidx = 0;			// Current index of the times array
		this.clock = 0;			// Holds the time

		this.iswii = (navigator && navigator.platform == "Nintendo Wii") ? true : false;
		this.istouch = ('ontouchstart' in document.documentElement);
		this.isfilter = (typeof document.createElement("div").style.filter != 'undefined');
   

		// Language Settings
		this.lang = (navigator) ? (navigator.userLanguage||navigator.systemLanguage||navigator.language||browser.language) : "";			// Set the user language
		this.langshort = (this.lang.indexOf('-') > 0 ? this.lang.substring(0,this.lang.indexOf('-')) : this.lang.substring(0,2));
		this.langs = new Array();
		// Country codes at http://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
		this.langs[0] = {code:'en',name:'English'};
		this.langs[1] = {code:'af',name:'Afrikaans'};
		this.langs[2] = {code:'cy',name:'Cymraeg'};
		this.langs[3] = {code:'de',name:'Deutsch'};
		this.langs[4] = {code:'dk',name:'Dansk'};
		this.langs[5] = {code:'es',name:'Espa&#241;ol'};
		this.langs[6] = {code:'fr',name:'Fran&#231;ais'};
		this.langs[7] = {code:'ga',name:'Gaeilge'};
		this.langs[8] = {code:'he',name:'&#1506;&#1489;&#1512;&#1497;&#1514;'};
		this.langs[9] = {code:'it',name:'Italiano'};
		this.langs[10] = {code:'ja',name:'&#26085;&#26412;&#35486;'};
		this.langs[11] = {code:'pl',name:'Polski'};
		this.langs[12] = {code:'pt',name:'Portugu&#234s'};
		this.langs[13] = {code:'sv',name:'Svenska'};
		this.langs[14] = {code:'tr',name:'T&#252;rk&#231;e'};
		this.langs[15] = {code:'zh',name:'&#20013;&#25991;'};
		this.phrasebook = new Language({code:'en'});

		// The map div control and properties
		this.sliderbar = true;		// Display the slider bar?
		this.zoomctrl = true;		// Display the zoom control
		this.title = true;		// Display the title?
		this.showintro = true;		// Display the introductory message
		this.showhelp = true;		// Display the help
		this.showshare = true;		// Display the share link
		this.showabout = true;		// Display the about link
		this.showlangs = true;		// Display the languages link
		this.showcoord = true;		// Display the coordinates
		this.showsearch = true;		// Display the search link
		this.showversion = true;	// Display the version number
		this.compact = false;		// Hide parts of the interface if small
		this.loaded = false;		// Set to true once loaded
		this.mapSize = 256;
		this.dragging = false;
		this.mouseevents = true;
		this.draggingSlider = false;
		this.moved = false;
		this.ignorekeys = false;	// Allow/disallow keyboard control
		this.coordinate = { system:'G', active:'G', label:"" };	// The coordinate type to display 'G' for Galactic and 'A' for equatorial
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
		this.search = [];
		this.plugins = [];
		this.active = false;

		this.events = {move:"",zoom:"",slide:"", wcsupdate:""};	// Let's add some default events
		this.init(input);

	}

	// Set variables defined in the query string
	// The default behaviour is to show the intro message. We will over-ride this
	// with the query string option 'showintro'. If 'showintro' isn't set manually
	// in the query string we will only show it if there is no query string; we
	// will assume that having a query string means this is a shared link and in
	// that case the intro message can be confusing to the person following the link.
	Chromoscope.prototype.init = function(inp){
		//console.log("Time to start init:" + (new Date() - this.start) + "ms");
		if(this.q.showintro) this.showintro = (this.q.showintro == "true") ? true : (this.q.showintro == "false") ? false : this.showintro;
		else{
			if(this.q.length > 0) this.showintro = false;
		}
		if(this.q.sliderbar) this.sliderbar = (this.q.sliderbar == "true") ? true : false;
		if(this.q.zoomctrl) this.zoomctrl = (this.q.zoomctrl == "true") ? true : false;
		if(this.q.compact) this.compact = (this.q.compact == "true") ? true : false;
		if(this.q.title) this.title = (this.q.title == "true") ? true : false;
		if(this.q.performance) this.performance = true;

		this.args = inp	// Keep track of any input variables

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
			if(typeof inp.showhelp=="boolean") this.showhelp = inp.showhelp;
			if(typeof inp.showsearch=="boolean") this.showsearch = inp.showsearch;
			if(typeof inp.showshare=="boolean") this.showshare = inp.showshare;
			if(typeof inp.showabout=="boolean") this.showabout = inp.showabout;
			if(typeof inp.showlangs=="boolean") this.showlangs = inp.showlangs;
			if(typeof inp.showcoord=="boolean") this.showcoord = inp.showcoord;
			if(typeof inp.showversion=="boolean") this.showversion = inp.showversion;
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
			if(typeof inp.plugins=="object") this.plugins = inp.plugins;
			if(typeof inp.dir=="string") this.dir = inp.dir;
			if(typeof inp.coordinatesystem=="string") this.coordinate.system = inp.coordinatesystem;
			if(typeof inp.coordinateactive=="string") this.coordinate.active = inp.coordinateactive;
		}
		if(this.container) this.body = this.container;
		if(this.pushstate){
			window.onpopstate = function(event) {
				// Can't use moveMap because it updates the state event chromo.moveMap(event.state.l,event.state.b,event.state.z);
			};
		}
		// Initialize the plugins
		for (var i = 0; i < this.plugins.length; ++i)
			if(typeof this.plugins[i].init=="function") this.plugins[i].init(this);

		//console.log("Time to end init:" + (new Date() - this.start) + "ms");
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
		this.helpdesc = (inp.helpdesc) ? inp.helpdesc : "The Milky Way is shown across the middle. The north pole of the Galaxy is towards the top. Use the mouse to drag the sky around. Want more info? <a href=\"#\" class=\"videolink\">Watch a quick tour</a> (opens in this window). <span class=\"keyboard\">The keyboard controls are:<ul class=\"chromo_controlkeys\"></ul></span><span class=\"nokeyboard\"><ul class=\"chromo_controlbuttons\"></ul></span> <span class=\"keyboard\">Created by <a href=\"http://www.strudel.org.uk/\">Stuart Lowe</a>, <a href=\"http://orbitingfrog.com/blog/\">Rob Simpson</a>, and <a href=\"http://www.astro.cardiff.ac.uk/contactsandpeople/?page=full&id=493\">Chris North</a>. You can also <a href=\"http://blog.chromoscope.net/download/\">download it</a> to run locally.</span>";
		this.about = (inp.about) ? inp.about :'About';
		this.share = (inp.share) ? inp.share :'Share';
		this.sharewith = (inp.sharewith) ? inp.sharewith :'Share it with';
		this.switchtext = (inp.switchtext) ? inp.switchtext : 'switch to __WAVELENGTH__ view';
		this.search = (inp.search) ? inp.search : 'Search';
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
		this.intro = (inp.intro) ? inp.intro : "Ever wanted X-ray specs or super-human vision? Chromoscope lets you explore our Galaxy (the Milky Way) and the distant Universe in <a href=\"http://blog.chromoscope.net/data/\">a range of wavelengths</a> from gamma-rays to the longest radio waves.<br /><br />Change the wavelength using the <em>slider</em> in the top right of the screen and explore space using your mouse. For more information we have <a href=\"#\" class=\"videolink\">a quick video tour</a> or you can read <a href=\"http://blog.chromoscope.net/about/\">more on our blog</a>. If you get stuck, click \"Help\" in the bottom left.<br /><br /><a href=\"http://www.astro.cardiff.ac.uk/research/instr/\"><img src=\"cardiffuni.png\" style=\"border:0px;margin: 0px 5px 5px 0px;float:left;\" /></a>Chromoscope is kindly funded by the Cardiff University <a href=\"http://www.astro.cardiff.ac.uk/research/egalactic/\">Astronomy</a> and <a href=\"http://www.astro.cardiff.ac.uk/research/instr/\">Astronomy Instrumentation</a> Groups.<br style=\"clear:both;\" />";
		this.gal = (inp.gal) ? inp.gal : 'http://en.wikipedia.org/wiki/Galactic_coordinate_system';
		this.galcoord = (inp.galcoord) ? inp.galcoord : 'Galactic Coordinates';
		this.eq = (inp.eq) ? inp.eq : 'http://en.wikipedia.org/wiki/Equatorial_coordinate_system';
		this.eqcoord = (inp.eqcoord) ? inp.eqcoord : 'Equatorial Coordinates';
		this.gamma = (inp.gamma) ? inp.gamma : 'Gamma ray';
		this.xray = (inp.xray) ? inp.xray : 'X-ray';
		this.optical = (inp.optical) ? inp.optical : 'Visible';
		this.halpha = (inp.halpha) ? inp.halpha : 'Hydrogen &#945;';
		this.nearir = (inp.nearir) ? inp.nearir : 'Near-Infrared';
		this.farir = (inp.farir) ? inp.farir : 'Far-Infrared';
		this.microwave = (inp.microwave) ? inp.microwave : 'Microwave';
		this.radio = (inp.radio) ? inp.radio : 'Radio';
		this.labels = (inp.labels) ? inp.labels : 'Labels';
		this.centre = (inp.centre) ? inp.centre : 'Centre map at this point';
		this.wikisky = (inp.wikisky) ? inp.wikisky : 'View in Wikisky';
		this.wwt = (inp.wwt) ? inp.wwt : 'View in WorldWideTelescope';
		this.nearby = (inp.nearby) ? inp.nearby : 'Objects within 10&#8242;';
		this.alignment = (inp.alignment) ? inp.alignment : 'left';
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
		if(this.showversion) $(this.body+" .chromo_version").html(this.phrasebook.version+" "+this.version);
		if($.browser.opera && $.browser.version == 9.3){ $(".keyboard").hide(); $(".nokeyboard").show(); }
	}

	// Reset the map
	Chromoscope.prototype.reset = function(){

		this.setMagnification(-1);
		this.moveMap(0,0,this.minZoom())

		// Turn off the annotation layers
		if(this.q.annotations == null || !this.q.annotations){
			for(var i=0 ; i < this.annotations.length ; i++) setOpacity($(this.body+" ."+this.annotations[i].name),0.0);
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

	Chromoscope.prototype.activate = function(){ this.active = true; }
	Chromoscope.prototype.deactivate = function(){ this.active = false; }

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


		// Define the keyboard capture
		$(document).bind("keydown",{me:this},function(e){
			if(e.data.me.ignorekeys) return true;
			if(!e) e=window.event;
			var code = e.keyCode || e.charCode || e.which || 0;
			e.data.me.keypress(code,e)
		}).bind("keypress",{me:this},function(e){
			if(e.data.me.ignorekeys) return true;
			if(!e) e=window.event;
			var code = e.keyCode || e.charCode || e.which || 0;
			e.data.me.keypress(code,e)
		});

		//console.log("Time to start load:" + (new Date() - this.start) + "ms");

		// Does the container actually exist?
		if(this.container){
			// No container so build a message to say that
			if($(this.container).length == 0){
				// No message holder so let's make one of those first
				if($(".chromo_message").length == 0) $(document).append('<div class="chromo_message"></div>');
				$(".chromo_message").css({width:"500px"});
				this.message("<span style=\"text-align:center\">The element <strong>"+this.container+"</strong> doesn't seem to exist.</span>",2000);
				this.container = '';
				return true;
			}
			$(this.body).bind('click', {me:this}, function(e){
				e.data.me.activate();
			}).bind('mouseout', {me:this}, function(e){
				e.data.me.deactivate();
			});
		}

		// Check for defined elements. If they don't exist let's create them
		if($(this.body+" .chromo_outerDiv").length == 0) $(this.body).append('<div class="chromo_outerDiv"><div class="chromo_innerDiv"></div></div>');
		if(this.title && $(this.body+" .chromo_title").length == 0) $(this.body).append('<div class="chromo_title"><h1><a href="#">Chromoscope</a></h1><h2 class="chromo_version"></h2></div>');
		if($(this.body+" .chromo_attribution").length == 0) $(this.body).append('<p class="chromo_attribution"></p>');
		if($(this.body+" .chromo_info").length == 0) $(this.body).append('<p class="chromo_info"></p>');
		if($(this.body+" .chromo_message").length == 0) $(this.body).append('<div class="chromo_message"></div>');
		if($(this.body+" .chromo_layerswitcher").length == 0) $(this.body).append('<div class="chromo_layerswitcher"></div>');

		//console.log("Time to start processLayers:" + (new Date() - this.start) + "ms");


		this.processLayers();
		//console.log("Time to end processLayers:" + (new Date() - this.start) + "ms");

		// Make sure the container is absolutely positioned.
		if(this.container) $(this.body).css('position','relative');
		else $(this.body+" .chromo_outerDiv").css({position:'absolute',height:'0px'});

		// Opera 10.10 doesn't like transparency and for some reason jQuery sometimes thinks it is version 9.8
		if($.browser.opera && $.browser.version < 10.3){ this.annotations = ""; this.wavelength_load_range = 0; this.spatial_preload = 1; }


		if(!this.title) $(this.body+" .chromo_title").toggle();
		if(this.showversion) $(this.body+" .chromo_version").html(this.phrasebook.version+" "+this.version);
		$(this.body+" .chromo_outerDiv").append('<div id="chromo_zoomer" style="width:50px;height:50px;display:none;"><div style="position:absolute;width:10px;height:10px;left:0px;top:0px;border-top:2px solid white;border-left:2px solid white;"></div><div style="position:absolute;width:10px;height:10px;right:0px;top:0px;border-top:2px solid white;border-right:2px solid white;"></div><div style="position:absolute;width:10px;height:10px;right:0px;bottom:0px;border-bottom:2px solid white;border-right:2px solid white;"></div><div style="position:absolute;width:10px;height:10px;left:0px;bottom:0px;border-bottom:2px solid white;border-left:2px solid white;"></div></div>');

		//console.log("Time to start mouse events:" + (new Date() - this.start) + "ms");

		// Define the mouse events
		$(this.body+" .chromo_outerDiv").mousedown({me:this},function(ev){
			var chromo = ev.data.me;
			if(!chromo.active) chromo.activate()
			this.startTouch = new Date().getTime();
			clickTimer = function(ev,el){
				var e = jQuery.Event("contextmenu");
				e.clientX = ev.clientX;
				e.clientY = ev.clientY;
				$(el).trigger(e);
				el.dragging = false;
			}
			chromo.clickTimeout = setTimeout(clickTimer,800,ev,this);

			if(ev.button != 2 && chromo.mouseevents){
				// Don't do anything for a right mouse button event
				// We'll attach things to the dom element (this)
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
			if(!chromo.active) return;
			if(this.dragging){
				if(chromo.clickTimeout) clearTimeout(chromo.clickTimeout);
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
					chromo.trigger("move",{position:coords,zoom:chromo.zoom});
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
			if(chromo.clickTimeout) clearTimeout(chromo.clickTimeout);
			// Bind the double tap to double click
			if(chromo.istouch){
				var delay = 500;
				var now = (new Date()).getTime();
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
			if(!chromo || !chromo.active) return;
			if(!chromo.mouseevents) return;
			if(delta > 0) chromo.changeMagnification(1,ev.pageX,ev.pageY);
			else chromo.changeMagnification(-1,ev.pageX,ev.pageY);
			return false;
		})

		//console.log("Time to end mouse events:" + (new Date() - this.start) + "ms");

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
			$(this.body+" .chromo_info").toggle();
		}).registerKey('c',function(){
			$(this.body+" .chromo_help").hide();
			$(this.body+" .chromo_message").hide();
		}).registerKey('.',function(){
			$(this.body+" h1").toggle();
			$(this.body+" h2").toggle();
			$(this.body+" .chromo_message").hide();
			$(this.body+" .chromo_layerswitcher").toggle();
			$(this.body+" .chromo_helplink").toggle();
			$(this.body+" .chromo_help").hide();
			$(this.body+" .chromo_info").hide();
			$(this.body+" .chromo_pingroups_list").toggle();
		});

		//console.log("Time to end register keys:" + (new Date() - this.start) + "ms");

		// If we have a touch screen browser, we should convert touch events into mouse events.
		if(this.istouch) $(this.body+" .chromo_outerDiv").addTouch();

		this.setViewport();

		// For a Wii make text bigger, hide annotation layer and keyboard shortcuts
		if(this.iswii || (this.istouch && (this.wide <= 800 || this.tall < 600))){ $(this.body+" .chromo_layerswitcher").css({'font-size':'0.9em'}); this.annotations = ""; $(".keyboard").css({'display':'none'}); $(".nokeyboard").css({'display':'show'}); this.wavelength_load_range = 0; this.spatial_preload = 1; }
		if(this.iswii) $(this.body+" .chromo_layerswitcher").css({'font-size':'1.5em'});

		//console.log("Time to start set mag:" + (new Date() - this.start) + "ms");

		// Set the default zoom level
		this.setMagnification(this.zoom);

		this.buildHelp();
		this.buildLinks();
		this.buildLang();
		if(this.showintro) this.buildIntro();
		else $(this.body+" .chromo_message").hide();

		//console.log("Time to end intro:" + (new Date() - this.start) + "ms");
		//console.log("Time to end context:" + (new Date() - this.start) + "ms");

		// Disable keyboard commands on input text fields
		$(this.body+" input[type=text]").live("focus",{sky:this},function(e){
			if(!e.data.sky.ignorekeys) e.data.sky.ignorekeys = true;
		}).live("blur",{sky:this},function(e){
			if(e.data.sky.ignorekeys) e.data.sky.ignorekeys = false;
		});

		if($.browser.opera && $.browser.version == 9.3){ $(".keyboard").hide(); $(".nokeyboard").show(); }

		$(this.body+" .chromo_title a").bind('click', jQuery.proxy( this, "reset" ) );


		// Now load a language if required
		if(this.q.lang) this.getLanguage(this.q.lang)
		else{ this.getLanguage(this.langshort); }

		//console.log("Time to end language:" + (new Date() - this.start) + "ms");

		if(this.spectrum.length == 0){
			$(this.body+" .chromo_message").css({width:"400px"});
			this.message("<span style=\"text-align:center\">No wavelengths have been added to your HTML file so there's nothing to see. :-(</span>",2000);
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

		//console.log("Time to end wavelengths:" + (new Date() - this.start) + "ms");

		// Make it sortable (if we have the jQuery/UI options available)
		if(typeof $().sortable=="function"){
			var cur = ($.browser.mozilla) ? 'move' : 'grabbing'; 
			$(this.body+" .chromo_keys").sortable({containment:'parent',forcePlaceHolderSize:true,placeholder:'chromo_key_highlight',cursor:cur});
			$(this.body+" .chromo_keys").bind('sortupdate',{el:this},function (event,ui){ event.data.el.orderWavelengths($(this).sortable('toArray')); });
		}

		// If the window resizes (e.g. going fullscreen)
		// we need to recalculate the screen properties
		// and re-position things.
		$(window).resize({me:this},function(e){
			var chromo = e.data.me;
			chromo.setViewport();
			chromo.positionMap({l:chromo.l,b:chromo.b});
			chromo.centreDiv(".chromo_help");
			chromo.centreDiv(".chromo_message");
		});

		//console.log("Time to trigger load:" + (new Date() - this.start) + "ms");
		this.trigger("load");
		//console.log("Time to end trigger load:" + (new Date() - this.start) + "ms");

		// If this is full page we will activate it now
		if(this.body=="body") this.activate()

		// We should now execute the callback function
		if(typeof callback=="function") callback.call();

		this.loaded = true;
		this.updateCoords();

		//console.log("Time to end:" + (new Date() - this.start) + "ms");
		$(this.body+" .chromo_info").html("Took " + (new Date() - this.start) + "ms to load.")
	}

	Chromoscope.prototype.buildKeyItem = function(key,txt){
		a = "<strong>"+key+"</strong>";
		b = txt;
		return "<li>"+a+" - "+b+"</li>"
	}
	// Construct the Help box
	Chromoscope.prototype.buildHelp = function(overwrite){

		// Construct the help box
		var txt = this.phrasebook.helpdesc;
		if(this.phrasebook.translator) txt += '<br /><br />'+this.phrasebook.name+': '+this.phrasebook.translator;
		if($(this.body+" .chromo_help").length == 0) $(this.body).append('<div class="chromo_help">'+txt+'</div>');
		else{ if(overwrite) $(this.body+' .chromo_help').html(txt); }
		var buttons = "<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('k')\">Hide/show the wavelength slider</a></li>";
		buttons += "<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('+')\">Zoom in</a></li>";
		buttons += "<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('-')\">Zoom out</a></li>";
		var h = (this.phrasebook.helpmenu) ? this.phrasebook.helpmenu : this.phrasebook.help;
		var keys = this.buildKeyItem("h",h);
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
				keys += this.buildKeyItem(this.spectrum[i].key,s);
			}
		}
		for(var i=0 ; i < this.annotations.length ; i++){
			if(this.annotations[i].key){
				var s = this.phrasebook.switchannotation.replace("__ANNOTATION__",this.phrasebook[this.annotations[i].title])
				keys += this.buildKeyItem(this.annotations[i].key,s);
			}
		}
		keys += this.buildKeyItem(".",this.phrasebook.showhide);
		keys += this.buildKeyItem("&uarr;",this.phrasebook.up);
		keys += this.buildKeyItem("&darr;",this.phrasebook.down);
		keys += this.buildKeyItem("+",this.phrasebook.zoomin);
		keys += this.buildKeyItem("&minus;",this.phrasebook.zoomout);
		$(this.body+" .chromo_controlbuttons").html(buttons);
		$(this.body+" .chromo_controlkeys").html(keys);

		if(!this.ignorekeys || !this.container){
			$(this.body+" .chromo_help").prepend(this.createClose());
			var w = (this.wide > 600) ? 600 : this.wide;
			$(this.body+" .chromo_help").css("width",(w-50)+"px");
		}

		// Construct the help link
		if($(this.body+" .chromo_helplink").length == 0) $(this.body).append('<p class="chromo_helplink"></p>');

		this.centreDiv(".chromo_help");
		$(this.body+" .chromo_help").attr('dir',(this.phrasebook.alignment=="right" ? 'rtl' : 'ltr'));
	}

	// Construct the links
	Chromoscope.prototype.buildLinks = function(overwrite){
		if($(this.body+" .chromo_helplink").length == 0) $(this.body).append('<p class="chromo_helplink"></p>');

		// Construct the Make a Link
		var str = "";
		if(!this.compact && this.showhelp) str = '<span class="chromo_helphint chromo_link">'+this.phrasebook.help+'</span>';
		if(!this.compact && this.showabout) str+= ' | <a href="http://blog.chromoscope.net/about/" class="chromo_about">'+this.phrasebook.about+'</a>';
		if(!($.browser.opera && $.browser.version == 9.3)){
			if(!this.compact){
				if(this.showshare) str += ' | <span class="chromo_linkhint chromo_link">'+this.phrasebook.share+'</span>';
				if(this.showsearch) str += ' | <span class="chromo_searchhint chromo_link">'+this.phrasebook.search+'</span>';
			}
			if(this.showsearch) this.buildSearch();
			if(this.langs.length > 1 && !this.compact && this.showlangs){
				if(str) str += ' | ';
				str += '<span class="chromo_langhint chromo_link">'+(this.wide < 800 ? '' : 'Language (')+this.langshort+(this.wide < 800 ? '' : ')')+'</span>';
			}
			if(this.showcoord){
				if(str) str += ' | '
				str += '<span class="chromo_coords"></span>';
			}
		}
		$(this.body+" .chromo_helplink").html(str);
		$(this.body+" .chromo_linkhint").bind('click', jQuery.proxy( this, "createLink" ) );
		$(this.body+" .chromo_langhint").bind('click',{id:'.chromo_lang'}, jQuery.proxy( this, "toggleByID" ) );
		$(this.body+" .chromo_helphint").bind('click',{id:'.chromo_help'}, jQuery.proxy( this, "toggleByID" ) );
		$(this.body+" .chromo_searchhint").bind('click', jQuery.proxy( this, "launchSearch" ) );
		$(this.body+" .chromo_close").bind('click',{id:'.chromo_help'}, jQuery.proxy( this, "hide" ) );
		// Allow coordinates to be converted
		$(this.body+" .chromo_coords").css({cursor:'pointer'});
		$(this.body+" .chromo_coords").bind('click',{el:this},function (event){
			event.data.el.coordinate.active = (event.data.el.coordinate.active == "G") ? "A" : "G";
			event.data.el.updateCoords();
		});

		if(!($.browser.opera && $.browser.version == 9.3)) this.updateCoords();
	}


	// Construct the Language Switcher
	Chromoscope.prototype.buildLang = function(overwrite){
		var lang = '<ul class="languages">';
		for(l = 0; l < this.langs.length ; l++) if(this.langs[l].code != this.langshort) lang += '<li><a href="?lang='+this.langs[l].code+'" class="'+this.langs[l].code+'">'+this.langs[l].name+' ('+this.langs[l].code+')</a></li>'; else this.langlong = this.langs[l].name;
		lang += '</ul>';
		if($(this.body+" .chromo_lang").length == 0) $(this.body).append('<div class="chromo_lang chromo_popup">'+lang+'</div>');
		else $(this.body+" .chromo_lang").html(lang);

		for(l = 0; l < this.langs.length ; l++){
			if(this.langs[l].code != this.langshort){
				$(this.body+' ul.languages a.'+this.langs[l].code).bind("click",{me:this,lang:this.langs[l].code},function(e){
					e.preventDefault();
					e.data.me.getLanguage(e.data.lang);
				});
			}
		}

		var w = (this.wide > 160) ? 160 : this.wide;
		$(this.body+" .chromo_lang").css("width",(w)+"px");

		var p = $(this.body+" .chromo_langhint").position();
		var h = $(this.body+" .chromo_helplink").position();
		if(p){
			var l = (h.left+p.left-$(this.body+" .chromo_lang").outerWidth()/2+$(this.body+" .chromo_langhint").outerHeight()/2);
			if(l < 10) l = 10;
			var t = (h.top-$(this.body+" .chromo_lang").outerHeight()-10);
			$(this.body+" .chromo_lang").css({position:'absolute',left:l+'px',top:t+'px'});
		}
		$(this.body+" .chromo_lang").hide();
	}

	// Construct the Video Tour
	Chromoscope.prototype.showVideoTour = function(){
		var w = 560;
		var h = 340;
		var scale = 1;
		if(w > this.wide*0.8) w = this.wide*0.8; h = w*0.6;
		if(h > this.tall*0.75) h = this.tall*0.75; w = h*1.6;

		$(this.body+" .chromo_help").hide();
		$(this.body+" .chromo_message").css({width:(w)+"px"});
		this.message(this.createClose()+'<span style=\"text-align:center\"><object width="'+w+'" height="'+h+'"><param name="movie" value="http://www.youtube.com/v/eE7-6fQ9_48&hl=en_GB&fs=1&"></param><param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param><embed src="http://www.youtube.com/v/eE7-6fQ9_48&hl=en_GB&fs=1&" type="application/x-shockwave-flash" allowscriptaccess="always" allowfullscreen="true" width="'+w+'" height="'+h+'"></embed></object></span>');
		$(this.body+" .chromo_message .chromo_close").bind('click',{id:'.chromo_message'}, jQuery.proxy( this, "hide" ) );
	}

	// Construct the splash screen
	Chromoscope.prototype.buildIntro = function(delay){
		var w = 600;
		// iPhones have wide but not very tall screens so we make the intro a bit wider if the screen height is small.
		if(this.tall <= 640) w *= 1.2;
		if(w > 0.8*this.wide) w = 0.8*this.wide;
		$(this.body+" .chromo_message").css({width:w+"px",'max-width':''});
		if(this.showintro) this.message(this.createClose()+this.phrasebook.intro,false,'left')
		$(this.body+" .videolink").bind('click',{me:this}, function(e){ e.preventDefault(); e.data.me.showVideoTour(); } );
		$(this.body+" .chromo_message .chromo_close").bind('click',{id:'.chromo_message'}, jQuery.proxy( this, "hide" ) );
		if(this.showintro && delay > 0) $(this.body+" .chromo_message").delay(delay).fadeOut(500)
	}

	Chromoscope.prototype.showLang = function(){
		$(this.body+" .chromo_lang").show();
	}

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
				this.keys.push({charCode:ch,char:String.fromCharCode(ch),fn:fn,txt:txt});
				if(this.phrasebook.alignment=="right"){
					a = '<strong>'+String.fromCharCode(ch)+'</strong>'
					b = txt;
				}else{
					b = '<strong>'+String.fromCharCode(ch)+'</strong>'
					a = txt;
				}
				if(txt) $(this.body+" .chromo_controlkeys").append('<li>'+a+' - '+b+'</li>');
			}
		}
		return this;
	}

	Chromoscope.prototype.registeredKey = function(ch){
		if(typeof ch == "string") ch = ch.charCodeAt(0);
		for(var i = 0 ; i < this.keys.length ; i++){
			if(this.keys[i].charCode == ch) return true;
		}
		return false;
	}

	// Press a key
	Chromoscope.prototype.keypress = function(charCode,event){
		if(this.ignorekeys || !this.active) return true;
		for(i = 0 ; i < this.keys.length ; i++){
			if(this.keys[i].charCode == charCode){
				this.keys[i].fn.call(this,{event:event});
				break;
			}
		}	
	}

	// Define the size and position of the main viewport
	Chromoscope.prototype.setViewport = function(){
		this.wide = (this.container) ? $(this.body).width() : $(window).width();
		this.tall = (this.container) ? $(this.body).height() : $(window).height();
		if(this.compact){
			$(this.body).css("font-size","0.7em");
			$(this.body+" .chromo_title").css("font-size","1em");
		}
		$(this.body+" .chromo_outerDiv").css('width',this.wide);
		$(this.body+" .chromo_outerDiv").css('height',this.tall);
		$(this.body+" .chromo_outerDiv").css({left:0,top:0});
	}

	// Build a structure containing information about a wavelength layer.
	// Usage: chromo.spectrum[s++] = new Wavelength({useasdefault:false,key:'f',name:'farir',tiles:'IR-tiles/',ext:'jpg',title:'Far-IR',attribution:'IRAS/NASA'});
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

	// Build a structure containing information about an annotation layer. It has the same inputs as Wavelength
	// Usage: chromo.annotations[0] = new AnnotationLayer({opacity:0.4,key:'l',name:'labels',tiles:'labels-tiles/',ext:'jpg'});
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
			this.tiles_eq = (input.tiles_eq) ? input.tiles_eq : '';
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
		this.keys = other.keys;
	}

	// Construct the wavelength slider and give it mouse events
	Chromoscope.prototype.makeWavelengthSlider = function(){

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
		$(this.body+" .chromo_layerswitcher").html(layerswitch).disableTextSelect();	//No text selection
		for(var i=0 ; i < this.spectrum.length ; i++){
			if(this.spectrum[i].key) {
				$(this.body+" .legend-"+this.spectrum[i].key).bind("click",{me:this,key:this.spectrum[i].key},function(e){
					simulateKeyPress(e.data.key);
				});
			}
		}

		var margin_t = parseInt($(this.body+" .legend-"+this.spectrum[0].key).css('margin-top'));
		var h_full = parseInt($(this.body+" .legend-"+this.spectrum[this.spectrum.length-1].key).position().top + $(this.body+" .legend-"+this.spectrum[this.spectrum.length-1].key).outerHeight());
		var h = $(this.body+" .legend-"+this.spectrum[0].key).outerHeight();
		var y = h;

		if(this.istouch){
			while(y < 25) y = parseInt(y*1.8);
		}

		// Add some padding for the wavelength slider
		$(this.body+" .chromo_layerswitcher").css('padding-right',(y*2)+'px');
		$(this.body+" .chromo_slider").css({height:h,width:y*1.2,"margin-left":"-"+(y*0.2)+"px"}).bind('mousedown',{state:true},jQuery.proxy( this, "draggable" ) ).bind('mouseup',{state:false},jQuery.proxy( this, "draggable" )).addTouch();
		$(this.body+" .chromo_sliderbar").css({'margin-right':-Math.round(y)+'px',height:h_full,width:y*0.8,'margin-top':margin_t+'px'}).bind('mousemove',{h:y,margin_t:margin_t},jQuery.proxy( this, "dragIt" ) ).bind('mouseup',{state:false},jQuery.proxy( this, "draggable" )).addTouch();
		this.positionSlider();
		if(this.zoomctrl) this.makeZoomControl();
	}

	// Set the draggingSlider property
	Chromoscope.prototype.draggable = function(event){
		this.draggingSlider = event.data.state;
		var cur,cur2;
		if (this.draggingSlider){
			cur = ($.browser.mozilla) ? '-moz-grabbing' : 'grabbing';
			cur2 = cur;
		}else{
			cur = 'pointer';
			cur2 = 'default';
		}
		$(this.body+" .chromo_slider").css({cursor:cur});
		$(this.body+" .chromo_sliderbar").css({cursor:cur2});
	}

	// Update the wavelength slider position
	Chromoscope.prototype.dragIt = function(event){
		if (this.draggingSlider){
			var yheight = $(this.body+" .chromo_sliderbar").height() - (event.data.h);
			if(this.container) var yoff = $(this.body+" .chromo_layerswitcher").position().top + event.data.margin_t + (event.data.h)/2 + $(this.body).offset().top;
			else var yoff = $(".chromo_layerswitcher").position().top + event.data.margin_t + (event.data.h)/2;
			var fract = ((event.pageY)-yoff)/(yheight);
			this.changeWavelength(fract*(this.spectrum.length-1) - this.lambda);
			this.checkTiles();
		}
	}

	// Construct the wavelength slider and give it mouse events
	Chromoscope.prototype.makeZoomControl = function(){
		var h = $(this.body+" .chromo_slider").width();
		var fs = (this.istouch) ? 1.2 : 1;
		var zoomer = "<div class=\"chromo_zoomer\"><div class=\"chromo_zoom chromo_zoomin\" title=\""+this.phrasebook.zoomin+"\">+</div><div class=\"chromo_zoom chromo_zoomout\" title=\""+this.phrasebook.zoomout+"\">&minus;</div></div>";
		$(this.body+" .chromo_layerswitcher").append(zoomer);
		$(this.body+" .chromo_zoom").css({cursor:"pointer",padding:"0px",width:"100%",height:h+"px","line-height":h+"px","text-align":"center"});
		$(this.body+" .chromo_zoomin").bind('click', jQuery.proxy( this, "zoomIn" ) );
		$(this.body+" .chromo_zoomout").bind('click', jQuery.proxy( this, "zoomOut" ) );
		var sb = $(this.body+" .chromo_sliderbar");
		var w = sb.outerWidth();
		$(this.body+" .chromo_zoomer").css({'float':'right','margin-right':Math.round(parseInt(sb.css('margin-right')) + ((w-h)/2))+"px",'width':parseInt(h)+"px",'font-size':fs+"em"});
	}

	// Process each wavelength and annotation. Build the wavelength slider and add key commands.
	Chromoscope.prototype.processLayers = function(){
		for(var i=0 ; i < this.spectrum.length ; i++){
			var s = this.spectrum[i];
			if(s.name) $(this.body+" .chromo_innerDiv").append('<div class="map '+s.name+'"></div>');
			setOpacity($(this.body+" ."+s.name),this.opacity);
		}
		for(var i=0 ; i < this.annotations.length ; i++){
			var a = this.annotations[i];
			if(a.name) $(this.body+" .chromo_innerDiv").append('<div class="annotation '+a.name+'"></div>');
			setOpacity($(this.body+" ."+a.name),a.opacity);
		}
		$(this.body+" .chromo_innerDiv").append('<span class="map kml pinholder"></span>');
		$(this.body+" .pinholder").css({"z-index":this.spectrum.length+this.annotations.length+1,left:0,top:0,width:this.mapSize*2,height:this.mapSize,position:'absolute'});
	}

	// Hide any element by the ID or style.
	// Usage: hide("#chromo_message")
	Chromoscope.prototype.hide = function(event){
		$(this.body+" "+((typeof event=="object") ? event.data.id : event)).hide();
	}

	// Show or hide any element by the ID or style.
	// Usage: toggleByID("#chromo_message")
	Chromoscope.prototype.toggleByID = function(event){
		var id = (typeof event=="object") ? event.data.id : event;
		if($(this.body+" "+id).css("display") == 'none') $(this.body+" "+id).show();
		else $(this.body+" "+id).hide();
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
		// wrapping in x
		if(left > 0){
			left -= this.mapSize;
			if(!virtual){
				$(this.body+" .chromo_innerDiv").css({left:left});
				this.checkTiles();
			}
		}
		if(left < -this.mapSize){
			left += this.mapSize;
			if(!virtual){
				$(this.body+" .chromo_innerDiv").css({left:left});
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

		z = (z && z >= 0) ? z : chromo.zoom;
		duration = (duration) ? duration : 0;
		var oldmapSize = this.mapSize;
		if(z > 0) this.setMagnification(z);

		if(this.l < 0) this.l+= 360;

		var templ = (l+360)%360;
		var newl = (templ <= 180) ? -(templ) : (360-templ);
		var newleft = -((newl)*this.mapSize/360)+(this.wide - this.mapSize)/2;
		var newtop = ((b)*this.mapSize/360)+(this.tall - this.mapSize)/2;
		var el = $(this.body+" .chromo_innerDiv");

		if(duration && (l!=this.l && b!=this.b)){
			var newpos = this.limitBounds(newleft,newtop,true);
			var _obj = this;
			this.animating = true;
			el.animate(newpos,{
				duration:duration,
				step:function(now,fx){ _obj.checkTiles(); },
				complete:function(){
					_obj.checkTiles();
					_obj.updateCoords();
					_obj.l = l;
					_obj.b = b;
					_obj.animating = false;
					_obj.trigger("move",{position:{l:l,b:b},zoom:z});
				}
			});
		}else{
			var newpos = this.limitBounds(newleft,newtop);
			el.css(newpos);
			if(jQuery.browser.msie) this.changeWavelength(0);
			this.checkTiles();
			this.updateCoords();
			this.trigger("move",{position:{l:l,b:b},zoom:z});
		}
	}

	// Update the coordinate holder
	Chromoscope.prototype.updateCoords = function(x,y){
		if(!this.loaded) return;
		var coords = this.getCoordinates(x,y);

		if(this.coordinate.active == 'G'){
			var label = ''+coords[0].toFixed(2)+'&deg;, '+coords[1].toFixed(2)+'&deg; <a href="'+this.phrasebook.gal+'" title="'+this.phrasebook.galcoord+'" style="text-decoration:none;">Gal</a>';
		}else{
			var ra_h = parseInt(coords[0]);
			var ra_m = parseInt((coords[0]-ra_h)*60);
			var ra_s = ((coords[0]-ra_h-ra_m/60)*3600).toFixed(2);
			if(ra_h < 10) ra_h = "0"+ra_h;
			if(ra_m < 10) ra_m = "0"+ra_m;
			if(ra_s < 10) ra_s = "0"+ra_s;
			var dec_sign = (coords[1] >= 0) ? "" : "-";
			var dec_d = parseInt(Math.abs(coords[1]));
			var dec_m = parseInt((Math.abs(coords[1])-dec_d)*60);
			var dec_s = ((Math.abs(coords[1])-dec_d-dec_m/60)*3600).toFixed(1);
			if(Math.abs(dec_d) < 10) dec_d = "0"+dec_d;
			if(dec_m < 10) dec_m = "0"+dec_m;
			if(dec_s < 10) dec_s = "0"+dec_s;
			var label = ''+ra_h+'h'+ra_m+'m'+ra_s+'s, '+dec_sign+dec_d+'&deg;'+dec_m+'&prime;'+dec_s+'&Prime; <a href="'+this.phrasebook.eq+'" title="'+this.phrasebook.eqcoord+'" style="text-decoration:none;">J2000</a>';
		}
		if(this.showcoord){ $(this.body+" .chromo_coords").html(label); }

		if(this.coordinate.l != this.l && this.coordinate.b != this.b){
			this.l = this.coordinate.l;
			this.b = this.coordinate.b;
			// Call an attached event
			this.trigger("wcsupdate",{position:{l:this.l,b:this.b},zoom:this.zoom});
		}

		// Store the current value of the coordinate label
		this.coordinate.label = label;
		//if(this.pushstate) history.pushState({l:this.l,b:this.b,z:this.zoom,w:this.lambda,spec:this.spectrum},"Chromoscope ("+this.l+","+this.b+")",this.getViewURL());
	}

	// Centre the map
	Chromoscope.prototype.centreMap = function(){
		this.mapSize = Math.pow(2, this.zoom)*this.tileSize;
		$(this.body+" .chromo_innerDiv").css({top:(this.tall - this.mapSize)/2,left:(this.wide - this.mapSize)/2});
		this.checkTiles();
	}

	// Centre a <div>, or other element, by name 
	// within the current container
	// Usage: this.centreDiv(".chromo_help")
	Chromoscope.prototype.centreDiv = function(el){
		$(this.body+' '+el).css({left:(this.wide-$(this.body+' '+el).outerWidth())/2,top:(this.tall-$(this.body+' '+el).outerHeight())/2});
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
			if(changeZ) $(this.body+' .tile').remove();


			if(this.performance) var stime = new Date();

			// add each tile to the inner div, checking first to see
			// if it has already been added
			var visibleTiles = (changeW && this.previousTiles.length > 0 && this.zoom == this.previousZoom && !changeForced) ? this.previousTiles : this.getVisibleTiles(visibleRange);

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
			// Now add the annotation layers
			for(var a=0 ; a < this.annotations.length ; a++){
				if( getOpacity($(this.body+" ."+this.annotations[a].name)) > 0) layers[l++] = -(a+1);
			}

			this.visibleTilesMap = new Array(visibleTiles.length*layers.length);

			var counter = 0;

			// Work out the x,y pixel values for the user-defined range
			var pixels = Math.pow(2, this.zoom)
			
			// Loop over all the layers we've pre-selected
			for(var l = 0 ; l < layers.length ; l++){
				output = "";
				var idx = layers[l];

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
				for (var v = 0; v < visibleTiles.length; v++, counter++) {
					if(idx >= 0) tileName = this.id+"_"+this.spectrum[idx].name+"x" + visibleTiles[v].x + "y" + visibleTiles[v].y + "z"+this.zoom;
					else tileName = this.id+"_"+this.annotations[-(idx+1)].name+"x" + visibleTiles[v].x + "y" + visibleTiles[v].y + "z"+this.zoom;

					this.visibleTilesMap[counter] = tileName;

					// Check if this tile was previously loaded
					var match = false;
					for (var p = 0; p < this.previousTilesMap.length; p++) {
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
								extrastyle = (this.isfilter) ? 'filter:alpha(opacity='+(this.spectrum[idx].opacity*100)+')' : '';
								output += '<img src="'+img+'" id="'+tileName+'" class="tile" style="position:absolute;left:'+(visibleTiles[v].x * this.tileSize)+'px; top:'+(visibleTiles[v].y * this.tileSize) +'px; '+extrastyle+'" />\n';
							} else {
								if(this.annotations[-(idx+1)].limitrange){
									// Check if the x,y coordinates for this tile are within the user-defined range
									if(((visibleTiles[v].x+pixels)%pixels)+1 <= (this.annotations[-(idx+1)].range.x[1]) || ((visibleTiles[v].x+pixels)%pixels) >= this.annotations[-(idx+1)].range.x[0] || visibleTiles[v].y >= this.annotations[-(idx+1)].range.y[0] || visibleTiles[v].y <= this.annotations[-(idx+1)].range.y[1]-1) inrange = false;
								}
								var tiles = this.annotations[-(idx+1)].tiles;
								tiles = (typeof tiles=="string") ? tiles : (typeof tiles["z"+this.zoom]=="string") ? tiles["z"+this.zoom] : tiles.z;
								var img = (inrange) ? this.cdn+tiles+visibleTiles[v].src+'.'+this.annotations[-(idx+1)].ext : this.spectrum[idx].blank;
								extrastyle = (this.isfilter) ? 'filter:alpha(opacity='+(this.annotations[-(idx+1)].opacity*100)+')' : '';
								output += '<img src="'+img+'" id="'+tileName+'" class="tile" style="position:absolute;left:'+(visibleTiles[v].x * this.tileSize)+'px; top:'+(visibleTiles[v].y * this.tileSize) +'px; '+extrastyle+'" />\n';
							}
						}
					}
				}
				// Write the layer
				if(idx >= 0) $(this.body+" ."+this.spectrum[idx].name).append(output);
				else $(this.body+" ."+this.annotations[-(idx+1)].name).append(output);
			}
			// Set all the tiles sizes
			$(this.body+' .tile').css({width:this.tileSize,height:this.tileSize});

			if(!changeZ || changeForced){
				for (var p = 0; p < this.previousTilesMap.length; p++) {
					var match = false;
					for (var v = 0; v < this.visibleTilesMap.length; v++) {
						if(this.previousTilesMap[p] == this.visibleTilesMap[v]){
							match = true;
							v = this.visibleTilesMap.length;
							// If it exists we can skip the rest of this for loop
							break;
						}
					}
					// No longer exists so can be removed
					if(!match) $(this.body+" ."+this.previousTilesMap[p]).remove();
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
				$(this.body+" .chromo_info").html('checkTiles took '+parseInt((etime-stime))+'ms (avg='+parseInt(this.times.avg())+')').show()
			}

		}
		// If we've added any pins we need to position them and their
		// balloons here. It wouldn't be necessary but because their 
		// content might take a little while to load, we can't trust
		// their initial positions.
		if((changeXY && this.pins.length > 0 && !changeZ) || changeForced) this.wrapPins();
	}

	// Used by checkTiles(), this calculates the visible x,y range.
	Chromoscope.prototype.getVisibleRange = function(coordtype){

		if(coordtype){
			// Work out the X,Y coordinates
			var l = -$(this.body+" .chromo_innerDiv").position().left;
			var r = l+this.wide;
			var t = -$(this.body+" .chromo_innerDiv").position().top;
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
			var startX = Math.abs(Math.floor($(this.body+" .chromo_innerDiv").position().left / this.tileSize)) - this.spatial_preload;
			//startX = (startX < 0) ? 0 : startX;
			var startY = Math.abs(Math.floor($(this.body+" .chromo_innerDiv").position().top / this.tileSize)) - this.spatial_preload;
			startY = (startY < 0) ? 0 : startY;
			var spatialpre2 = (2*this.spatial_preload);
			var tilesX = Math.ceil($(this.body+" .chromo_outerDiv").width() / this.tileSize) + spatialpre2;
			var tilesY = Math.ceil($(this.body+" .chromo_outerDiv").height() / this.tileSize) + spatialpre2;
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
		this.trigger("slide",{lambda:this.lambda});
	}

	Chromoscope.prototype.updateCredit = function(){
		var l = Math.floor(this.lambda);
		var h = Math.ceil(this.lambda);
		var z = this.zoom
		var c1 = this.spectrum[l].attribution;
		c1 = (typeof c1=="string") ? c1 : (typeof c1["z"+z]=="string") ? c1["z"+z] : c1.z;

		if(h == l) $(this.body+" .chromo_attribution").html(c1);
		else{
			var c2 = this.spectrum[h].attribution;
			c2 = (typeof c2=="string") ? c2 : (typeof c2["z"+z]=="string") ? c2["z"+z] : c2.z;
			$(this.body+" .chromo_attribution").html(''+c1+' &amp; '+c2+'');
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
			if(low == high) y = $(this.body+" .legend-"+this.spectrum[low].key).position().top;
			else {
				ylow = $(this.body+" .legend-"+this.spectrum[low].key).position().top;
				yhigh = $(this.body+" .legend-"+this.spectrum[high].key).position().top;
				y = ylow + (yhigh-ylow)*(this.lambda-low);
			}
			$(this.body+" .chromo_slider").css('margin-top',y);
		}	
	}

	animateWavelength = function(chromo,target,velocity){
		var tick = 200;	// ms
		chromo.changeWavelength(velocity*tick);
		chromo.checkTiles();
		if((velocity > 0 && chromo.lambda < target) || (velocity < 0 && chromo.lambda > target)) setTimeout(animateWavelength,tick,chromo,target,velocity);
		else chromo.changeWavelength( target-chromo.lambda);
	}


	// Change the visible wavelength by a pseudo-wavelength amount.
	// The gap between wavelengths is 1.0.
	// Usage: changeWavelength(0.1)
	Chromoscope.prototype.changeWavelength = function(byWavelength,duration){

		var low = Math.floor(this.lambda);
		var high = Math.ceil(this.lambda);
		var output = '';
		if(duration && duration!=0){
			animateWavelength(this,this.lambda+byWavelength,byWavelength/duration);
		}else{
			this.setWavelength(this.lambda + byWavelength);

			for(var idx=0 ; idx < this.spectrum.length ; idx++){
				if(idx < low || idx > high){
					this.spectrum[idx].opacity = 0;
					setOpacity($(this.body+" ."+this.spectrum[idx].name),0);
				}
				if(idx == low || idx == high){
					//newOpacity = (idx == low) ? (1-(this.lambda-low)).toFixed(2) : (1+(this.lambda-high)).toFixed(2);
					newOpacity = (idx == low) ? 1 : (1+(this.lambda-high)).toFixed(2);
					newOpacity = Math.min(this.maxOpacity,Math.max(this.minOpacity, newOpacity));
					this.spectrum[idx].opacity = newOpacity;
					setOpacity($(this.body+" ."+this.spectrum[idx].name),newOpacity);
				}
			}
		}
	}

	// Change the visible wavelength by the keyboard shortcut character
	Chromoscope.prototype.changeWavelengthByName = function(character,duration){
		if(!character) return;
		var matched = 0;
		var backup = 0;

		if(duration && duration!=0){
			for(var i=0 ; i < this.spectrum.length ; i++){
				if(character == this.spectrum[i].key){
					animateWavelength(this,i,(i-this.lambda)/duration);
				}
			}
		}else{
			for(var i=0 ; i < this.spectrum.length ; i++){
				backup = (this.spectrum[i].useasdefault) ? i : backup;
				if(character == this.spectrum[i].key){
					this.setWavelength(i);
					this.spectrum[i].opacity = this.maxOpacity;
					setOpacity($(this.body+" ."+this.spectrum[i].name),this.spectrum[i].opacity);
					matched = 1;
				}else{
					this.spectrum[i].opacity = 0;
					setOpacity($(this.body+" ."+this.spectrum[i].name),0);
				}
			}
			if(!matched){
				this.setWavelength(backup);
				this.spectrum[backup].opacity = this.maxOpacity;
				setOpacity($(this.body+" ."+this.spectrum[backup].name),this.spectrum[backup].opacity);
			}
		}

	}

	// Show/hide the annotation layer by keyboard shortcut character
	// Usage: toggleAnnotationsByName('l')
	Chromoscope.prototype.toggleAnnotationsByName = function(character){
		if(!character) return;
		for(var i=0 ; i < this.annotations.length ; i++){
			if(character == this.annotations[i].key){
				if(getOpacity($(this.body+" ."+this.annotations[i].name)) == this.annotations[i].opacity) setOpacity($(this.body+" ."+this.annotations[i].name),0);
				else setOpacity($(this.body+" ."+this.annotations[i].name),this.annotations[i].opacity);
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
//console.log('zoom ',z,this.zoom,' ',this.l,this.b)
		this.zoom = Math.round(z*100)/100;
		var minZ = this.minZoom();
		if(this.zoom < minZ){ 
			this.zoom = minZ;
			if(z >= 0){
				$(this.body+" .chromo_message").css({'max-width':"250px"});
				this.message('<p style=\"text-align:center\">'+this.phrasebook.nozoomout+'</p>',1000);
			}
		}
		if(this.zoom > this.maxZoom){
			this.zoom = this.maxZoom;
			if(z >= 0){
				$(this.body+" .chromo_message").css({'max-width':"250px"});
				this.message('<p style=\"text-align:center\">'+this.phrasebook.nozoomin+'</p>',1000);
			}
				
		}
		var oldmapSize = this.mapSize;
		this.mapSize = Math.pow(2, this.zoom)*this.tileSize;
		var scale = this.mapSize/oldmapSize
		this.zoomPins(scale);
		this.updateCredit();
		this.trigger("zoom",{zoom:this.zoom,scaling:scale});
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
			x -= Math.round($(this.body).offset().left);
			y -= Math.round($(this.body).offset().top);
		}
		if(byZoom==0) return;
		originalzoom = this.zoom;
		this.setMagnification(this.zoom + byZoom);
		if(this.zoom == originalzoom) return;

		// Store the position of the map relative to the map holder
		this.y = $(this.body+" .chromo_innerDiv").position().top;
		this.x = $(this.body+" .chromo_innerDiv").position().left;

		// Get the position
		var pos = this.getNewPosition(this.x,this.y,byZoom);
		var xoff,yoff;
		if(byZoom > 0){
			xoff = (x) ? (this.wide/2 - x) : 0;
			yoff = (y) ? (this.tall/2 - y) : 0;
		}else{
			xoff = (x) ? -(this.wide/2 - x)*0.5 : 0;
			yoff = (y) ? -(this.tall/2 - y)*0.5 : 0;
		}

		var newpos = this.limitBounds(pos.left + xoff,pos.top + yoff);
		$(this.body+" .chromo_innerDiv").css(newpos);

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

	// Get the current map centre coordinates in the current coordinate system
	Chromoscope.prototype.getCoordinates = function(offx,offy,sys){
		if(!this.loaded) return [0,0]
		if(typeof offx=="string"){ sys = offx; offx = ""; }
		if(typeof sys!="string") sys = this.coordinate.active;
		if(!offx) var offx = $(this.body+" .chromo_outerDiv").width()*0.5;
		if(!offy) var offy = $(this.body+" .chromo_outerDiv").height()*0.5;
		var scale = 360/this.mapSize;
		var p = $(this.body+" .chromo_innerDiv").position();
		this.coordinate.l = 180-(((offx-p.left)*scale)%360);
		this.coordinate.b = (p.top+this.mapSize*0.5-offy)*scale;
		if(this.coordinate.system=='A'){
			l = this.coordinate.l;
			if(l < 0) l = 360+l;
			if(sys == 'A'){
				return [l/15,this.coordinate.b]
			}else{
				return Equatorial2Galactic(this.coordinate.l,this.coordinate.b);
			}
		}else{
			if(sys == 'A'){
				radec = Galactic2Equatorial(this.coordinate.l,this.coordinate.b);
				return [radec.ra,radec.dec];
			}else return [this.coordinate.l,this.coordinate.b]
		}
	}

	// Get the Galactic coordinates for the current map centre
	Chromoscope.prototype.getCoords = function(offx,offy){
		var c = this.getCoordinates(offx,offy);
		return {l:this.coordinate.l, b:this.coordinate.b}
	}

	Chromoscope.prototype.buildSearch = function(){
		// Create the search box if necessary
		if($(this.body+" .chromo_search").length == 0){
			$(this.body).append('<div class="chromo_search chromo_popup">'+this.createClose()+'<form id="'+this.container+'_search_form" name="'+this.container+'_search_form"><div class="chromo_search_area"><input type="text" name="name" style="width:160px;" class="chromo_search_object" /><button type="submit" name="chromo_search_submit" class="chromo_search_submit">'+this.phrasebook.search+'</button></div><div class="chromo_search_message"></div></form></div>');
			$(this.body+' .chromo_search form').bind('submit',{chromo:this},function(e){
				e.preventDefault();
				args = {val:$(e.data.chromo.container+" .chromo_search_object").val(),name:$(e.data.chromo.container+" .chromo_search_type:checked").val()}
				var exists = -1;
				for(i = 0; i < e.data.chromo.search.length ; i++){
					if(e.data.chromo.search[i].name == args.name) exists = i;
				}
				if(exists >= 0) e.data.chromo.search[exists].fn.call(e.data.chromo,args);
				return false;
			});

			this.trigger("buildSearch");
		}
		var exists, s;
		for(i = 0; i < this.search.length ; i++){
			exists = false;
			s = this.search[i];
			$(this.body+" .chromo_search_type").each(function(){
				if($(this).val() == s.name) exists = true;
			})
			if(!exists) $(this.body+" .chromo_search_area").after('<input type="radio" name="chromo_search_type" class="chromo_search_type" value="'+s.name+'" /> '+s.desc);
		}
		$(this.body+" .chromo_search_type").first().click();

		$(this.body+" .chromo_search_submit").html(this.phrasebook.search)
		$(this.body+" .chromo_search").css({"width":"250px","z-index":1000}).hide()
		$(this.body+" .chromo_controlbuttons").append("<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('s')\">"+this.phrasebook.search+"</a></li>");
		$(this.body+" .chromo_search .chromo_close").bind('click', function(ev){ $('.chromo_search').hide(); $('.chromo_search_object').blur(); } );
		if(this) this.centreDiv(".chromo_search");

	}

	Chromoscope.prototype.launchSearch = function(){

		// Disable the intro just in case the user is really quick
		this.showintro = false;	

		// Hide message boxes
		$(this.body+" .chromo_help").hide();
		$(this.body+" .chromo_message").hide();
		$(this.body+" .chromo_search").show();

		this.centreDiv(".chromo_search");

		if($(this.body+" .chromo_search").is(':visible')) $(this.body+" .chromo_search_object").focus().select();
		else $(this.body+" .chromo_search_object").blur();
	}

	Chromoscope.prototype.registerSearch = function(args){
		if(!args.name || !args.desc || typeof args.fn!="function") return this;

		var exists = false;
		for(var i = 0 ; i < this.search.length ; i++){
			if(this.search[i].name == args.name) exists = true;
		}
		if(!exists) this.search.push(args)

		// If we have the ability to search we will register the key
		if(!this.registeredKey('s')){
			this.registerKey(['s','/'],function(e){
				e.event.preventDefault()
				this.launchSearch();
			},this.phrasebook.search);
		}
		return this;
	}

	// Create a web link to this view
	Chromoscope.prototype.createLink = function(){
		var url = this.getViewURL();
		var safeurl = url.replace('&','%26');
		$(this.body+" .chromo_message").css({width:400});
		var icons = '<a href="http://twitter.com/home/?status=Spotted+this+with+@chromoscope+'+safeurl+'"><img src="'+this.dir+'twitter.gif" title="Tweet this" /></a><a href="http://www.facebook.com/sharer.php?u='+safeurl+'"><img src="'+this.dir+'facebook.gif" title="Share with Facebook" /></a><a href="http://www.blogger.com/blog-this.g?t=&amp;n=Chromoscope&amp;u='+safeurl+'"><img src="'+this.dir+'blogger.gif" title="Add to Blogger" /></a><a href="http://del.icio.us/post?url='+safeurl+'"><img src="'+this.dir+'delicious.gif" title="Tag with del.icio.us" /></a><a href="http://slashdot.org/bookmark.pl?title=Chromoscope&amp;url='+safeurl+'"><img src="'+this.dir+'slashdot.gif" title="Slashdot this" /></a><a href="http://digg.com/submit?phase=2&url='+safeurl+'"><img src="'+this.dir+'digg.gif" title="Digg this" /></a><a href="http://www.mixx.com/submit?page_url='+safeurl+'"><img src="'+this.dir+'mixx.png" title="Add to Mixx" /></a>';
		var share = (this.phrasebook.sharewith.indexOf("__ICONS__") > 0) ? this.phrasebook.sharewith.replace("__ICONS__",icons) : this.phrasebook.sharewith+icons;
		this.message(this.createClose()+"<div style=\"text-align:center\">"+this.phrasebook.url+'<input type="text" class="chromo_createdLink" value="'+url+'" style="width:100%;" /><br /><p class="social">'+share+' </p></div>')
		$(this.body+" .chromo_message .chromo_close").bind('click',{id:'.chromo_message'}, jQuery.proxy( this, "hide" ) );
		$(this.body+" .chromo_createdLink").focus(function(){
			$(this).select();
		})
	}

	Chromoscope.prototype.getViewURL = function(){
		var w = "";
		for(i = 0; i < this.spectrum.length; i++){
			w += this.spectrum[i].key; 
			w += (i == this.spectrum.length-1) ? '' : ',';
		}
		var url = window.location.protocol + "//" + window.location.host + "" + window.location.pathname+'?l='+this.l.toFixed(4)+'&b='+this.b.toFixed(4)+'&w='+this.lambda.toFixed(2)+'&o='+w+'&z='+this.zoom;
		if(this.events['getViewURL']){
			var o = this.trigger("getViewURL",{'url':url})
			for(i = 0 ; i < o.length ; i++) url += o
		}
		return url;
	}

	// Return the HTML for a close button
	Chromoscope.prototype.createClose = function(type){
		var w = 28;
		// In the case of the Wii or a small touch screen we should make the close control larger
		if(this.iswii || (this.istouch && (this.wide <= 800 || this.tall <= 600))) w *= 2;
		return '<span class="chromo_close"><img src="'+this.dir+'close.png" style="width:'+w+'px;" title="'+this.phrasebook.closedesc+'" /></span>';
	}

	// Return the HTML for a close button
	Chromoscope.prototype.createCloseOld = function(){
		var s = this.phrasebook.close.replace('C','<span style="text-decoration:underline;">C</span>')
		return '<div class="chromo_close" title="'+this.phrasebook.closedesc+'">'+s+'</div>';
	}
	// Make a message
	Chromoscope.prototype.message = function(html,delay,align){
		msg = $(this.body+" .chromo_message");
		if(delay && delay > 0) msg.html(html).show().delay((typeof delay=="number") ? delay : 2000).fadeOut(500);
		else msg.html(html).show();
		this.centreDiv(".chromo_message");
		msg.attr('dir',(this.phrasebook.alignment=="right" ? 'rtl' : 'ltr'));
	}
	// Bind events
	Chromoscope.prototype.bind = function(ev,fn){
		if(typeof ev!="string" || typeof fn!="function") return this;
		if(this.events[ev]) this.events[ev].push(fn);
		else this.events[ev] = [fn];
		return this;
	}
	// Trigger a defined event with arguments. This is meant for internal use to be 
	// sure to include the correct arguments for a particular event
	// chromo.trigger("zoom",args)
	Chromoscope.prototype.trigger = function(ev,args){
		if(typeof ev != "string") return;
		if(typeof args != "object") args = {};
		var o = [];
		var _obj = this;
		if(typeof this.events[ev]=="object"){
			for(i = 0 ; i < this.events[ev].length ; i++){
				if(typeof this.events[ev][i] == "function") o.push(this.events[ev][i].call(_obj,args))
			}
		}
		if(o.length > 0) return o
	}

	Chromoscope.prototype.addPinGroup = function(inp){
		var len = this.pingroups.length;
		var i = 0;
		for(i = 0 ; i < len ; i++) if(this.pingroups[i].id == inp.id) return i;

		if(i == len){
			inp.id = (typeof inp.id=="string") ? inp.id.replace(/[^0-9a-zA-Z]/g,"-") : "pingroup-"+len;
			this.pingroups.push({
				id: inp.id,
				title: inp.title
			});
		}
		return len;
	}

	// Add a checkbox to be able to turn off this set of pins
	Chromoscope.prototype.addPinGroupSwitches = function(){

		if($(this.body+" .chromo_pingroup_list").length == 0) $(this.body).append('<div class="chromo_pingroup_list"><form id="chromo_pingroup_list"><ul></ul></form></div>');

		for(var i = 0 ; i < this.pingroups.length ; i++){
			var found = false;
			$(this.body+" #chromo_pingroup_list ul li input").each(function(){
				if(parseInt($(this).val()) == i) found = true;
			})
			if(!found){
				$(this.body+' #chromo_pingroup_list ul').append('<li><input type="checkbox" value="'+i+'" checked />'+this.pingroups[i].title+'</li>');
				$(this.body+' .chromo_pingroup_list ul li:last input').change({chromo:this,id:this.pingroups[i].id},function(e){
					e.data.chromo.toggleByID('.'+e.data.id);
				});
			}
		}
	}

	Chromoscope.prototype.removePin = function(id){
		for(var p = 0 ; p < this.pins.length; p++){
			if(this.pins[p].id == id){
				//$('#'+this.pins[p].pinid).remove();
				//$('#'+this.pins[p].info.id).remove();
				q = this.pins.splice(p,1);
			}
		}
	}

	// Add to the pin array
	Chromoscope.prototype.addPin = function(input,delayhtml){
		// Define which group this pin is a member of
		if(typeof input.group!="number") input.group = 0;
		if(input.group >= this.pingroups.length) this.addPinGroup({id:'main',title:'Group of markers'});

		if(!input.id) input.id = "pin-"+this.pins.length;
		if(typeof delayhtml!="boolean") delayhtml = false;

		this.pins.push(new Pin(input,this,delayhtml));
	}

	// Define a pin
	// Usage: chromolayer.pins[p] = new Pin({id:1,img:'something.png',title:'Title',desc:'A description',glon:120.0,glat:5.2},chromo,delayhtml)
	//	id = The unique ID which will refer to this pin
	//	group = The ID of the pin group
	//	img (string) = The location of an image file to use as a pin. Can be remote.
	//	x (number) = The x position of the pin image relative to the point
	//	y (number) = The y position of the pin image relative to the point
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
	//	chromo = The chromoscope instance that this will attach to
	//	delayhtml = True if you want to add a lot of pins one-after-the-other. You'll need to call updatePins({draw:true})
	//	src = An id for the source of this pin
	function Pin(inp,el,delayhtml){
		if(inp){
			this.el = el;

			this.group = (inp.group) ? inp.group : 0;
			this.id = inp.id;
			this.loc = el.container+' .pinholder';
			this.style = inp.style;
			this.info = { id:'',style:'', html:'', visible:false, width:((typeof inp.width=="number") ? inp.width : 0) };
			this.info.style = (inp.balloonstyle) ? inp.balloonstyle : "";
			if(typeof inp.img=="object") this.img = inp.img;
			else{
				this.img = new Image();
				this.img.src = (typeof inp.img=="string" && inp.img.length > 0) ? inp.img : 'pin.png';
			}
			this.title = (inp.title) ? inp.title : '';
			this.desc = (inp.desc) ? inp.desc : '';


			// Coordinates
			if(inp.ra && inp.dec){
				this.ra = (inp.ra) ? inp.ra : 0.0;
				this.dec = (inp.dec) ? inp.dec : 0.0;
				kml_coord = Equatorial2Galactic(this.ra, this.dec);
				this.glon = kml_coord[0];
				this.glat = kml_coord[1];
			}else{
				this.glon = (inp.glon) ? inp.glon : 0.0;
				this.glat = (inp.glat) ? inp.glat : 0.0;
			}
			kml_coord = Galactic2XY(this.glon,this.glat,el.mapSize);
			this.pos = { x: kml_coord[0], y: kml_coord[1] };

			// Dimensions and positioning
			this.h = (typeof inp.h=="number") ? inp.h : (this.img.height) ? this.img.height : 30;
			this.w = (typeof inp.w=="number") ? inp.w : (this.img.width) ? this.img.width : 30;
			// Have we guessed the dimensions?
			this.dimensionguess = (this.h==30 && this.w==30) ? true : false;
			this.x = (typeof inp.x=="number") ? inp.x : 0.5;
			this.y = (typeof inp.y=="number") ? inp.y : 1;
			this.xunits = (typeof inp.xunits=="string") ? inp.xunits : "fraction";
			this.yunits = (typeof inp.yunits=="string") ? inp.yunits : "fraction";

			this.info.id = "balloon-"+this.id;
			this.html = '<div class="pin '+el.pingroups[this.group].id+'" title="'+this.title+'" id="'+this.id+'" style="position:absolute;display:block;width:'+this.w+';height:'+this.h+'"><img src="'+this.img.src+'" style="width:100%;height:100%;" /></div>';
			// Some booleans to keep track of what we've done to the pin
			this.placed = false;
			this.drawn = false;
			this.bound = false;

			if(!this.dimensionguess){
				// Position the pin
				this.xoff = (this.xunits=="pixels") ? this.x : this.w*this.x;
				this.yoff = (this.yunits=="pixels") ? this.y : this.h*this.y;
			}
			this.info.html = this.buildBalloon()

			if(!delayhtml){
				$(this.loc).append(this.html);
				this.drawn = true;
				this.jquery = $("#"+this.id);
				this.xoff = (this.xunits=="pixels") ? this.x : this.w*this.x;
				this.yoff = (this.yunits=="pixels") ? this.y : this.h*this.y;
				this.jquery.css({left:(parseInt(this.pos.x - this.xoff)),top:(parseInt(this.pos.y - this.yoff))});
				this.placed = true;
				this.jquery.unbind('mousedown').bind('mousedown',{p:this,el:el},function(e){ e.data.p.toggleBalloon(); });
				this.bound = true;
				this.jquery.show();
			}
		}
	}


	Chromoscope.prototype.updatePins = function(inp){
		var draw = (typeof inp.draw=="boolean") ? inp.draw : false;
		var finish = (inp.finish) ? inp.finish : false;
		var max = this.pins.length;
		//console.log("Time to start of updatePins: " + (new Date() - this.start) + "ms");

		// Construct the HTML for all the pins in one go as
		// this is quicker than adding them one at a time
		if(draw){
			var html = "";
			for(var p = 0 ; p < max ; p++){
				if(!this.pins[p].drawn){
					html += this.pins[p].html;
					this.pins[p].drawn = true;
				}
			}
			//console.log("part 2: " + (new Date() - this.start) + "ms");
			if(html) $(this.body+' .pinholder').append(html);
			//console.log("part 3: " + (new Date() - this.start) + "ms");
		}
		//console.log("Time to start of updatePins: " + (new Date() - this.start) + "ms");
		for(var p = 0 ; p < max ; p++) if(!this.pins[p].placed) this.updatePin(p,finish);
		//console.log("Time to end of updatePins: " + (new Date() - this.start) + "ms");
		this.addPinGroupSwitches();
		this.registerSearch({name:'placemark',desc:'placemarks',fn:function(args){ this.findPin(args.val); return false; }});
		this.buildLinks();
	}

	Chromoscope.prototype.updatePin = function(p,finish){
//console.log('updatePin',p,finish,'dimensionguess = ',this.pins[p].dimensionguess,this.pins[p].img.width)
		var pin = this.pins[p];
		if(!pin.jquery) pin.jquery = $("#"+pin.id);
		if(!pin.placed){
			if(pin.dimensionguess){
				if(pin.img.width > 0 || finish){
					pin.h = pin.img.height ? pin.img.height : 30;
					pin.w = pin.img.width ? pin.img.width : 30;
					pin.dimensionguess = false;
					pin.xoff = (pin.xunits=="pixels") ? pin.x : pin.w*pin.x;
					pin.yoff = (pin.yunits=="pixels") ? pin.y : pin.h*pin.y;
					pin.jquery.css({left:(parseInt(pin.pos.x - pin.xoff)),top:(parseInt(pin.pos.y - pin.yoff)),width:pin.w,height:pin.h});
					pin.placed = true;
				}
			}else{
				if(!pin.placed){
					pin.jquery.css({left:(parseInt(pin.pos.x - pin.xoff)),top:(parseInt(pin.pos.y - pin.yoff))});
					pin.placed = true;
				}
			}
		}
		if(!pin.bound){
			pin.jquery.unbind('mousedown').bind('mousedown',{p:pin},function(e){ e.data.p.toggleBalloon(); });
			pin.bound = true;
		}
	}

	Pin.prototype.buildBalloon = function(){
		var contents = "";
		// Deal with KML balloon styles
		if(this.info.style){
			// We need to replace the $[name] and $[description]
			var text = this.info.style;
			text = text.replace("$[name]",this.title)
			contents = text.replace("$[description]",this.desc)
		}else{
			// There is no user-provided styling so apply a basic style
			contents = (this.msg) ? this.msg : '<h3>'+this.title+'</h3><p>'+this.desc+'</p>';
		}
		// Make the <div> to hold the contents of the balloon
		return '<div class="balloon '+this.info.id+'" style="position:absolute;">'+contents+this.el.createCloseOld()+'</div>';
	}

	Pin.prototype.toggleBalloon = function(){
		if(this.info.visible) this.hideBalloon();
		else this.showBalloon();
	}
	Pin.prototype.hideBalloon = function(){
		$(this.el.body+" ."+this.info.id).remove();
		this.info.visible = false;
		this.el.trigger("pinclose",{pin:this});
	}
	Pin.prototype.showBalloon = function(duration){
		var rad = 10;

		var id = this.loc+" ."+this.info.id;

		if($(id).length > 0){
			$(id).remove();
			this.info.visible = false;
		}

		if(!this.info.html) this.info.html = this.el.buildBalloon(this)
		$(this.loc).append(this.info.html);

		el = $(id);

		if(this.info.width > 0) el.css({'width':this.info.width});
		var w = el.outerWidth();
		var h = el.outerHeight();

		// Correction for (e.g. IE < 9) where the width goes crazy
		if(w > this.el.wide){
			w = (w > 500) ? 330 : w/2;
			el.css({'width':w});
		}

		// Remove all previous arrows that exist
		$(id+' .arrowtop').remove();
		$(id+' .arrow').remove();

		// Position the balloon relative to the pin
		this.info.x = -w/2;
		if((this.pos.y-h-rad) < this.el.mapSize*0.25){
			this.info.y = this.h*0.25;
			el.prepend('<div class="arrowtop"></div>');
			$(id+" .arrowtop").css({'left':((parseInt(w/2)-rad))});
		}else{
			this.info.y = -h-rad;
			el.append('<div class="arrow"></div>');
			$(id+" .arrow").css({'left':((parseInt(w/2)-rad))});
		}
		el.css({'left':parseInt(this.pos.x+this.info.x),'top':(this.pos.y+this.info.y)});

		if(duration && duration > 0) el.fadeIn(duration);
		else el.show();
		this.info.visible = true;

		// Attach event
		$(id+" .chromo_close").bind('mousedown',{me:this.el,id:id,pin:this},function(e){
			e.data.me.mouseevents = true;
			$(e.data.id).remove();
			e.data.pin.info.visible = false;
			e.data.me.trigger("pinclose",{pin:e.data.pin});
			return false;
		});
		el.bind('mouseover',{me:this.el},function(e){
			e.data.me.mouseevents = false;
		}).bind('mouseout',{me:this.el},function(e){
			e.data.me.mouseevents = true;
		})
		this.el.trigger("pinopen",{pin:this});
	}

	// Go through each pin and reposition it on the map
	Chromoscope.prototype.wrapPins = function(i){
		if(this.pins.length == 0) return true;
		max = (typeof i=="number") ? i : this.pins.length;
		i = (typeof i=="number") ? i : 0;
		var x = $(this.body+" .chromo_innerDiv").position().left;
		var y = $(this.body+" .chromo_innerDiv").position().top;

		//d = new Date()
		// Get the visible range in x,y coords
		var r = this.getVisibleRange('X');
		// Expand range by one tile size
		r.right += this.tileSize;
		r.left -= this.tileSize;
		var moveby = 0;
		for(var p = i ; p < max ; p++){
			moveby = 0;
			// Is the pin outside the visible area
			if(this.pins[p].pos.x > r.right || this.pins[p].pos.x < r.left){
				while(this.pins[p].pos.x+moveby > r.right) moveby -= this.mapSize;
				while(this.pins[p].pos.x+moveby < r.left) moveby += this.mapSize;
				if(this.pins[p].pos.x+moveby < r.right && this.pins[p].pos.x+moveby > r.left){
					this.pins[p].pos.x += moveby;
					this.pins[p].jquery.css({left:(parseInt(this.pins[p].pos.x)-this.pins[p].xoff)});
					if(this.pins[p].info.visible) $(this.body+" ."+this.pins[p].info.id).css({'left':((this.pins[p].pos.x)+this.pins[p].info.x)});
				}
			}
		}
		//console.log("Time to end wrap: " + (new Date() - d) + "ms");
	}

	Chromoscope.prototype.findPin = function(query){
		if(typeof query != "string") return false;
		var q = query.toLowerCase();
		var matched = 0;
		var i = -1;
		for(var p = 0 ; p < this.pins.length; p++){
			if(this.pins[p].title.toLowerCase() == q){
				matched++;
				i = p;
			}
		}
		// If it didn't match on a title we'll check in the rest of the balloon
		if(matched == 0){
			for(var p = 0 ; p < this.pins.length; p++){
				d = this.pins[p].info.html.replace(/<\S[^><]*>/g,'');
				if(d.toLowerCase().indexOf(q) >= 0){
					matched++;
					i = p;
				}
			}
		}

		if(matched == 0) msg = "Not found.";
		else if(matched == 1){
			this.moveMap(this.pins[i].glon,this.pins[i].glat,this.zoom,1000);
			this.pins[i].showBalloon();
			this.hide('.chromo_search');
			$(this.body+' .chromo_search_object').blur();
			msg = "";
		}else msg = "Found "+matched+" matches.";

		$(this.container+' .chromo_search_message').html(msg);
		return false;
	}

	// If we zoom the map, we don't have to recalculate everything, 
	// just scale the positions by the zoom factor
	Chromoscope.prototype.zoomPins = function(scale){
		if(scale != 1){
			$(this.body+" .kml").css({width:this.mapSize*2,height:this.mapSize});
			for(var p = 0 ; p < this.pins.length ; p++){
				this.pins[p].pos.x *= scale;
				this.pins[p].pos.y *= scale;
				// Update the pin position
				this.pins[p].jquery.css({left:((this.pins[p].pos.x) - this.pins[p].xoff),top:((this.pins[p].pos.y) - this.pins[p].yoff)});
			}
			// If the info balloon is visible, update its position too
			for(var p = 0 ; p < this.pins.length ; p++){
				if(this.pins[p].info.visible) $(this.body+" ."+this.pins[p].info.id).css({'left':((this.pins[p].pos.x)+this.pins[p].info.x),'top':((this.pins[p].pos.y)+this.pins[p].info.y)});
			}
		}
	}

	Chromoscope.prototype.simulateKeyPress = function(key){
		simulateKeyPress(key);
	}
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

	// A fake key press. Allows us to use the 
	// functionality of the key press commands 
	// without the user pressing anything.
	function simulateKeyPress(character) {
		evtype = (character == '+' || character == '-') ? "keydown" : "keypress";
		jQuery.event.trigger({ type : evtype, which : character.charCodeAt(0)});
	}

	$.chromoscope = function(placeholder,input) {
		if(typeof input=="object") input.container = placeholder;
		else {
			if(typeof placeholder=="string") input = { container: placeholder };
			else input = placeholder;
		}
		input.plugins = $.chromoscope.plugins;
		return new Chromoscope(input);
	};
	$.chromoscope.plugins = [];
})(jQuery);




// ===================================
// Generic functions that are independent 
// of the chromo container

// A cross browser way to get the opacity of an element
// Usage: getOpacity($("#chromo_message"))
function getOpacity(el){
	if(typeof el=="string") el = $(el);
	if(this.isfilter) return (el.css("filter").replace(/[^0-9.]*/g,""))/100;
	else return parseFloat(el.css("opacity")).toFixed(3); // Only need 3dp precision - this stops floating point errors in Chrome
}

// A cross browser way to set the opacity of an element
// Usage: setOpacity($("#chromo_message"),0.4)
function setOpacity(el,opacity){
	if(typeof el=="string") el = $(el);
	if(this.isfilter){
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
	var ra = alpha/15;
	return {ra:ra,dec:delta};
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
