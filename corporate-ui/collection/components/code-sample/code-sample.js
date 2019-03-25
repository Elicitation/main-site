import hljs from 'highlight.js';
export class Field {
    constructor() {
        this.type = 'html';
        this.renderExample = node => {
            let code = node.assignedNodes().reduce((lines, line) => {
                if (line && line.nodeType === 1) {
                    lines.push(line.outerHTML);
                }
                return lines;
            }, []);
            const parsed = code.join('\n').replace(/"/g, "'").replace(/&quot;/g, '"').replace(/ class='hydrated'/g, '');
            this.code = hljs.highlight(this.type, parsed, false).value;
        };
    }
    componentDidLoad() {
        const elem = this.el.shadowRoot.querySelector('slot');
        elem.addEventListener('slotchange', event => this.renderExample(event.target));
        this.renderExample(elem);
    }
    render() {
        return [
            h("slot", null),
            h("pre", null,
                h("code", Object.assign({ class: this.type }, { innerHTML: this.code })))
        ];
    }
    static get is() { return "c-code-sample"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "code": {
            "state": true
        },
        "el": {
            "elementRef": true
        },
        "type": {
            "type": String,
            "attr": "type"
        }
    }; }
    static get style() { return "/**style-placeholder:c-code-sample:**/"; }
}
