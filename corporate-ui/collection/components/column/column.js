export class Column {
    hostData() {
        const data = { class: { col: true } };
        ['sm', 'md', 'lg', 'xl'].map(size => {
            let item = this[size];
            if (!item)
                return;
            try {
                item = JSON.parse(item);
            }
            catch (_a) {
                item = item;
            }
            if (typeof item === 'number') {
                data.class['col-' + size + (item ? '-' + item : '')] = item;
            }
            else {
                Object.keys(item).map(prop => {
                    const prefix = prop === 'size' ? 'col' : prop;
                    data.class[prefix + '-' + size + '-' + item[prop]] = prop;
                });
            }
        });
        return data;
    }
    render() {
        return h("slot", null);
    }
    static get is() { return "c-column"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "lg": {
            "type": "Any",
            "attr": "lg"
        },
        "md": {
            "type": "Any",
            "attr": "md"
        },
        "sm": {
            "type": "Any",
            "attr": "sm"
        },
        "xl": {
            "type": "Any",
            "attr": "xl"
        }
    }; }
    static get style() { return "/**style-placeholder:c-column:**/"; }
}
