
/*!
 * Scania generall browser detection and rejection principels. 
 * The choosen way of detect browsers or features may vary over time, 
 * currently we are using the Bowser 1.3.0 script, inlcuded below.
 */

/*!
 * Bowser - a browser detector
 * https://github.com/ded/bowser
 * MIT License | (c) Dustin Diaz 2015
 */

!function(e,t){typeof module!="undefined"&&module.exports?module.exports=t():typeof define=="function"&&define.amd?define(t):this[e]=t()}("bowser",function(){function t(t){function n(e){var n=t.match(e);return n&&n.length>1&&n[1]||""}function r(e){var n=t.match(e);return n&&n.length>1&&n[2]||""}var i=n(/(ipod|iphone|ipad)/i).toLowerCase(),s=/like android/i.test(t),o=!s&&/android/i.test(t),u=/nexus\s*[0-6]\s*/i.test(t),a=!u&&/nexus\s*[0-9]+/i.test(t),f=/CrOS/.test(t),l=/silk/i.test(t),c=/sailfish/i.test(t),h=/tizen/i.test(t),p=/(web|hpw)os/i.test(t),d=/windows phone/i.test(t),v=!d&&/windows/i.test(t),m=!i&&!l&&/macintosh/i.test(t),g=!o&&!c&&!h&&!p&&/linux/i.test(t),y=n(/edge\/(\d+(\.\d+)?)/i),b=n(/version\/(\d+(\.\d+)?)/i),w=/tablet/i.test(t),E=!w&&/[^-]mobi/i.test(t),S=/xbox/i.test(t),x;/opera|opr|opios/i.test(t)?x={name:"Opera",opera:e,version:b||n(/(?:opera|opr|opios)[\s\/](\d+(\.\d+)?)/i)}:/coast/i.test(t)?x={name:"Opera Coast",coast:e,version:b||n(/(?:coast)[\s\/](\d+(\.\d+)?)/i)}:/yabrowser/i.test(t)?x={name:"Yandex Browser",yandexbrowser:e,version:b||n(/(?:yabrowser)[\s\/](\d+(\.\d+)?)/i)}:/ucbrowser/i.test(t)?x={name:"UC Browser",ucbrowser:e,version:n(/(?:ucbrowser)[\s\/](\d+(?:\.\d+)+)/i)}:/mxios/i.test(t)?x={name:"Maxthon",maxthon:e,version:n(/(?:mxios)[\s\/](\d+(?:\.\d+)+)/i)}:/epiphany/i.test(t)?x={name:"Epiphany",epiphany:e,version:n(/(?:epiphany)[\s\/](\d+(?:\.\d+)+)/i)}:/puffin/i.test(t)?x={name:"Puffin",puffin:e,version:n(/(?:puffin)[\s\/](\d+(?:\.\d+)?)/i)}:/sleipnir/i.test(t)?x={name:"Sleipnir",sleipnir:e,version:n(/(?:sleipnir)[\s\/](\d+(?:\.\d+)+)/i)}:/k-meleon/i.test(t)?x={name:"K-Meleon",kMeleon:e,version:n(/(?:k-meleon)[\s\/](\d+(?:\.\d+)+)/i)}:d?(x={name:"Windows Phone",windowsphone:e},y?(x.msedge=e,x.version=y):(x.msie=e,x.version=n(/iemobile\/(\d+(\.\d+)?)/i))):/msie|trident/i.test(t)?x={name:"Internet Explorer",msie:e,version:n(/(?:msie |rv:)(\d+(\.\d+)?)/i)}:f?x={name:"Chrome",chromeos:e,chromeBook:e,chrome:e,version:n(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)}:/chrome.+? edge/i.test(t)?x={name:"Microsoft Edge",msedge:e,version:y}:/vivaldi/i.test(t)?x={name:"Vivaldi",vivaldi:e,version:n(/vivaldi\/(\d+(\.\d+)?)/i)||b}:c?x={name:"Sailfish",sailfish:e,version:n(/sailfish\s?browser\/(\d+(\.\d+)?)/i)}:/seamonkey\//i.test(t)?x={name:"SeaMonkey",seamonkey:e,version:n(/seamonkey\/(\d+(\.\d+)?)/i)}:/firefox|iceweasel|fxios/i.test(t)?(x={name:"Firefox",firefox:e,version:n(/(?:firefox|iceweasel|fxios)[ \/](\d+(\.\d+)?)/i)},/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(t)&&(x.firefoxos=e)):l?x={name:"Amazon Silk",silk:e,version:n(/silk\/(\d+(\.\d+)?)/i)}:/phantom/i.test(t)?x={name:"PhantomJS",phantom:e,version:n(/phantomjs\/(\d+(\.\d+)?)/i)}:/slimerjs/i.test(t)?x={name:"SlimerJS",slimer:e,version:n(/slimerjs\/(\d+(\.\d+)?)/i)}:/blackberry|\bbb\d+/i.test(t)||/rim\stablet/i.test(t)?x={name:"BlackBerry",blackberry:e,version:b||n(/blackberry[\d]+\/(\d+(\.\d+)?)/i)}:p?(x={name:"WebOS",webos:e,version:b||n(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i)},/touchpad\//i.test(t)&&(x.touchpad=e)):/bada/i.test(t)?x={name:"Bada",bada:e,version:n(/dolfin\/(\d+(\.\d+)?)/i)}:h?x={name:"Tizen",tizen:e,version:n(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i)||b}:/qupzilla/i.test(t)?x={name:"QupZilla",qupzilla:e,version:n(/(?:qupzilla)[\s\/](\d+(?:\.\d+)+)/i)||b}:/chromium/i.test(t)?x={name:"Chromium",chromium:e,version:n(/(?:chromium)[\s\/](\d+(?:\.\d+)?)/i)||b}:/chrome|crios|crmo/i.test(t)?x={name:"Chrome",chrome:e,version:n(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)}:o?x={name:"Android",version:b}:/safari|applewebkit/i.test(t)?(x={name:"Safari",safari:e},b&&(x.version=b)):i?(x={name:i=="iphone"?"iPhone":i=="ipad"?"iPad":"iPod"},b&&(x.version=b)):/googlebot/i.test(t)?x={name:"Googlebot",googlebot:e,version:n(/googlebot\/(\d+(\.\d+))/i)||b}:x={name:n(/^(.*)\/(.*) /),version:r(/^(.*)\/(.*) /)},!x.msedge&&/(apple)?webkit/i.test(t)?(/(apple)?webkit\/537\.36/i.test(t)?(x.name=x.name||"Blink",x.blink=e):(x.name=x.name||"Webkit",x.webkit=e),!x.version&&b&&(x.version=b)):!x.opera&&/gecko\//i.test(t)&&(x.name=x.name||"Gecko",x.gecko=e,x.version=x.version||n(/gecko\/(\d+(\.\d+)?)/i)),!x.msedge&&(o||x.silk)?x.android=e:i?(x[i]=e,x.ios=e):m?x.mac=e:S?x.xbox=e:v?x.windows=e:g&&(x.linux=e);var T="";x.windowsphone?T=n(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i):i?(T=n(/os (\d+([_\s]\d+)*) like mac os x/i),T=T.replace(/[_\s]/g,".")):o?T=n(/android[ \/-](\d+(\.\d+)*)/i):x.webos?T=n(/(?:web|hpw)os\/(\d+(\.\d+)*)/i):x.blackberry?T=n(/rim\stablet\sos\s(\d+(\.\d+)*)/i):x.bada?T=n(/bada\/(\d+(\.\d+)*)/i):x.tizen&&(T=n(/tizen[\/\s](\d+(\.\d+)*)/i)),T&&(x.osversion=T);var N=T.split(".")[0];if(w||a||i=="ipad"||o&&(N==3||N>=4&&!E)||x.silk)x.tablet=e;else if(E||i=="iphone"||i=="ipod"||o||u||x.blackberry||x.webos||x.bada)x.mobile=e;return x.msedge||x.msie&&x.version>=10||x.yandexbrowser&&x.version>=15||x.vivaldi&&x.version>=1||x.chrome&&x.version>=20||x.firefox&&x.version>=20||x.safari&&x.version>=6||x.opera&&x.version>=10||x.ios&&x.osversion&&x.osversion.split(".")[0]>=6||x.blackberry&&x.version>=10.1?x.a=e:x.msie&&x.version<10||x.chrome&&x.version<20||x.firefox&&x.version<20||x.safari&&x.version<6||x.opera&&x.version<10||x.ios&&x.osversion&&x.osversion.split(".")[0]<6?x.c=e:x.x=e,x}var e=!0,n=t(typeof navigator!="undefined"?navigator.userAgent:"");return n.test=function(e){for(var t=0;t<e.length;++t){var r=e[t];if(typeof r=="string"&&r in n)return!0}return!1},n._detect=t,n})


/*!
 * Below, we'll specify the rules for browser rejection.
 */

if (bowser.msie && bowser.version < 11) {
  document.location = 'https://static.scania.com/vendors/components/pure-js/browser-reject/1.0.0/outdated-browser.html'
}
if (bowser.chrome && bowser.version < 49 && !bowser.samsungBrowser) {
  document.location = 'https://static.scania.com/vendors/components/pure-js/browser-reject/1.0.0/outdated-browser.html'
}
if (bowser.safari && bowser.version < 8) {
  document.location = 'https://static.scania.com/vendors/components/pure-js/browser-reject/1.0.0/outdated-browser.html'
}
if (bowser.firefox && bowser.version <= 40 && !(bowser.tablet || bowser.mobile)) {
  document.location = 'https://static.scania.com/vendors/components/pure-js/browser-reject/1.0.0/outdated-browser.html'
}
if (bowser.opera && bowser.version < 48) {
  document.location = 'https://static.scania.com/vendors/components/pure-js/browser-reject/1.0.0/outdated-browser.html'
}