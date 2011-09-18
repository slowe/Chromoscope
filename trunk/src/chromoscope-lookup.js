/*
 * Chromoscope LookUP Add-on
 * Written by Stuart Lowe using www.strudel.org.uk/lookUP/
 *
 * You need to add this Javascript file and then call addSearch() e.g.
 *
 * chromo.addSearch();
 *
 */

Chromoscope.prototype.addSearch = function(){
	this.showsearch = true;

	this.registerSearch({name:'lookUP',desc:'web (lookUP)',fn:function(args){
		this.lookUP(args.val);
		return false;
	}});
}

Chromoscope.prototype.getLookUPResults = function(jData) {

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
		$(this.body+' .chromo_search_message').html("Not found. Did you mean <a href=\"#\" onClick=\"chromo_active.lookUP(\'"+target.suggestion+"\');\">"+target.suggestion+"</a>?");
	}else{
		// Remove focus from the input field
		$('.chromo_search_object').blur();
		if(ra){
			// Hide the search box
			$(this.body+' .chromo_search').toggle();
			$(this.body+' .chromo_search_message').html('');
			var str = ra.decimal+','+dec.decimal;
			var coord = Equatorial2Galactic(ra.decimal, dec.decimal);
			var msg = category.avmdesc+" at:<br />"+ra.h+":"+ra.m+":"+ra.s+", "+dec.d+"&deg;:"+dec.m+"':"+dec.s+'" ('+coordsys+' '+equinox+')<br />'+gal.lon.toFixed(2)+'&deg;, '+gal.lat.toFixed(2)+'&deg; (Galactic)<br />More <a href="'+service.href+'">information via '+service.name+'</a>';
			var extra = "";
			avm = category.avmcode;
			if(avm.match(/(^|;)3.1.8/)) extra = "<a href='http://supernova.galaxyzoo.org/'>Hunt for supernovae</a> with Galaxy Zoo";
			else if(avm.match(/(^|\;)3\.1\.9\.1/)) extra = "Find out <a href='http://www.jb.man.ac.uk/research/pulsar/Education/index.html'>about pulsars</a> and even <a href='http://www.jb.man.ac.uk/research/pulsar/Education/Sounds/sounds.html'>listen to them</a>.";
			else if(avm.match(/(^|\;)3\.2\.1/)) extra = "Find out <a href='http://www.aavso.org/variables-what-are-they-and-why-observe-them'>about variable stars</a> and <a href='http://www.aavso.org/observers'>help the AAVSO observe them</a>.";
			else if(avm.match(/(^|\;)4\.1\.2/) || avm.match(/(^|\;)4\.1\.1/)) extra = "Help to identify star forming regions with <a href='http://www.milkywayproject.org/needyou'>The Milky Way Project</a>";
			else if(avm.match(/(^|\;)5\.1\.7/)) extra = "Help to improve simulations of merging galaxies with <a href='http://mergers.galaxyzoo.org/'>Galaxy Zoo Mergers</a>";
			else if(avm.match(/(^|\;)5\.1\./)) extra = "Help classify galaxies with <a href='http://www.galaxyzoo.org/'>Galaxy Zoo: Hubble</a>";

			if(extra) msg += "<br /><br />Explore: "+extra


			// Build a pin holder for search results
			group = this.addPinGroup({id:'lookupresults',title:'Search results'});

			pid = "lookuppin";
			this.removePin(pid);
			this.addPin({group:group,id:pid,title:target.name,desc:msg,glon:gal.lon,glat:gal.lat,msg:msg,width:330});

			this.moveMap(gal.lon,gal.lat,this.zoom,1000);
			this.showBalloon(this.pins[this.pins.length-1]);
			this.wrapPins();
		}else{
			if(message) $(this.body+' .chromo_search_message').html(message);
			else $(this.body+' .chromo_search_message').html("Not found. Sorry.");
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
		if(msg) $(this.body+' .chromo_search_message').html(msg);
		if(t < 20000) var chromo_timer = setTimeout($.proxy(this.areWeWaiting,this),2000);
	}
}

Chromoscope.prototype.lookUP = function(object) {
	if(!object) object = $('#'+this.lookup_id+'_lookupobject').val()
	if(object){
		$(this.body+' .chromo_search_message').html("Searching...");
		// Get the JSON results file
		this.lookup_start = new Date();
		this.lookup_done = false
		str = object;
		str = encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').  replace(/\)/g, '%29').replace(/\*/g, '%2A'); 
		str = str.replace(/%0A/g, '\n')

		$.ajax({
			async: false,
			dataType: "jsonp",
			'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); },
			url:'http://www.strudel.org.uk/lookUP/json/?name='+str+'&callback=?',
			context: this,
			success: this.getLookUPResults
		})
		setTimeout($.proxy(this.areWeWaiting,this),500);
	}
}


