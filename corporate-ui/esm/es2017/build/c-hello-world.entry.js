import { h } from '../corporate-ui.core.js';

class HelloWorld {
    constructor() {
        this.text = 'hello-World';
    }
    render() {
        return (h("div", null,
            h("h2", null,
                this.text,
                " component")));
    }
    static get is() { return "c-hello-world"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "text": {
            "type": "Any",
            "attr": "text"
        }
    }; }
    static get style() { return ".fade{-webkit-transition:opacity .15s linear;transition:opacity .15s linear}\@media (prefers-reduced-motion:reduce){.fade{-webkit-transition:none;transition:none}}.fade:not(.show){opacity:0}.collapse:not(.show){display:none}.collapsing{position:relative;height:0;overflow:hidden;-webkit-transition:height .35s ease;transition:height .35s ease}\@media (prefers-reduced-motion:reduce){.collapsing{-webkit-transition:none;transition:none}}:host{display:block;color:red;font-size:20px;background-color:#000;overflow:hidden}"; }
}

export { HelloWorld as CHelloWorld };
