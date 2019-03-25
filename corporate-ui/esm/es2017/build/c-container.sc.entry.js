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
    static get style() { return ".sc-c-container-h{display:block}.sc-c-container-h, .sc-c-container-h   *.sc-c-container, .sc-c-container-h   .sc-c-container:after, .sc-c-container-h   .sc-c-container:before{-webkit-box-sizing:border-box;box-sizing:border-box}a.sc-c-container{text-decoration:none}a.sc-c-container:hover{text-decoration:underline}.container.sc-c-container-h{width:100%;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}\@media (min-width:576px){.container.sc-c-container-h{max-width:540px}}\@media (min-width:768px){.container.sc-c-container-h{max-width:720px}}\@media (min-width:992px){.container.sc-c-container-h{max-width:960px}}\@media (min-width:1200px){.container.sc-c-container-h{max-width:1140px}}.container-fluid.sc-c-container-h{width:100%;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}"; }
}

export { Container as CContainer };
