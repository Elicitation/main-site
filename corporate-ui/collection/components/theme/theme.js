import { store, actions } from '../../global';
import * as themes from '../../tmp/c-theme';
export class Theme {
    constructor() {
        this.name = store.getState().theme.name;
    }
    setTheme(name) {
        this.currentTheme = name;
        store.dispatch({ type: actions.SET_THEME, name });
    }
    componentWillLoad() {
        this.setTheme(this.name);
    }
    render() {
        return this.currentTheme ? h("style", null, themes[this.currentTheme]) : '';
    }
    static get is() { return "c-theme"; }
    static get properties() { return {
        "currentTheme": {
            "state": true
        },
        "name": {
            "type": String,
            "attr": "name",
            "watchCallbacks": ["setTheme"]
        }
    }; }
    static get style() { return "/**style-placeholder:c-theme:**/"; }
}
