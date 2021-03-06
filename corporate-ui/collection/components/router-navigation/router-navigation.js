export class RouterNavigation {
    constructor() {
        this.primaryItems = [];
        this._primaryItems = [];
    }
    componentWillLoad() {
        this._primaryItems = Array.isArray(this.primaryItems) ? this.primaryItems : JSON.parse(this.primaryItems);
    }
    componentWillUpdate() {
        this._primaryItems = Array.isArray(this.primaryItems) ? this.primaryItems : JSON.parse(this.primaryItems);
    }
    render() {
        return (h("c-navigation", null, this._primaryItems.map(item => h("stencil-route-link", { url: item['location'], slot: 'primary-items' }, item['text']))));
    }
    static get is() { return "router-navigation"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "primaryItems": {
            "type": "Any",
            "attr": "primary-items"
        }
    }; }
    static get style() { return "/**style-placeholder:router-navigation:**/"; }
}
