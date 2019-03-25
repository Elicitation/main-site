export class Container {
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
    static get style() { return "/**style-placeholder:c-container:**/"; }
}
