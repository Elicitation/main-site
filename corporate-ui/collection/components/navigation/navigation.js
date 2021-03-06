import { store } from '../../global';
import * as themes from '../../tmp/c-navigation';
export class Navigation {
    constructor() {
        this.primaryItems = [];
        this.secondaryItems = [];
        this.currentTheme = this.theme || store.getState().theme.name;
        this._primaryItems = [];
        this._secondaryItems = [];
    }
    setItems(items, type) {
        this['_' + type] = Array.isArray(items) ? items : JSON.parse(items);
    }
    updateTheme(name) {
        this.currentTheme = name;
    }
    componentWillLoad() {
        store.subscribe(() => {
            this.currentTheme = store.getState().theme.name;
            this.navigationOpen = store.getState().navigation.open;
        });
        this.setItems(this.primaryItems, 'primaryItems');
        this.setItems(this.secondaryItems, 'secondaryItems');
    }
    render() {
        return [
            this.currentTheme ? h("style", null, themes[this.currentTheme]) : '',
            h("nav", { class: 'navbar navbar-expand-lg' },
                h("div", { class: 'collapse navbar-collapse' + (this.navigationOpen ? ' show' : '') },
                    h("nav", { class: 'navbar-nav' },
                        this._primaryItems.map(item => h("a", { href: item['location'], class: 'nav-item nav-link' },
                            h("span", null, item['text']))),
                        h("slot", { name: "primary-items" }))),
                h("div", { class: 'collapse navbar-collapse' + (this.navigationOpen ? ' show' : '') },
                    h("nav", { class: 'navbar-nav ml-auto' },
                        this._secondaryItems.map((item) => h("a", { href: item['location'], class: 'nav-item nav-link' },
                            h("span", null, item['text']))),
                        h("slot", { name: "secondary-items" }))))
        ];
    }
    static get is() { return "c-navigation"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "_primaryItems": {
            "state": true
        },
        "_secondaryItems": {
            "state": true
        },
        "currentTheme": {
            "state": true
        },
        "navigationOpen": {
            "state": true
        },
        "primaryItems": {
            "type": "Any",
            "attr": "primary-items",
            "watchCallbacks": ["setItems"]
        },
        "secondaryItems": {
            "type": "Any",
            "attr": "secondary-items",
            "watchCallbacks": ["setItems"]
        },
        "theme": {
            "type": String,
            "attr": "theme",
            "watchCallbacks": ["updateTheme"]
        }
    }; }
    static get style() { return "/**style-placeholder:c-navigation:**/"; }
}
