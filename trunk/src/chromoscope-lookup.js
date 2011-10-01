/*
 * Chromoscope LookUP Add-on
 * Written by Stuart Lowe using www.strudel.org.uk/lookUP/
 *
 * Changes in version 1.1 (2011-09-25):
 *   - Now a proper plugin
 */


(function ($) {

	function init(chromo) {

		function getLookUPResults(jData) {

			if(jData == null){
				chromo.message("There was a problem dealing with the search results. Sorry about that.");
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
			chromo.lookup_done = true;
			if(target.suggestion){
				$(chromo.body+' .chromo_search_message').html("Not found. Did you mean <a href=\"#\" class='lookup_suggestion'>"+target.suggestion+"</a>?");
				$(chromo.body+' .chromo_search_message .lookup_suggestion').bind("click",{suggestion:target.suggestion},function(e){
					lookUP(e.data.suggestion);
				});
			}else{
				// Remove focus from the input field
				$('.chromo_search_object').blur();
				if(ra){
					// Hide the search box
					$(chromo.body+' .chromo_search').toggle();
					$(chromo.body+' .chromo_search_message').html('');
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
					group = chromo.addPinGroup({id:'lookupresults',title:'Search results'});

					pid = "lookuppin";
					chromo.removePin(pid);
					chromo.addPin({group:group,id:pid,title:target.name,desc:msg,glon:gal.lon,glat:gal.lat,msg:msg,width:330});

					chromo.moveMap(gal.lon,gal.lat,chromo.zoom,1000);
					chromo.pins[chromo.pins.length-1].showBalloon();
					chromo.wrapPins();
				}else{
					if(message) $(chromo.body+' .chromo_search_message').html(message);
					else $(chromo.body+' .chromo_search_message').html("Not found. Sorry.");
				}
			}
			return false;
		}

		function areWeWaiting(){
			var now = new Date();
			if(!this.lookup_done){
				msg = "";
				var t = now-this.lookup_start;
				if(t > 2000) msg = "Still searching...";
				if(t > 10000) msg = "This is embarrassing. Still waiting...";
				if(t > 20000) msg = "Not getting a response. Either you aren't connected to the internet or this object may not be recognised."
				if(msg) $(this.body+' .chromo_search_message').html(msg);
				if(t < 20000) var chromo_timer = setTimeout($.proxy(areWeWaiting,this),2000);
			}
		}

		function lookUP(object) {
			if(!object) object = $('#'+chromo.lookup_id+'_lookupobject').val()
			if(object){
				$(chromo.body+' .chromo_search_message').html("Searching...");
				// Get the JSON results file
				chromo.lookup_start = new Date();
				chromo.lookup_done = false
				str = object;
				str = encodeURIComponent(str).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').  replace(/\)/g, '%29').replace(/\*/g, '%2A'); 
				str = str.replace(/%0A/g, '\n')

				$.ajax({
					async: true,
					dataType: "jsonp",
					'beforeSend': function(xhr){ if (xhr.overrideMimeType) xhr.overrideMimeType("text/plain"); },
					url:'http://www.strudel.org.uk/lookUP/json/?name='+str+'&callback=?',
					context: chromo,
					success: getLookUPResults
				})
				setTimeout($.proxy(areWeWaiting,chromo),500);
			}
		}

		chromo.showsearch = true;
		chromo.registerSearch({name:'lookUP',desc:'web (lookUP)',fn:function(args){
			lookUP(args.val);
			return false;
		}});
	}


	$.chromoscope.plugins.push({
		init: init,
		name: 'lookup',
		version: '1.1'
	});
})(jQuery);

