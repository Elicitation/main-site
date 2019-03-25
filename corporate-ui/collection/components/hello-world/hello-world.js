export class HelloWorld {
    constructor() {
        this.text = 'hello-World';
    }
    render() {
        return (h("div", null,
            h("h2", null,
                this.text,
                " component")));
    }
    static get is() { return "c-hello-world"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "text": {
            "type": "Any",
            "attr": "text"
        }
    }; }
    static get style() { return "/**style-placeholder:c-hello-world:**/"; }
}
