var http_request = false;
var lookup_done = true;
var lookup_start = 0;

function getLookUPResults(jData) {

	var valid = /[^A-Za-z0-9]/g;
	var id = chromo_active.container.replace(valid,'');

	if(jData == null){
		alert("There was a problem dealing with the search results. Sorry about that.");
		return false;
	}
	var equinox = jData.equinox;
	var target = jData.target;
	var coordsys = jData.coordsys;
	var ra = jData.ra;
	var dec = jData.dec;
	var gal = jData.galactic;
	var category = jData.category;
	var service = jData.service;
	var message = jData.message;
	lookup_done = true;
	if(target.suggestion){
		$('#'+id+'_lookupmessages').html("Not found. Did you mean <a href=\"#\" onClick=\"lookUP(id,\'"+target.suggestion+"\');\">"+target.suggestion+"</a>?");
	}else{
		// Remove focus from the input field
		$('#'+id+'_lookupobject').blur();
		if(ra){
			var body = (chromo_active.container) ? chromo_active.container : 'body';

			// Hide the search box
			$(body+' .chromo_search').toggle();
			var str = ra.decimal+','+dec.decimal;
			var coord = Equatorial2Galactic(ra.decimal, dec.decimal);
			var msg = category.avmdesc+" at:<br />"+ra.h+":"+ra.m+":"+ra.s+", "+dec.d+"&deg;:"+dec.m+"':"+dec.s+'" ('+coordsys+' '+equinox+')<br />'+gal.lon.toFixed(2)+'&deg;, '+gal.lat.toFixed(2)+'&deg; (Galactic)<br />More <a href="'+service.href+'">information via '+service.name+'</a>';

			if($(body+' .lookupresults').length > 0){
				// Remove any existing pin
				chromo_active.removePin("lookuppin");
			}else{
				// Build a pin holder for search results
				chromo_active.makePinHolder('lookupresults');
				setOpacity($(body+' .lookupresults'),1.0);
			}
			chromo_active.addPin({loc:' .lookupresults',id:'lookuppin',title:target.name,desc:msg,glon:gal.lon,glat:gal.lat,msg:msg});
			chromo_active.showBalloon(chromo_active.pins[chromo_active.pins.length-1])
			if(jQuery.browser.msie) chromo_active.moveMap(gal.lon,gal.lat,3);
			else chromo_active.moveMap(gal.lon,gal.lat);
			chromo_active.wrapPins();
		}else{
			if(message) $('#'+id+'_lookupmessages').html(message);
			else $('#'+id+'_lookupmessages').html("Not found. Sorry.");
		}
	}
	return false;
}

function areWeWaiting(id){
	var now = new Date();
	if(!lookup_done){
		if(now-lookup_start > 2000) $('#'+id+'_lookupmessages').html("Still searching...");
		if(now-lookup_start > 10000) $('#'+id+'_lookupmessages').html("This is embarrassing. Still waiting...");
		if(now-lookup_start > 20000) $('#'+id+'_lookupmessages').html("Not getting a response. Either you aren't connected to the internet or this object may not be recognised.");
		var chromo_timer = setTimeout("areWeWaiting("+id+")",2000);
	}
}

function lookUP(id,object) {
	if(!object) object = $('#'+id+'_lookupobject').val()
	if(object){
		$('#'+id+'_lookupmessages').html("Searching...");
		lookup_start = new Date();
		lookup_done = false;
		$.ajaxSetup({async:false,'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); } });
		// Get the JSON results file
		$.getJSON('http://www.jodcast.net/lookUP/json/?name='+encodeURL(object)+'&callback=?', getLookUPResults);
		setTimeout("areWeWaiting("+id+")",500);
	}
}

Chromoscope.prototype.addSearch = function(){
	var body = (this.container) ? this.container : 'body';

	$(body+" .chromo_controlkeys").append("<li><strong>s</strong> - "+this.phrasebook.search+"</li>");
	$(body+" .chromo_controlbuttons").append("<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('s')\">Search</a></li>");

	var valid = /[^A-Za-z0-9]/g;
	var id = this.container.replace(valid,'');

	// Create the search box if necessary
	if($(body+" .chromo_search").length == 0){
		$(body).append('<div class="chromo_search chromo_popup">'+this.createClose()+'Find an object with <a href="http://www.jodcast.net/lookUP/">lookUP</a>:<br /><form action="http://www.jodcast.net/lookUP/" method="GET" id="'+id+'_lookUPform" name="'+id+'_lookUPform"><input type="text" name="name" id="'+id+'_lookupobject" onFocus="disableKeys(true);" onBlur="disableKeys(false);" /><input type="submit" name="button" id="'+id+'_lookupsubmit" value="'+this.phrasebook.search+'" /></form><div id="'+id+'_lookupmessages"></div></div>');
	}
	$(body+" .chromo_search").hide()
	$(body+" .chromo_search .chromo_close").bind('click',{id:'.chromo_search',me:this,input:'#'+id+'_lookupobject'}, function(ev){ ev.data.me.toggleByID(ev.data.id); $(ev.data.input).blur(); } );
	$(body+" .chromo_search").css({"width":"250px","z-index":1000});
	$('#'+id+'_lookUPform').submit(function(){
		lookUP(id);
		return false;
	})
	// Append the check for the 's' key
	$(document).keypress(function(e){
		if(!allowKeyPress()) return;
		var code = e.keyCode || e.charCode || e.which || 0;
		if(code < 37 || code > 40){
			var char = String.fromCharCode(code);
			if(char == 's'){
				// Stop other events happening
				e.preventDefault()

				if(chromo_active){
					// Hide message boxes
					$(chromo_active.container+" .chromo_help").hide();
					$(chromo_active.container+" .chromo_message").hide();

					var valid = /[^A-Za-z0-9]/g;
					var id = chromo_active.container.replace(valid,'');

					$(chromo_active.container+" .chromo_search").show();
					chromo_active.centreDiv(".chromo_search");
					$("#"+id+'_lookupmessages').html("");
					if($(chromo_active.container+" .chromo_search").is(':visible')) $("#"+id+'_lookupobject').focus().select();
					else $("#"+id+'_lookupobject').blur();
				}
			}
		}
	});

	if(chromo_active) chromo_active.centreDiv(".chromo_search");
}

function encodeURL(str){
	str = encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').  replace(/\)/g, '%29').replace(/\*/g, '%2A'); 
	str = str.replace(/%0A/g, '\n')
	return str
}