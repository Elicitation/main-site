CorporateUi.loadBundle("c-content",["exports","./chunk-fec612a0.js"],function(e,t){var n=window.CorporateUi.h,r=Object.freeze({scania:":host {\n  display: flex;\n  flex-direction: column;\n  background-color: #fff; }\n"}),o=function(){function e(){this.currentTheme=this.theme||t.store.getState().theme.name}return e.prototype.updateTheme=function(e){this.currentTheme=e},e.prototype.componentWillLoad=function(){var e=this;t.store.subscribe(function(){return e.currentTheme=t.store.getState().theme.name})},e.prototype.render=function(){return[this.currentTheme?n("style",null,r[this.currentTheme]):"",n("slot",null)]},Object.defineProperty(e,"is",{get:function(){return"c-content"},enumerable:!0,configurable:!0}),Object.defineProperty(e,"encapsulation",{get:function(){return"shadow"},enumerable:!0,configurable:!0}),Object.defineProperty(e,"properties",{get:function(){return{currentTheme:{state:!0},router:{type:"Any",attr:"router"},theme:{type:String,attr:"theme",watchCallbacks:["updateTheme"]}}},enumerable:!0,configurable:!0}),Object.defineProperty(e,"style",{get:function(){return":host{display:block;-ms-flex-positive:1;flex-grow:1;-ms-flex-negative:0;flex-shrink:0}"},enumerable:!0,configurable:!0}),e}();e.CContent=o,Object.defineProperty(e,"__esModule",{value:!0})});