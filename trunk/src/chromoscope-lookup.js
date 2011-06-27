/*
 * Chromoscope LookUP Add-on
 * Written by Stuart Lowe using www.strudel.org.uk/lookUP/
 *
 * You need to add this Javascript file and then call addSearch() e.g.
 *
 * chromo.addSearch();
 */

Chromoscope.prototype.addSearch = function(){
	var body = (this.container) ? this.container : 'body';
	var valid = /[^A-Za-z0-9]/g;
	this.lookup_id = this.container.replace(valid,'');

	// Create the search box if necessary
	if($(body+" .chromo_search").length == 0) $(body).append('<div class="chromo_search chromo_popup">'+this.createClose()+'Find an object with <a href="http://www.strudel.org.uk/lookUP/">lookUP</a>:<br /><form action="http://www.strudel.org.uk/lookUP/" method="GET" id="'+this.lookup_id+'_lookUPform" name="'+this.lookup_id+'_lookUPform"><input type="text" name="name" id="'+this.lookup_id+'_lookupobject" onFocus="disableKeys(true);" onBlur="disableKeys(false);" /><input type="submit" name="button" id="'+this.lookup_id+'_lookupsubmit" value="'+this.phrasebook.search+'" /></form><div class="lookupmessages"></div></div>');
	$(body+" .chromo_search").hide()
	$(body+" .chromo_controlkeys").append("<li><strong>s</strong> - "+this.phrasebook.search+"</li>");
	$(body+" .chromo_controlbuttons").append("<li><a href=\"#\" onClick=\"javascript:simulateKeyPress('s')\">Search</a></li>");
	this.registerKey('s',function(){
		this.showintro = false;	// Disable the intro just in case the user is really quick
		var valid = /[^A-Za-z0-9]/g;
		var id = this.container.replace(valid,'');

		// Hide message boxes
		$(this.container+" .chromo_help").hide();
		$(this.container+" .chromo_message").hide();

		$(this.container+" .chromo_search").show();
		this.centreDiv(".chromo_search");
		$(this.container+' .lookupmessages').html("");
		if($(this.container+" .chromo_search").is(':visible')) $("#"+id+'_lookupobject').focus().select();
		else $("#"+id+'_lookupobject').blur();
	})

	$(body+" .chromo_search .chromo_close").bind('click',{id:'.chromo_search',me:this,input:'#'+this.lookup_id+'_lookupobject'}, function(ev){ ev.data.me.toggleByID(ev.data.id); $(ev.data.input).blur(); } );
	$(body+" .chromo_search").css({"width":"250px","z-index":1000});
	$('#'+this.lookup_id+'_lookUPform').submit({chromo:this},function(e){
		e.data.chromo.lookUP();
		return false;
	})
	if(this) this.centreDiv(".chromo_search");
}

Chromoscope.prototype.getLookUPResults = function(jData) {

	var valid = /[^A-Za-z0-9]/g;
	var body = (this.container) ? this.container : 'body';

	if(jData == null){
		this.message("There was a problem dealing with the search results. Sorry about that.");
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
	this.lookup_done = true;
	if(target.suggestion){
		$(body+' .lookupmessages').html("Not found. Did you mean <a href=\"#\" onClick=\"chromo_active.lookUP(\'"+target.suggestion+"\');\">"+target.suggestion+"</a>?");
	}else{
		// Remove focus from the input field
		$('#'+this.lookup_id+'_lookupobject').blur();
		if(ra){
			// Hide the search box
			$(body+' .chromo_search').toggle();
			var str = ra.decimal+','+dec.decimal;
			var coord = Equatorial2Galactic(ra.decimal, dec.decimal);
			var msg = category.avmdesc+" at:<br />"+ra.h+":"+ra.m+":"+ra.s+", "+dec.d+"&deg;:"+dec.m+"':"+dec.s+'" ('+coordsys+' '+equinox+')<br />'+gal.lon.toFixed(2)+'&deg;, '+gal.lat.toFixed(2)+'&deg; (Galactic)<br />More <a href="'+service.href+'">information via '+service.name+'</a>';


			if($(body+' .lookupresults').length > 0){
				// Remove any existing pin
				this.removePin("lookuppin");
			}else{
				// Build a pin holder for search results
				holder = this.makePinHolder();
				setOpacity($(body+" ."+holder),1.0);
			}
			this.addPin({loc:' .'+holder,id:'lookuppin',title:target.name,desc:msg,glon:gal.lon,glat:gal.lat,msg:msg,width:330});
			this.moveMap(gal.lon,gal.lat,this.zoom,1000);
			this.showBalloon(this.pins[this.pins.length-1])
			this.wrapPins();
		}else{
			if(message) $(body+' .lookupmessages').html(message);
			else $(body+' .lookupmessages').html("Not found. Sorry.");
		}
	}
	return false;
}

Chromoscope.prototype.areWeWaiting = function(){
	var now = new Date();
	if(!this.lookup_done){
		msg = "";
		var t = now-this.lookup_start;
		if(t > 2000) msg = "Still searching...";
		if(t > 10000) msg = "This is embarrassing. Still waiting...";
		if(t > 20000) msg = "Not getting a response. Either you aren't connected to the internet or this object may not be recognised."
		if(msg) $(this.container+' .lookupmessages').html(msg);
		if(t < 20000) var chromo_timer = setTimeout($.proxy(this.areWeWaiting,this),2000);
	}
}

Chromoscope.prototype.lookUP = function(object) {
	if(!object) object = $('#'+this.lookup_id+'_lookupobject').val()
	if(object){
		$(this.container+' .lookupmessages').html("Searching...");
		// Get the JSON results file
		this.lookup_start = new Date();
		this.lookup_done = false
		$.ajax({
			async: false,
			dataType: "jsonp",
			'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); },
			url:'http://www.strudel.org.uk/lookUP/json/?name='+encodeURL(object)+'&callback=?',
			context: this,
			success: this.getLookUPResults
		})
		setTimeout($.proxy(this.areWeWaiting,this),500);
	}
}

function encodeURL(str){
	str = encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').  replace(/\)/g, '%29').replace(/\*/g, '%2A'); 
	str = str.replace(/%0A/g, '\n')
	return str
}