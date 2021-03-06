import { store, actions } from '../../global';
import * as themes from '../../tmp/c-header';
export class Header {
    constructor() {
        this.siteUrl = '/';
        this.items = [];
        this.currentTheme = this.theme || store.getState().theme.name;
        this.navigationOpen = store.getState().navigation.open;
        this._items = [];
    }
    setItems(items) {
        this._items = Array.isArray(items) ? items : JSON.parse(items);
    }
    updateTheme(name) {
        this.currentTheme = name;
    }
    toggleNavigation(open) {
        store.dispatch({ type: actions.TOGGLE_NAVIGATION, open });
    }
    componentWillLoad() {
        store.subscribe(() => {
            this.currentTheme = store.getState().theme.name;
            this.navigationOpen = store.getState().navigation.open;
        });
        this.setItems(this.items);
    }
    componentDidLoad() {
        const elem = this.el.shadowRoot.querySelector('slot[name=navigation');
        elem.addEventListener('slotchange', e => this.getNavSlotItems(e.target));
        this.getNavSlotItems(elem);
    }
    getNavSlotItems(node) {
        this.navigationSlot = (node.assignedNodes() || node.children || [])[0];
    }
    render() {
        return [
            this.currentTheme ? h("style", null, themes[this.currentTheme]) : '',
            h("nav", { class: 'navbar navbar-expand-lg navbar-default' },
                this.primaryItems || this.secondaryItems || this.navigationSlot ?
                    h("button", { class: 'navbar-toggler collapsed', type: 'button', onClick: () => this.toggleNavigation(!this.navigationOpen) },
                        h("span", { class: 'navbar-toggler-icon' }))
                    : '',
                h("a", { href: this.siteUrl, class: 'navbar-brand collapse' }),
                h("strong", { class: 'navbar-title' }, this.siteName),
                h("div", { class: 'collapse navbar-collapse' },
                    h("nav", { class: 'navbar-nav ml-auto' },
                        this._items.map(item => (h("a", { href: item['location'], class: 'nav-item nav-link' },
                            h("span", null, item['text'])))),
                        h("slot", { name: "items" })))),
            h("a", { href: this.siteUrl, class: 'navbar-symbol' }),
            h("slot", { name: "navigation" }),
            (this.primaryItems || this.secondaryItems
                ? h("c-navigation", { "primary-items": this.primaryItems, "secondary-items": this.secondaryItems })
                : '')
        ];
    }
    static get is() { return "c-header"; }
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
        "navigationOpen": {
            "state": true
        },
        "navigationSlot": {
            "state": true
        },
        "primaryItems": {
            "type": "Any",
            "attr": "primary-items"
        },
        "secondaryItems": {
            "type": "Any",
            "attr": "secondary-items"
        },
        "siteName": {
            "type": String,
            "attr": "site-name"
        },
        "siteUrl": {
            "type": String,
            "attr": "site-url"
        },
        "theme": {
            "type": String,
            "attr": "theme",
            "watchCallbacks": ["updateTheme"]
        }
    }; }
    static get style() { return "/**style-placeholder:c-header:**/"; }
}
