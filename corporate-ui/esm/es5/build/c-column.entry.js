import{h}from"../corporate-ui.core.js";var Column=function(){function e(){}return e.prototype.hostData=function(){var e=this,t={class:{col:!0}};return["sm","md","lg","xl"].map(function(n){var r=e[n];if(r){try{r=JSON.parse(r)}catch(e){r=r}"number"==typeof r?t.class["col-"+n+(r?"-"+r:"")]=r:Object.keys(r).map(function(e){t.class[("size"===e?"col":e)+"-"+n+"-"+r[e]]=e})}}),t},e.prototype.render=function(){return h("slot",null)},Object.defineProperty(e,"is",{get:function(){return"c-column"},enumerable:!0,configurable:!0}),Object.defineProperty(e,"encapsulation",{get:function(){return"shadow"},enumerable:!0,configurable:!0}),Object.defineProperty(e,"properties",{get:function(){return{lg:{type:"Any",attr:"lg"},md:{type:"Any",attr:"md"},sm:{type:"Any",attr:"sm"},xl:{type:"Any",attr:"xl"}}},enumerable:!0,configurable:!0}),Object.defineProperty(e,"style",{get:function(){return":host,:host *,:host :after,:host :before{-webkit-box-sizing:border-box;box-sizing:border-box}a{text-decoration:none}a:hover{text-decoration:underline}:host{display:block;padding-bottom:15px}:host-context(.no-gutters) :host(.col),:host-context(.no-gutters) :host([class*=col-]){padding-right:0;padding-left:0}:host-context(.row-eq-height){display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column}:host-context(.row-eq-height) ::slotted(*){-ms-flex-positive:1;flex-grow:1}:host(.col),:host(.col-1),:host(.col-2),:host(.col-3),:host(.col-4),:host(.col-5),:host(.col-6),:host(.col-7),:host(.col-8),:host(.col-9),:host(.col-10),:host(.col-11),:host(.col-12),:host(.col-auto),:host(.col-lg),:host(.col-lg-1),:host(.col-lg-2),:host(.col-lg-3),:host(.col-lg-4),:host(.col-lg-5),:host(.col-lg-6),:host(.col-lg-7),:host(.col-lg-8),:host(.col-lg-9),:host(.col-lg-10),:host(.col-lg-11),:host(.col-lg-12),:host(.col-lg-auto),:host(.col-md),:host(.col-md-1),:host(.col-md-2),:host(.col-md-3),:host(.col-md-4),:host(.col-md-5),:host(.col-md-6),:host(.col-md-7),:host(.col-md-8),:host(.col-md-9),:host(.col-md-10),:host(.col-md-11),:host(.col-md-12),:host(.col-md-auto),:host(.col-sm),:host(.col-sm-1),:host(.col-sm-2),:host(.col-sm-3),:host(.col-sm-4),:host(.col-sm-5),:host(.col-sm-6),:host(.col-sm-7),:host(.col-sm-8),:host(.col-sm-9),:host(.col-sm-10),:host(.col-sm-11),:host(.col-sm-12),:host(.col-sm-auto),:host(.col-xl),:host(.col-xl-1),:host(.col-xl-2),:host(.col-xl-3),:host(.col-xl-4),:host(.col-xl-5),:host(.col-xl-6),:host(.col-xl-7),:host(.col-xl-8),:host(.col-xl-9),:host(.col-xl-10),:host(.col-xl-11),:host(.col-xl-12),:host(.col-xl-auto){position:relative;width:100%;padding-right:15px;padding-left:15px}:host(.col){-ms-flex-preferred-size:0;flex-basis:0;-ms-flex-positive:1;flex-grow:1;max-width:100%}:host(.col-auto){-ms-flex:0 0 auto;flex:0 0 auto;width:auto;max-width:100%}:host(.col-1){-ms-flex:0 0 8.33333%;flex:0 0 8.33333%;max-width:8.33333%}:host(.col-2){-ms-flex:0 0 16.66667%;flex:0 0 16.66667%;max-width:16.66667%}:host(.col-3){-ms-flex:0 0 25%;flex:0 0 25%;max-width:25%}:host(.col-4){-ms-flex:0 0 33.33333%;flex:0 0 33.33333%;max-width:33.33333%}:host(.col-5){-ms-flex:0 0 41.66667%;flex:0 0 41.66667%;max-width:41.66667%}:host(.col-6){-ms-flex:0 0 50%;flex:0 0 50%;max-width:50%}:host(.col-7){-ms-flex:0 0 58.33333%;flex:0 0 58.33333%;max-width:58.33333%}:host(.col-8){-ms-flex:0 0 66.66667%;flex:0 0 66.66667%;max-width:66.66667%}:host(.col-9){-ms-flex:0 0 75%;flex:0 0 75%;max-width:75%}:host(.col-10){-ms-flex:0 0 83.33333%;flex:0 0 83.33333%;max-width:83.33333%}:host(.col-11){-ms-flex:0 0 91.66667%;flex:0 0 91.66667%;max-width:91.66667%}:host(.col-12){-ms-flex:0 0 100%;flex:0 0 100%;max-width:100%}:host(.order-first){-ms-flex-order:-1;order:-1}:host(.order-last){-ms-flex-order:13;order:13}:host(.order-0){-ms-flex-order:0;order:0}:host(.order-1){-ms-flex-order:1;order:1}:host(.order-2){-ms-flex-order:2;order:2}:host(.order-3){-ms-flex-order:3;order:3}:host(.order-4){-ms-flex-order:4;order:4}:host(.order-5){-ms-flex-order:5;order:5}:host(.order-6){-ms-flex-order:6;order:6}:host(.order-7){-ms-flex-order:7;order:7}:host(.order-8){-ms-flex-order:8;order:8}:host(.order-9){-ms-flex-order:9;order:9}:host(.order-10){-ms-flex-order:10;order:10}:host(.order-11){-ms-flex-order:11;order:11}:host(.order-12){-ms-flex-order:12;order:12}:host(.offset-1){margin-left:8.33333%}:host(.offset-2){margin-left:16.66667%}:host(.offset-3){margin-left:25%}:host(.offset-4){margin-left:33.33333%}:host(.offset-5){margin-left:41.66667%}:host(.offset-6){margin-left:50%}:host(.offset-7){margin-left:58.33333%}:host(.offset-8){margin-left:66.66667%}:host(.offset-9){margin-left:75%}:host(.offset-10){margin-left:83.33333%}:host(.offset-11){margin-left:91.66667%}\@media (min-width:576px){:host(.col-sm){-ms-flex-preferred-size:0;flex-basis:0;-ms-flex-positive:1;flex-grow:1;max-width:100%}:host(.col-sm-auto){-ms-flex:0 0 auto;flex:0 0 auto;width:auto;max-width:100%}:host(.col-sm-1){-ms-flex:0 0 8.33333%;flex:0 0 8.33333%;max-width:8.33333%}:host(.col-sm-2){-ms-flex:0 0 16.66667%;flex:0 0 16.66667%;max-width:16.66667%}:host(.col-sm-3){-ms-flex:0 0 25%;flex:0 0 25%;max-width:25%}:host(.col-sm-4){-ms-flex:0 0 33.33333%;flex:0 0 33.33333%;max-width:33.33333%}:host(.col-sm-5){-ms-flex:0 0 41.66667%;flex:0 0 41.66667%;max-width:41.66667%}:host(.col-sm-6){-ms-flex:0 0 50%;flex:0 0 50%;max-width:50%}:host(.col-sm-7){-ms-flex:0 0 58.33333%;flex:0 0 58.33333%;max-width:58.33333%}:host(.col-sm-8){-ms-flex:0 0 66.66667%;flex:0 0 66.66667%;max-width:66.66667%}:host(.col-sm-9){-ms-flex:0 0 75%;flex:0 0 75%;max-width:75%}:host(.col-sm-10){-ms-flex:0 0 83.33333%;flex:0 0 83.33333%;max-width:83.33333%}:host(.col-sm-11){-ms-flex:0 0 91.66667%;flex:0 0 91.66667%;max-width:91.66667%}:host(.col-sm-12){-ms-flex:0 0 100%;flex:0 0 100%;max-width:100%}:host(.order-sm-first){-ms-flex-order:-1;order:-1}:host(.order-sm-last){-ms-flex-order:13;order:13}:host(.order-sm-0){-ms-flex-order:0;order:0}:host(.order-sm-1){-ms-flex-order:1;order:1}:host(.order-sm-2){-ms-flex-order:2;order:2}:host(.order-sm-3){-ms-flex-order:3;order:3}:host(.order-sm-4){-ms-flex-order:4;order:4}:host(.order-sm-5){-ms-flex-order:5;order:5}:host(.order-sm-6){-ms-flex-order:6;order:6}:host(.order-sm-7){-ms-flex-order:7;order:7}:host(.order-sm-8){-ms-flex-order:8;order:8}:host(.order-sm-9){-ms-flex-order:9;order:9}:host(.order-sm-10){-ms-flex-order:10;order:10}:host(.order-sm-11){-ms-flex-order:11;order:11}:host(.order-sm-12){-ms-flex-order:12;order:12}:host(.offset-sm-0){margin-left:0}:host(.offset-sm-1){margin-left:8.33333%}:host(.offset-sm-2){margin-left:16.66667%}:host(.offset-sm-3){margin-left:25%}:host(.offset-sm-4){margin-left:33.33333%}:host(.offset-sm-5){margin-left:41.66667%}:host(.offset-sm-6){margin-left:50%}:host(.offset-sm-7){margin-left:58.33333%}:host(.offset-sm-8){margin-left:66.66667%}:host(.offset-sm-9){margin-left:75%}:host(.offset-sm-10){margin-left:83.33333%}:host(.offset-sm-11){margin-left:91.66667%}}\@media (min-width:768px){:host(.col-md){-ms-flex-preferred-size:0;flex-basis:0;-ms-flex-positive:1;flex-grow:1;max-width:100%}:host(.col-md-auto){-ms-flex:0 0 auto;flex:0 0 auto;width:auto;max-width:100%}:host(.col-md-1){-ms-flex:0 0 8.33333%;flex:0 0 8.33333%;max-width:8.33333%}:host(.col-md-2){-ms-flex:0 0 16.66667%;flex:0 0 16.66667%;max-width:16.66667%}:host(.col-md-3){-ms-flex:0 0 25%;flex:0 0 25%;max-width:25%}:host(.col-md-4){-ms-flex:0 0 33.33333%;flex:0 0 33.33333%;max-width:33.33333%}:host(.col-md-5){-ms-flex:0 0 41.66667%;flex:0 0 41.66667%;max-width:41.66667%}:host(.col-md-6){-ms-flex:0 0 50%;flex:0 0 50%;max-width:50%}:host(.col-md-7){-ms-flex:0 0 58.33333%;flex:0 0 58.33333%;max-width:58.33333%}:host(.col-md-8){-ms-flex:0 0 66.66667%;flex:0 0 66.66667%;max-width:66.66667%}:host(.col-md-9){-ms-flex:0 0 75%;flex:0 0 75%;max-width:75%}:host(.col-md-10){-ms-flex:0 0 83.33333%;flex:0 0 83.33333%;max-width:83.33333%}:host(.col-md-11){-ms-flex:0 0 91.66667%;flex:0 0 91.66667%;max-width:91.66667%}:host(.col-md-12){-ms-flex:0 0 100%;flex:0 0 100%;max-width:100%}:host(.order-md-first){-ms-flex-order:-1;order:-1}:host(.order-md-last){-ms-flex-order:13;order:13}:host(.order-md-0){-ms-flex-order:0;order:0}:host(.order-md-1){-ms-flex-order:1;order:1}:host(.order-md-2){-ms-flex-order:2;order:2}:host(.order-md-3){-ms-flex-order:3;order:3}:host(.order-md-4){-ms-flex-order:4;order:4}:host(.order-md-5){-ms-flex-order:5;order:5}:host(.order-md-6){-ms-flex-order:6;order:6}:host(.order-md-7){-ms-flex-order:7;order:7}:host(.order-md-8){-ms-flex-order:8;order:8}:host(.order-md-9){-ms-flex-order:9;order:9}:host(.order-md-10){-ms-flex-order:10;order:10}:host(.order-md-11){-ms-flex-order:11;order:11}:host(.order-md-12){-ms-flex-order:12;order:12}:host(.offset-md-0){margin-left:0}:host(.offset-md-1){margin-left:8.33333%}:host(.offset-md-2){margin-left:16.66667%}:host(.offset-md-3){margin-left:25%}:host(.offset-md-4){margin-left:33.33333%}:host(.offset-md-5){margin-left:41.66667%}:host(.offset-md-6){margin-left:50%}:host(.offset-md-7){margin-left:58.33333%}:host(.offset-md-8){margin-left:66.66667%}:host(.offset-md-9){margin-left:75%}:host(.offset-md-10){margin-left:83.33333%}:host(.offset-md-11){margin-left:91.66667%}}\@media (min-width:992px){:host(.col-lg){-ms-flex-preferred-size:0;flex-basis:0;-ms-flex-positive:1;flex-grow:1;max-width:100%}:host(.col-lg-auto){-ms-flex:0 0 auto;flex:0 0 auto;width:auto;max-width:100%}:host(.col-lg-1){-ms-flex:0 0 8.33333%;flex:0 0 8.33333%;max-width:8.33333%}:host(.col-lg-2){-ms-flex:0 0 16.66667%;flex:0 0 16.66667%;max-width:16.66667%}:host(.col-lg-3){-ms-flex:0 0 25%;flex:0 0 25%;max-width:25%}:host(.col-lg-4){-ms-flex:0 0 33.33333%;flex:0 0 33.33333%;max-width:33.33333%}:host(.col-lg-5){-ms-flex:0 0 41.66667%;flex:0 0 41.66667%;max-width:41.66667%}:host(.col-lg-6){-ms-flex:0 0 50%;flex:0 0 50%;max-width:50%}:host(.col-lg-7){-ms-flex:0 0 58.33333%;flex:0 0 58.33333%;max-width:58.33333%}:host(.col-lg-8){-ms-flex:0 0 66.66667%;flex:0 0 66.66667%;max-width:66.66667%}:host(.col-lg-9){-ms-flex:0 0 75%;flex:0 0 75%;max-width:75%}:host(.col-lg-10){-ms-flex:0 0 83.33333%;flex:0 0 83.33333%;max-width:83.33333%}:host(.col-lg-11){-ms-flex:0 0 91.66667%;flex:0 0 91.66667%;max-width:91.66667%}:host(.col-lg-12){-ms-flex:0 0 100%;flex:0 0 100%;max-width:100%}:host(.order-lg-first){-ms-flex-order:-1;order:-1}:host(.order-lg-last){-ms-flex-order:13;order:13}:host(.order-lg-0){-ms-flex-order:0;order:0}:host(.order-lg-1){-ms-flex-order:1;order:1}:host(.order-lg-2){-ms-flex-order:2;order:2}:host(.order-lg-3){-ms-flex-order:3;order:3}:host(.order-lg-4){-ms-flex-order:4;order:4}:host(.order-lg-5){-ms-flex-order:5;order:5}:host(.order-lg-6){-ms-flex-order:6;order:6}:host(.order-lg-7){-ms-flex-order:7;order:7}:host(.order-lg-8){-ms-flex-order:8;order:8}:host(.order-lg-9){-ms-flex-order:9;order:9}:host(.order-lg-10){-ms-flex-order:10;order:10}:host(.order-lg-11){-ms-flex-order:11;order:11}:host(.order-lg-12){-ms-flex-order:12;order:12}:host(.offset-lg-0){margin-left:0}:host(.offset-lg-1){margin-left:8.33333%}:host(.offset-lg-2){margin-left:16.66667%}:host(.offset-lg-3){margin-left:25%}:host(.offset-lg-4){margin-left:33.33333%}:host(.offset-lg-5){margin-left:41.66667%}:host(.offset-lg-6){margin-left:50%}:host(.offset-lg-7){margin-left:58.33333%}:host(.offset-lg-8){margin-left:66.66667%}:host(.offset-lg-9){margin-left:75%}:host(.offset-lg-10){margin-left:83.33333%}:host(.offset-lg-11){margin-left:91.66667%}}\@media (min-width:1200px){:host(.col-xl){-ms-flex-preferred-size:0;flex-basis:0;-ms-flex-positive:1;flex-grow:1;max-width:100%}:host(.col-xl-auto){-ms-flex:0 0 auto;flex:0 0 auto;width:auto;max-width:100%}:host(.col-xl-1){-ms-flex:0 0 8.33333%;flex:0 0 8.33333%;max-width:8.33333%}:host(.col-xl-2){-ms-flex:0 0 16.66667%;flex:0 0 16.66667%;max-width:16.66667%}:host(.col-xl-3){-ms-flex:0 0 25%;flex:0 0 25%;max-width:25%}:host(.col-xl-4){-ms-flex:0 0 33.33333%;flex:0 0 33.33333%;max-width:33.33333%}:host(.col-xl-5){-ms-flex:0 0 41.66667%;flex:0 0 41.66667%;max-width:41.66667%}:host(.col-xl-6){-ms-flex:0 0 50%;flex:0 0 50%;max-width:50%}:host(.col-xl-7){-ms-flex:0 0 58.33333%;flex:0 0 58.33333%;max-width:58.33333%}:host(.col-xl-8){-ms-flex:0 0 66.66667%;flex:0 0 66.66667%;max-width:66.66667%}:host(.col-xl-9){-ms-flex:0 0 75%;flex:0 0 75%;max-width:75%}:host(.col-xl-10){-ms-flex:0 0 83.33333%;flex:0 0 83.33333%;max-width:83.33333%}:host(.col-xl-11){-ms-flex:0 0 91.66667%;flex:0 0 91.66667%;max-width:91.66667%}:host(.col-xl-12){-ms-flex:0 0 100%;flex:0 0 100%;max-width:100%}:host(.order-xl-first){-ms-flex-order:-1;order:-1}:host(.order-xl-last){-ms-flex-order:13;order:13}:host(.order-xl-0){-ms-flex-order:0;order:0}:host(.order-xl-1){-ms-flex-order:1;order:1}:host(.order-xl-2){-ms-flex-order:2;order:2}:host(.order-xl-3){-ms-flex-order:3;order:3}:host(.order-xl-4){-ms-flex-order:4;order:4}:host(.order-xl-5){-ms-flex-order:5;order:5}:host(.order-xl-6){-ms-flex-order:6;order:6}:host(.order-xl-7){-ms-flex-order:7;order:7}:host(.order-xl-8){-ms-flex-order:8;order:8}:host(.order-xl-9){-ms-flex-order:9;order:9}:host(.order-xl-10){-ms-flex-order:10;order:10}:host(.order-xl-11){-ms-flex-order:11;order:11}:host(.order-xl-12){-ms-flex-order:12;order:12}:host(.offset-xl-0){margin-left:0}:host(.offset-xl-1){margin-left:8.33333%}:host(.offset-xl-2){margin-left:16.66667%}:host(.offset-xl-3){margin-left:25%}:host(.offset-xl-4){margin-left:33.33333%}:host(.offset-xl-5){margin-left:41.66667%}:host(.offset-xl-6){margin-left:50%}:host(.offset-xl-7){margin-left:58.33333%}:host(.offset-xl-8){margin-left:66.66667%}:host(.offset-xl-9){margin-left:75%}:host(.offset-xl-10){margin-left:83.33333%}:host(.offset-xl-11){margin-left:91.66667%}}"},enumerable:!0,configurable:!0}),e}();export{Column as CColumn};