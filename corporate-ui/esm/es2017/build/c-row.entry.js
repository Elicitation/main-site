import { h } from '../corporate-ui.core.js';

class Row {
    hostData() {
        return {
            class: { row: true }
        };
    }
    render() {
        return h("slot", null);
    }
    static get is() { return "c-row"; }
    static get encapsulation() { return "shadow"; }
    static get style() { return ":host{display:block}:host,:host *,:host :after,:host :before{-webkit-box-sizing:border-box;box-sizing:border-box}a{text-decoration:none}a:hover{text-decoration:underline}:host(.row){display:-ms-flexbox;display:flex;-ms-flex-wrap:wrap;flex-wrap:wrap;margin-right:-15px;margin-left:-15px}:host(.no-gutters){margin-right:0;margin-left:0}"; }
}

export { Row as CRow };
