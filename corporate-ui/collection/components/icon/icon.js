import * as icons from './icons';
export class Icon {
    constructor() {
        this.name = 'truck';
    }
    updateIcon(name) {
        name = name.replace(/-([a-z0-9])/g, function (g) {
            return g[1].toUpperCase();
        });
        if (name === 'function') {
            name = 'functionIcon';
        }
        this.iconSet = icons[name] || icons['ban'];
        this.iconPath = this.iconSet['data'];
    }
    componentWillLoad() {
        this.updateIcon(this.name);
    }
    render() {
        return (h("svg", { class: 'icon', xmlns: "http://www.w3.org/2000/svg", viewBox: '0 0 ' + this.iconSet.pos.join(' ') },
            h("path", { d: window.atob(this.iconPath) })));
    }
    static get is() { return "c-icon"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "iconPath": {
            "state": true
        },
        "iconSet": {
            "state": true
        },
        "name": {
            "type": String,
            "attr": "name",
            "watchCallbacks": ["updateIcon"]
        }
    }; }
    static get style() { return "/**style-placeholder:c-icon:**/"; }
}
