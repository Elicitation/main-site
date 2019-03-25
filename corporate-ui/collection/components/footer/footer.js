import { store } from '../../global';
import * as themes from '../../tmp/c-footer';
export class Footer {
    constructor() {
        this.items = [];
        this.currentTheme = this.theme || store.getState().theme.name;
        this.show = false;
        this._items = [];
    }
    setItems(items) {
        this._items = Array.isArray(items) ? items : JSON.parse(items);
    }
    updateTheme(name) {
        this.currentTheme = name;
    }
    componentWillLoad() {
        store.subscribe(() => this.currentTheme = store.getState().theme.name);
        this.setItems(this.items);
    }
    componentDidLoad() {
        const elem = this.el.shadowRoot.querySelector('slot[name=navigation');
        elem.addEventListener('slotchange', e => this.getNavSlotItems(e.target));
        this.getNavSlotItems(elem);
    }
    getNavSlotItems(node) {
        this.itemsSlot = (node.assignedNodes() || node.children || [])[0];
    }
    render() {
        return [
            this.currentTheme ? h("style", null, themes[this.currentTheme]) : '',
            h("nav", { class: 'navbar navbar-expand-lg navbar-default', "data-test-id": 'c-footer' },
                h("strong", { class: 'navbar-brand', "data-test-id": 'c-footer-logo' }),
                h("div", { class: "navigation dropup" },
                    h("div", { class: 'collapse navbar-collapse' + (this.show ? ' show' : '') },
                        h("nav", { class: 'navbar-nav' },
                            this._items.map(item => (h("a", { href: item['location'], class: 'nav-item nav-link' },
                                h("span", null, item['text'])))),
                            h("slot", { name: "items" }))),
                    this.items || this.itemsSlot ?
                        h("button", { class: 'navbar-toggler collapsed btn btn-link dropdown-toggle', type: 'button', onClick: () => this.show = !this.show }, "Elicitation")
                        : ''),
                h("p", { "data-test-id": 'c-footer-copyright' }, "Copyright \u00A9 Elicitation 2019"))
        ];
    }
    static get is() { return "c-footer"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "_items": {
            "state": true
        },
        "currentTheme": {
            "state": true
        },
        "el": {
            "elementRef": true
        },
        "items": {
            "type": "Any",
            "attr": "items",
            "watchCallbacks": ["setItems"]
        },
        "itemsSlot": {
            "state": true
        },
        "show": {
            "state": true
        },
        "theme": {
            "type": String,
            "attr": "theme",
            "watchCallbacks": ["updateTheme"]
        }
    }; }
    static get style() { return "/**style-placeholder:c-footer:**/"; }
}
