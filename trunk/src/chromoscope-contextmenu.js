/*
 * Chromoscope context menu plugin
 * Written by Stuart Lowe to add a context-sensitive menu
 *
 * Changes in version 1.2 (2012-05-10):
 *   - Added support for right to left languages
 *
 * Changes in version 1.1 (2011-10-23):
 *   - Removed need for global variable
 *   - Can attach functions to menu items
 *   - Improved context menu styling
 *
 * Changes in version 1.0 (2011-09-25):
 *   - Now a separate plugin
 */

(function ($) {

	function init(chromo) {

		// Build up the context-sensitive menu links
		// Arguments are:
		// 	args.l = Galactic longitude (decimal degrees)
		// 	args.b = Galactic latitude (decimal degrees)
		// 	args.z = zoom level
		// 	args.ra = Right Ascension (decimal hours)
		// 	args.dec = Declination (decimal degrees)
		chromo.bind("contextmenu",function(args){ return { text:'<a href="#">'+(this.phrasebook.centre)+'</a>','fn':function(){ args.chromo.moveMap(args.l,args.b,args.z); } } });
		chromo.bind("contextmenu",function(args){ return '<hr />'; });
		chromo.bind("contextmenu",function(args){ return '<a href="http://server1.wikisky.org/v2?ra='+args.ra+'&de='+args.dec+'&zoom='+(args.z-2)+'&img_source=DSS2">'+this.phrasebook.wikisky+'</a>'; });
		chromo.bind("contextmenu",function(args){ return '<a href="http://www.worldwidetelescope.org/wwtweb/goto.aspx?object=ViewShortcut&ra='+(args.ra)+'&dec='+args.dec+'&zoom='+(0.3*60*360/Math.pow(2,args.z))+'">'+this.phrasebook.wwt+'</a>'; });
		chromo.bind("contextmenu",function(args){ return '<hr />'; });
		chromo.bind("contextmenu",function(args){ return '<a href="http://simbad.u-strasbg.fr/simbad/sim-coo?Coord='+args.l.toFixed(4)+'+'+args.b.toFixed(4)+'&CooFrame=Gal&CooEpoch=2000&CooEqui=2000&Radius=10">'+this.phrasebook.nearby+' (Simbad)</a>'; });
		chromo.bind("contextmenu",function(args){ return '<a href="http://nedwww.ipac.caltech.edu/cgi-bin/nph-objsearch?search_type=Near+Position+Search&in_csys=Galactic&in_equinox=J2000.0&lon='+args.l+'&lat='+args.b+'&radius=10&hconst=73&omegam=0.27&omegav=0.73&corr_z=1&z_constraint=Unconstrained&z_value1=&z_value2=&z_unit=z&ot_include=ANY&nmp_op=ANY&out_csys=Equatorial&out_equinox=J2000.0&obj_sort=Distance+to+search+center&of=pre_text&zv_breaker=30000.0&list_limit=20&img_stamp=YES">'+this.phrasebook.nearby+' (NED)'; });
		chromo.bind("load",function(){ buildContextMenu(this); });
	}	

	// Construct the context-sensitive menu
	function buildContextMenu(chromo){
		$(chromo.body+' .chromo_outerDiv').bind("contextmenu",{el:chromo},function(e){
			var chromo = e.data.el;
			if(chromo.mouseevents){
				var offset = 2;
				var offx = ($(chromo.container).length > 0) ? $(chromo.container).offset().left : 0;
				var offy = ($(chromo.container).length > 0) ? $(chromo.container).offset().top : 0;
				var newtop = (e.clientY)-offy;
				var newleft = (e.clientX)-offx;
				var coords = chromo.getCoords(newleft,newtop);
				var radec = Galactic2Equatorial(coords.l,coords.b);
				if($(chromo.body+" .chromo_context").length == 0) $(chromo.body).append('<div class="chromo_context" style="color:black;background-color:#f3f3f3;position:absolute;padding:2px;z-index:1001;cursor:default;border-radius:4px;padding:4px 0px 4px 0px;box-shadow:2px 2px 8px #333;width:230px"></div>');

				if(chromo.events['contextmenu']){
					$(chromo.body+" .chromo_context").html('<ul style="margin:0px;padding:0px;list-style:none;display:block;font-family:Lucida Grande,Arial,san-serif;font-size:10pt;"></ul>').bind('mouseleave', {el:chromo,body:chromo.body}, function(e){ $(e.data.body+' .chromo_context').hide(); e.data.el.dragging = false; }).attr('dir',(chromo.phrasebook.alignment=="right" ? 'rtl' : 'ltr'));
					var o = chromo.trigger("contextmenu",{chromo:chromo,l:coords.l,b:coords.b,z:chromo.zoom,ra:radec.ra,dec:radec.dec});
					var li;
					for(i = 0 ; i < o.length ; i++){
						fn = "";
						// Check if this context menu item has a function attached
						if(typeof o[i]=="object"){
							fn = o[i].fn;
							o[i] = o[i].text;
						}
						$(chromo.body+" .chromo_context ul").append("<li class=\"contextmenu-"+i+"\">"+o[i]+"</li>");
						li = $(chromo.body+" .chromo_context ul li.contextmenu-"+i);
						// Execute any attached functions
						if(typeof fn==="function") li.bind('click',fn);
						li.bind('click',{el:chromo,body:chromo.body},function(e){ $(e.data.body+' .chromo_context').hide(); e.data.el.dragging = false; });
					}

					$(chromo.body+" .chromo_context li a").css({padding:'2px '+(chromo.phrasebook.alignment=="right" ? '20' : '2')+'px 2px '+(chromo.phrasebook.alignment=="right" ? '2' : '20')+'px',display:'block',textDecoration:'none',color:'black'});
					$(chromo.body+" .chromo_context li a").hover( function(){
						$(this).css({'background-color':'#225ff6','background-image': '-webkit-gradient(linear,left top,left bottom,color-stop(0.41, rgb(99,136,249)),color-stop(0.71, rgb(34,94,246)));','color':'white'});
					},function(){
						$(this).css({'background-color':'transparent','color':'black'});
					});
					var w = $(chromo.body+" .chromo_context").outerWidth();
					var h = $(chromo.body+" .chromo_context").outerHeight();
					if(newleft+w > chromo.wide) newleft -= w-2*offset;
					if(newtop+h > chromo.tall) newtop -= h-(2*offset);
					$(chromo.body+" .chromo_context").css({left:(newleft-offset)+'px',top:(newtop-offset)+'px'}).show();
					$(chromo.body+" .chromo_context hr").css({'margin':'4px 0px 4px 0px','border':0,'background-color':'#ccc','height':'2px','border-bottom':'1px solid #fff'}).show();
					chromo.dragging = false;
					if(chromo.clickTimeout) clearTimeout(chromo.clickTimeout);
					return false;
				}
			}
		});
	}

	$.chromoscope.plugins.push({
		init: init,
		name: 'contextmenu',
		version: '1.1'
	});
})(jQuery);

