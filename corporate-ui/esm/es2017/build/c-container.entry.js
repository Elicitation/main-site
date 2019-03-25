import { h } from '../corporate-ui.core.js';

class Container {
    hostData() {
        const data = { class: {} };
        data.class['container' + (this.type ? '-' + this.type : '')] = true;
        return data;
    }
    render() {
        return h("slot", null);
    }
    static get is() { return "c-container"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "type": {
            "type": String,
            "attr": "type"
        }
    }; }
    static get style() { return ":host{display:block}:host,:host *,:host :after,:host :before{-webkit-box-sizing:border-box;box-sizing:border-box}a{text-decoration:none}a:hover{text-decoration:underline}:host(.container){width:100%;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}\@media (min-width:576px){:host(.container){max-width:540px}}\@media (min-width:768px){:host(.container){max-width:720px}}\@media (min-width:992px){:host(.container){max-width:960px}}\@media (min-width:1200px){:host(.container){max-width:1140px}}:host(.container-fluid){width:100%;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}"; }
}

export { Container as CContainer };
