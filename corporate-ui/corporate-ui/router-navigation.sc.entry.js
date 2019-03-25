const t=window.CorporateUi.h;class r{constructor(){this.primaryItems=[],this._primaryItems=[]}componentWillLoad(){this._primaryItems=Array.isArray(this.primaryItems)?this.primaryItems:JSON.parse(this.primaryItems)}componentWillUpdate(){this._primaryItems=Array.isArray(this.primaryItems)?this.primaryItems:JSON.parse(this.primaryItems)}render(){return t("c-navigation",null,this._primaryItems.map(r=>t("stencil-route-link",{url:r.location,slot:"primary-items"},r.text)))}static get is(){return"router-navigation"}static get encapsulation(){return"shadow"}static get properties(){return{primaryItems:{type:"Any",attr:"primary-items"}}}static get style(){return".navbar.sc-router-navigation{position:relative;padding:.5rem 1rem}.navbar.sc-router-navigation, .navbar.sc-router-navigation > .container.sc-router-navigation, .navbar.sc-router-navigation > .container-fluid.sc-router-navigation{display:-ms-flexbox;display:flex;-ms-flex-wrap:wrap;flex-wrap:wrap;-ms-flex-align:center;align-items:center;-ms-flex-pack:justify;justify-content:space-between}.navbar-brand.sc-router-navigation{display:inline-block;padding-top:.3125rem;padding-bottom:.3125rem;margin-right:1rem;font-size:1.25rem;line-height:inherit;white-space:nowrap}.navbar-brand.sc-router-navigation:focus, .navbar-brand.sc-router-navigation:hover{text-decoration:none}.navbar-nav.sc-router-navigation{display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column;padding-left:0;margin-bottom:0;list-style:none}.navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{padding-right:0;padding-left:0}.navbar-nav.sc-router-navigation   .dropdown-menu.sc-router-navigation{position:static;float:none}.navbar-text.sc-router-navigation{display:inline-block;padding-top:.5rem;padding-bottom:.5rem}.navbar-collapse.sc-router-navigation{-ms-flex-preferred-size:100%;flex-basis:100%;-ms-flex-positive:1;flex-grow:1;-ms-flex-align:center;align-items:center}.navbar-toggler.sc-router-navigation{padding:.25rem .75rem;font-size:1.25rem;line-height:1;background-color:transparent;border:1px solid transparent;border-radius:.25rem}.navbar-toggler.sc-router-navigation:focus, .navbar-toggler.sc-router-navigation:hover{text-decoration:none}.navbar-toggler-icon.sc-router-navigation{display:inline-block;width:1.5em;height:1.5em;vertical-align:middle;content:\"\";background:no-repeat 50%;background-size:100% 100%}\@media (max-width:575.98px){.navbar-expand-sm.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-sm.sc-router-navigation > .container-fluid.sc-router-navigation{padding-right:0;padding-left:0}}\@media (min-width:576px){.navbar-expand-sm.sc-router-navigation{-ms-flex-flow:row nowrap;flex-flow:row nowrap;-ms-flex-pack:start;justify-content:flex-start}.navbar-expand-sm.sc-router-navigation   .navbar-nav.sc-router-navigation{-ms-flex-direction:row;flex-direction:row}.navbar-expand-sm.sc-router-navigation   .navbar-nav.sc-router-navigation   .dropdown-menu.sc-router-navigation{position:absolute}.navbar-expand-sm.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{padding-right:.5rem;padding-left:.5rem}.navbar-expand-sm.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-sm.sc-router-navigation > .container-fluid.sc-router-navigation{-ms-flex-wrap:nowrap;flex-wrap:nowrap}.navbar-expand-sm.sc-router-navigation   .navbar-collapse.sc-router-navigation{display:-ms-flexbox!important;display:flex!important;-ms-flex-preferred-size:auto;flex-basis:auto}.navbar-expand-sm.sc-router-navigation   .navbar-toggler.sc-router-navigation{display:none}}\@media (max-width:767.98px){.navbar-expand-md.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-md.sc-router-navigation > .container-fluid.sc-router-navigation{padding-right:0;padding-left:0}}\@media (min-width:768px){.navbar-expand-md.sc-router-navigation{-ms-flex-flow:row nowrap;flex-flow:row nowrap;-ms-flex-pack:start;justify-content:flex-start}.navbar-expand-md.sc-router-navigation   .navbar-nav.sc-router-navigation{-ms-flex-direction:row;flex-direction:row}.navbar-expand-md.sc-router-navigation   .navbar-nav.sc-router-navigation   .dropdown-menu.sc-router-navigation{position:absolute}.navbar-expand-md.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{padding-right:.5rem;padding-left:.5rem}.navbar-expand-md.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-md.sc-router-navigation > .container-fluid.sc-router-navigation{-ms-flex-wrap:nowrap;flex-wrap:nowrap}.navbar-expand-md.sc-router-navigation   .navbar-collapse.sc-router-navigation{display:-ms-flexbox!important;display:flex!important;-ms-flex-preferred-size:auto;flex-basis:auto}.navbar-expand-md.sc-router-navigation   .navbar-toggler.sc-router-navigation{display:none}}\@media (max-width:991.98px){.navbar-expand-lg.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-lg.sc-router-navigation > .container-fluid.sc-router-navigation{padding-right:0;padding-left:0}}\@media (min-width:992px){.navbar-expand-lg.sc-router-navigation{-ms-flex-flow:row nowrap;flex-flow:row nowrap;-ms-flex-pack:start;justify-content:flex-start}.navbar-expand-lg.sc-router-navigation   .navbar-nav.sc-router-navigation{-ms-flex-direction:row;flex-direction:row}.navbar-expand-lg.sc-router-navigation   .navbar-nav.sc-router-navigation   .dropdown-menu.sc-router-navigation{position:absolute}.navbar-expand-lg.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{padding-right:.5rem;padding-left:.5rem}.navbar-expand-lg.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-lg.sc-router-navigation > .container-fluid.sc-router-navigation{-ms-flex-wrap:nowrap;flex-wrap:nowrap}.navbar-expand-lg.sc-router-navigation   .navbar-collapse.sc-router-navigation{display:-ms-flexbox!important;display:flex!important;-ms-flex-preferred-size:auto;flex-basis:auto}.navbar-expand-lg.sc-router-navigation   .navbar-toggler.sc-router-navigation{display:none}}\@media (max-width:1199.98px){.navbar-expand-xl.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-xl.sc-router-navigation > .container-fluid.sc-router-navigation{padding-right:0;padding-left:0}}\@media (min-width:1200px){.navbar-expand-xl.sc-router-navigation{-ms-flex-flow:row nowrap;flex-flow:row nowrap;-ms-flex-pack:start;justify-content:flex-start}.navbar-expand-xl.sc-router-navigation   .navbar-nav.sc-router-navigation{-ms-flex-direction:row;flex-direction:row}.navbar-expand-xl.sc-router-navigation   .navbar-nav.sc-router-navigation   .dropdown-menu.sc-router-navigation{position:absolute}.navbar-expand-xl.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{padding-right:.5rem;padding-left:.5rem}.navbar-expand-xl.sc-router-navigation > .container.sc-router-navigation, .navbar-expand-xl.sc-router-navigation > .container-fluid.sc-router-navigation{-ms-flex-wrap:nowrap;flex-wrap:nowrap}.navbar-expand-xl.sc-router-navigation   .navbar-collapse.sc-router-navigation{display:-ms-flexbox!important;display:flex!important;-ms-flex-preferred-size:auto;flex-basis:auto}.navbar-expand-xl.sc-router-navigation   .navbar-toggler.sc-router-navigation{display:none}}.navbar-expand.sc-router-navigation{-ms-flex-flow:row nowrap;flex-flow:row nowrap;-ms-flex-pack:start;justify-content:flex-start}.navbar-expand.sc-router-navigation > .container.sc-router-navigation, .navbar-expand.sc-router-navigation > .container-fluid.sc-router-navigation{padding-right:0;padding-left:0}.navbar-expand.sc-router-navigation   .navbar-nav.sc-router-navigation{-ms-flex-direction:row;flex-direction:row}.navbar-expand.sc-router-navigation   .navbar-nav.sc-router-navigation   .dropdown-menu.sc-router-navigation{position:absolute}.navbar-expand.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{padding-right:.5rem;padding-left:.5rem}.navbar-expand.sc-router-navigation > .container.sc-router-navigation, .navbar-expand.sc-router-navigation > .container-fluid.sc-router-navigation{-ms-flex-wrap:nowrap;flex-wrap:nowrap}.navbar-expand.sc-router-navigation   .navbar-collapse.sc-router-navigation{display:-ms-flexbox!important;display:flex!important;-ms-flex-preferred-size:auto;flex-basis:auto}.navbar-expand.sc-router-navigation   .navbar-toggler.sc-router-navigation{display:none}.navbar-light.sc-router-navigation   .navbar-brand.sc-router-navigation, .navbar-light.sc-router-navigation   .navbar-brand.sc-router-navigation:focus, .navbar-light.sc-router-navigation   .navbar-brand.sc-router-navigation:hover{color:rgba(0,0,0,.9)}.navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{color:rgba(0,0,0,.5)}.navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation:focus, .navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation:hover{color:rgba(0,0,0,.7)}.navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.disabled.sc-router-navigation{color:rgba(0,0,0,.3)}.navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .active.sc-router-navigation > .nav-link.sc-router-navigation, .navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.active.sc-router-navigation, .navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.show.sc-router-navigation, .navbar-light.sc-router-navigation   .navbar-nav.sc-router-navigation   .show.sc-router-navigation > .nav-link.sc-router-navigation{color:rgba(0,0,0,.9)}.navbar-light.sc-router-navigation   .navbar-toggler.sc-router-navigation{color:rgba(0,0,0,.5);border-color:rgba(0,0,0,.1)}.navbar-light.sc-router-navigation   .navbar-toggler-icon.sc-router-navigation{background-image:url(\"data:image/svg+xml,%3csvg viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3e%3cpath stroke='rgba(0, 0, 0, 0.5)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e\")}.navbar-light.sc-router-navigation   .navbar-text.sc-router-navigation{color:rgba(0,0,0,.5)}.navbar-light.sc-router-navigation   .navbar-text.sc-router-navigation   a.sc-router-navigation, .navbar-light.sc-router-navigation   .navbar-text.sc-router-navigation   a.sc-router-navigation:focus, .navbar-light.sc-router-navigation   .navbar-text.sc-router-navigation   a.sc-router-navigation:hover{color:rgba(0,0,0,.9)}.navbar-dark.sc-router-navigation   .navbar-brand.sc-router-navigation, .navbar-dark.sc-router-navigation   .navbar-brand.sc-router-navigation:focus, .navbar-dark.sc-router-navigation   .navbar-brand.sc-router-navigation:hover{color:#fff}.navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation{color:hsla(0,0%,100%,.5)}.navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation:focus, .navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.sc-router-navigation:hover{color:hsla(0,0%,100%,.75)}.navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.disabled.sc-router-navigation{color:hsla(0,0%,100%,.25)}.navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .active.sc-router-navigation > .nav-link.sc-router-navigation, .navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.active.sc-router-navigation, .navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .nav-link.show.sc-router-navigation, .navbar-dark.sc-router-navigation   .navbar-nav.sc-router-navigation   .show.sc-router-navigation > .nav-link.sc-router-navigation{color:#fff}.navbar-dark.sc-router-navigation   .navbar-toggler.sc-router-navigation{color:hsla(0,0%,100%,.5);border-color:hsla(0,0%,100%,.1)}.navbar-dark.sc-router-navigation   .navbar-toggler-icon.sc-router-navigation{background-image:url(\"data:image/svg+xml,%3csvg viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3e%3cpath stroke='rgba(255, 255, 255, 0.5)' stroke-width='2' stroke-linecap='round' stroke-miterlimit='10' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e\")}.navbar-dark.sc-router-navigation   .navbar-text.sc-router-navigation{color:hsla(0,0%,100%,.5)}.navbar-dark.sc-router-navigation   .navbar-text.sc-router-navigation   a.sc-router-navigation, .navbar-dark.sc-router-navigation   .navbar-text.sc-router-navigation   a.sc-router-navigation:focus, .navbar-dark.sc-router-navigation   .navbar-text.sc-router-navigation   a.sc-router-navigation:hover{color:#fff}.nav.sc-router-navigation{display:-ms-flexbox;display:flex;-ms-flex-wrap:wrap;flex-wrap:wrap;padding-left:0;margin-bottom:0;list-style:none}.nav-link.sc-router-navigation{display:block;padding:.5rem 1rem}.nav-link.sc-router-navigation:focus, .nav-link.sc-router-navigation:hover{text-decoration:none}.nav-link.disabled.sc-router-navigation{color:#6c757d;pointer-events:none;cursor:default}.nav-tabs.sc-router-navigation{border-bottom:1px solid #dee2e6}.nav-tabs.sc-router-navigation   .nav-item.sc-router-navigation{margin-bottom:-1px}.nav-tabs.sc-router-navigation   .nav-link.sc-router-navigation{border:1px solid transparent;border-top-left-radius:.25rem;border-top-right-radius:.25rem}.nav-tabs.sc-router-navigation   .nav-link.sc-router-navigation:focus, .nav-tabs.sc-router-navigation   .nav-link.sc-router-navigation:hover{border-color:#e9ecef #e9ecef #dee2e6}.nav-tabs.sc-router-navigation   .nav-link.disabled.sc-router-navigation{color:#6c757d;background-color:transparent;border-color:transparent}.nav-tabs.sc-router-navigation   .nav-item.show.sc-router-navigation   .nav-link.sc-router-navigation, .nav-tabs.sc-router-navigation   .nav-link.active.sc-router-navigation{color:#495057;background-color:#fff;border-color:#dee2e6 #dee2e6 #fff}.nav-tabs.sc-router-navigation   .dropdown-menu.sc-router-navigation{margin-top:-1px;border-top-left-radius:0;border-top-right-radius:0}.nav-pills.sc-router-navigation   .nav-link.sc-router-navigation{border-radius:.25rem}.nav-pills.sc-router-navigation   .nav-link.active.sc-router-navigation, .nav-pills.sc-router-navigation   .show.sc-router-navigation > .nav-link.sc-router-navigation{color:#fff;background-color:#007bff}.nav-fill.sc-router-navigation   .nav-item.sc-router-navigation{-ms-flex:1 1 auto;flex:1 1 auto;text-align:center}.nav-justified.sc-router-navigation   .nav-item.sc-router-navigation{-ms-flex-preferred-size:0;flex-basis:0;-ms-flex-positive:1;flex-grow:1;text-align:center}.tab-content.sc-router-navigation > .tab-pane.sc-router-navigation{display:none}.tab-content.sc-router-navigation > .active.sc-router-navigation{display:block}.dropdown.sc-router-navigation, .dropleft.sc-router-navigation, .dropright.sc-router-navigation, .dropup.sc-router-navigation{position:relative}.dropdown-toggle.sc-router-navigation{white-space:nowrap}.dropdown-toggle.sc-router-navigation:after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";border-top:.3em solid;border-right:.3em solid transparent;border-bottom:0;border-left:.3em solid transparent}.dropdown-toggle.sc-router-navigation:empty:after{margin-left:0}.dropdown-menu.sc-router-navigation{position:absolute;top:100%;left:0;z-index:1000;display:none;float:left;min-width:10rem;padding:.5rem 0;margin:.125rem 0 0;font-size:1rem;color:#212529;text-align:left;list-style:none;background-color:#fff;background-clip:padding-box;border:1px solid rgba(0,0,0,.15);border-radius:.25rem}.dropdown-menu-left.sc-router-navigation{right:auto;left:0}.dropdown-menu-right.sc-router-navigation{right:0;left:auto}\@media (min-width:576px){.dropdown-menu-sm-left.sc-router-navigation{right:auto;left:0}.dropdown-menu-sm-right.sc-router-navigation{right:0;left:auto}}\@media (min-width:768px){.dropdown-menu-md-left.sc-router-navigation{right:auto;left:0}.dropdown-menu-md-right.sc-router-navigation{right:0;left:auto}}\@media (min-width:992px){.dropdown-menu-lg-left.sc-router-navigation{right:auto;left:0}.dropdown-menu-lg-right.sc-router-navigation{right:0;left:auto}}\@media (min-width:1200px){.dropdown-menu-xl-left.sc-router-navigation{right:auto;left:0}.dropdown-menu-xl-right.sc-router-navigation{right:0;left:auto}}.dropup.sc-router-navigation   .dropdown-menu.sc-router-navigation{top:auto;bottom:100%;margin-top:0;margin-bottom:.125rem}.dropup.sc-router-navigation   .dropdown-toggle.sc-router-navigation:after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";border-top:0;border-right:.3em solid transparent;border-bottom:.3em solid;border-left:.3em solid transparent}.dropup.sc-router-navigation   .dropdown-toggle.sc-router-navigation:empty:after{margin-left:0}.dropright.sc-router-navigation   .dropdown-menu.sc-router-navigation{top:0;right:auto;left:100%;margin-top:0;margin-left:.125rem}.dropright.sc-router-navigation   .dropdown-toggle.sc-router-navigation:after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";border-top:.3em solid transparent;border-right:0;border-bottom:.3em solid transparent;border-left:.3em solid}.dropright.sc-router-navigation   .dropdown-toggle.sc-router-navigation:empty:after{margin-left:0}.dropright.sc-router-navigation   .dropdown-toggle.sc-router-navigation:after{vertical-align:0}.dropleft.sc-router-navigation   .dropdown-menu.sc-router-navigation{top:0;right:100%;left:auto;margin-top:0;margin-right:.125rem}.dropleft.sc-router-navigation   .dropdown-toggle.sc-router-navigation:after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";display:none}.dropleft.sc-router-navigation   .dropdown-toggle.sc-router-navigation:before{display:inline-block;margin-right:.255em;vertical-align:.255em;content:\"\";border-top:.3em solid transparent;border-right:.3em solid;border-bottom:.3em solid transparent}.dropleft.sc-router-navigation   .dropdown-toggle.sc-router-navigation:empty:after{margin-left:0}.dropleft.sc-router-navigation   .dropdown-toggle.sc-router-navigation:before{vertical-align:0}.dropdown-menu[x-placement^=bottom].sc-router-navigation, .dropdown-menu[x-placement^=left].sc-router-navigation, .dropdown-menu[x-placement^=right].sc-router-navigation, .dropdown-menu[x-placement^=top].sc-router-navigation{right:auto;bottom:auto}.dropdown-divider.sc-router-navigation{height:0;margin:.5rem 0;overflow:hidden;border-top:1px solid #e9ecef}.dropdown-item.sc-router-navigation{display:block;width:100%;padding:.25rem 1.5rem;clear:both;font-weight:400;color:#212529;text-align:inherit;white-space:nowrap;background-color:transparent;border:0}.dropdown-item.sc-router-navigation:focus, .dropdown-item.sc-router-navigation:hover{color:#16181b;text-decoration:none;background-color:#f8f9fa}.dropdown-item.active.sc-router-navigation, .dropdown-item.sc-router-navigation:active{color:#fff;text-decoration:none;background-color:#007bff}.dropdown-item.disabled.sc-router-navigation, .dropdown-item.sc-router-navigation:disabled{color:#6c757d;pointer-events:none;background-color:transparent}.dropdown-menu.show.sc-router-navigation{display:block}.dropdown-header.sc-router-navigation{display:block;padding:.5rem 1.5rem;margin-bottom:0;font-size:.875rem;color:#6c757d;white-space:nowrap}.dropdown-item-text.sc-router-navigation{display:block;padding:.25rem 1.5rem;color:#212529}"}}export{r as RouterNavigation};