export class Row {
    hostData() {
        return {
            class: { row: true }
        };
    }
    render() {
        return h("slot", null);
    }
    static get is() { return "c-row"; }
    static get encapsulation() { return "shadow"; }
    static get style() { return "/**style-placeholder:c-row:**/"; }
}
