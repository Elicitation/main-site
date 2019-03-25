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
    static get style() { return ".sc-c-row-h{display:block}.sc-c-row-h, .sc-c-row-h   *.sc-c-row, .sc-c-row-h   .sc-c-row:after, .sc-c-row-h   .sc-c-row:before{-webkit-box-sizing:border-box;box-sizing:border-box}a.sc-c-row{text-decoration:none}a.sc-c-row:hover{text-decoration:underline}.row.sc-c-row-h{display:-ms-flexbox;display:flex;-ms-flex-wrap:wrap;flex-wrap:wrap;margin-right:-15px;margin-left:-15px}.no-gutters.sc-c-row-h{margin-right:0;margin-left:0}"; }
}

export { Row as CRow };
