import { store } from '../../global';
import * as themes from '../../tmp/c-content';
export class Content {
    constructor() {
        this.currentTheme = this.theme || store.getState().theme.name;
    }
    updateTheme(name) {
        this.currentTheme = name;
    }
    componentWillLoad() {
        store.subscribe(() => this.currentTheme = store.getState().theme.name);
    }
    render() {
        return [
            this.currentTheme ? h("style", null, themes[this.currentTheme]) : '',
            h("slot", null)
        ];
    }
    static get is() { return "c-content"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "currentTheme": {
            "state": true
        },
        "router": {
            "type": "Any",
            "attr": "router"
        },
        "theme": {
            "type": String,
            "attr": "theme",
            "watchCallbacks": ["updateTheme"]
        }
    }; }
    static get style() { return "/**style-placeholder:c-content:**/"; }
}
