Introduction
============

[Chromoscope](http://www.chromoscope.net/) is an easy tool that anyone can use to explore and understand the sky at multiple wavelengths. It was originally written for the [Planck/Herschel Royal Society Summer Exhibition 2009](http://royalsociety.org/From-the-oldest-light-to-the-youngest-stars-the-Herschel-and-Planck-Missions/). Developed as an educational resource. This Javascript web-application will run locally or can be run on a web server. The only part that requires an internet connection is the search tool which makes use of [LookUP](http://www.strudel.org.uk/lookUP/).
 
View the Universe
-----------------

Chromoscope has been created using public-domain datasets from a number of all-sky astronomy projects. It lets you easily move around the sky and fade between wavelengths using a simple user-interface to illustrate the similarities and differences between what is visible at each wavelength.

There are currently eight included:

* Gamma ray ([Fermi](http://fermi.gsfc.nasa.gov/)),
* X-ray ([ROSAT](http://www.mpe.mpg.de/xray/wave/rosat/mission/rosat/index.php)),
* Optical ([DSS](http://stdatu.stsci.edu/dss/)/[Wikisky](http://www.wikisky.org/)), 
* H-alpha ([WHAM](http://www.astro.wisc.edu/wham/description.html), [SHASSA](http://amundsen.swarthmore.edu/), [VTSS](http://www.phys.vt.edu/~halpha/), [Finkbeiner](http://www.cfa.harvard.edu/~dfinkbei/)), 
* Near Infrared ([WISE](http://wise.ssl.berkely.edu/IRASdocs/iras.html)),
* Far Infrared ([IRAS](http://irsa.ipac.caltech.edu/IRASdocs/iras.html)),
* Microwave ([Planck](http://www.esa.int/planck)), 
* Radio ([Haslam](http://lambda.gsfc.nasa.gov/product/foreground/haslam_408.cfm)).

You can [download these tile-sets for offline use](http://blog.chromoscope.net/download/).

Control the sky
---------------

To move the map around, simply 'grab' it with the cursor and drag around the screen. You can double-click (or use the plus and minus keys on your keyboard or a scroll wheel) to zoom in and out. A simple slider (or a set of keyboard shortcuts) allows you to fade gradually along the spectrum and to see structures and features change as they go. A set of labels can be toggled on and off (with the 'L' key) to guide people around the sky and, if an Internet connection is present, users can search for named objects and jump right to them.

No installation needed
----------------------

A standard, modern, web browser is all that you need to use Chromoscope so there is no need to install any extra software, plugins or learn a new interface (you will have to [download the tiles to use it offline](http://blog.chromoscope.net/download/)). Being platform independent means that whether you use Windows, Mac or Linux, it should still be accessible.

Note that the Chrome browser has extra security when running locally which will stop Chromoscope seeing KML and the language JS files even if they are in the same directory. If you want to use these features you should start Chrome with the option "--allow-file-access-from-files".

Multi-lingual
-------------

Thanks to the efforts of wonderful volunteers, Chromoscope's interface is available in a variety of languages including: [Afrikaans](http://www.chromoscope.net/?lang=af) [Cymraeg](http://www.chromoscope.net/?lang=cy), [Dansk](http://www.chromoscope.net/?lang=dk), [Deutsch](http://www.chromoscope.net/?lang=de), [Espa&#241;ol](http://www.chromoscope.net/?lang=es), [Fran&#231;ais](http://chromoscope.net/?lang=fr), [Gaeilge](http://chromoscope.net/?lang=ga), [&#1506;&#1489;&#1512;&#1497;&#1514;](http://chromoscope.net/?lang=he), [&#2350;&#2366;&#2344;&#2325; &#2361;&#2367;&#2344;&#2381;&#2342;&#2368;](http://chromoscope.net/?lang=hi), [Italiano](http://chromoscope.net/?lang=it), [&#26085;&#26412;&#35486;](http://chromoscope.net/?lang=ja), [Polski](http://chromoscope.net/?lang=pl), [Portugu&#234;s](http://chromoscope.net/?lang=pt), [svenska](http://chromoscope.net/?lang=sv), [T&#252;rk&#231;e](http://chromoscope.net/?lang=tr) and [&#20013;&#25991;](http://chromoscope.net/?lang=zh). You can add [more translations](http://chromoscope.net/dev/translate.html).

Adapt it
--------

Chromoscope does not need a web connection to operate (other than for the search function) and it can be downloaded to your computer for use elsewhere. You can download the basic code (pretty compact) and then select which wavelength collections you want. The entire package, including images for all wavelengths and zoom levels, currently stands at just over half a gigabyte. This makes Chromoscope suitable for running from a USB memory stick or for downloading from a server. It can easily be copied around and is an open-source project, meaning that none of the code is hidden and users are welcome to modify and adapt it for their purposes. There is [documentation for Developers](http://chromoscope.net/dev/reference.html) to help you customize it. Examples of Chromoscope being used elsewhere:
* The [Online Showcase of Herschel Images](http://oshi.esa.int/)
* [UK Herschel Outreach Website](http://herschel.cf.ac.uk/chromoscope/results)
* The [H2O southern Galactic Plane Survey](http://www.ast.leeds.ac.uk/hops/public/index.php)
* [Planckoscope](http://planck.cf.ac.uk/planckoscope)

Credits
-------

Chromoscope was created by Stuart Lowe, Chris North (Cardiff University) and Robert Simpson (Oxford University). [Translations](http://chromoscope.net/dev/translate.html) are provided by a variety of people; credits are in the translation files.
