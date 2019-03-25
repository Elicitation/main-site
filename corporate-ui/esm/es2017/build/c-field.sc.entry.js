import { h } from '../corporate-ui.core.js';

class Field {
    constructor() {
        this.type = 'text';
        this.value = '';
    }
    render() {
        if (this.type === 'text' || this.type === 'password') {
            return h("input", { type: this.type, value: this.value });
        }
        else {
            h("textarea", null, this.value);
        }
    }
    static get is() { return "c-field"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "type": {
            "type": String,
            "attr": "type"
        },
        "value": {
            "type": String,
            "attr": "value"
        }
    }; }
    static get style() { return ""; }
}

export { Field as CField };
