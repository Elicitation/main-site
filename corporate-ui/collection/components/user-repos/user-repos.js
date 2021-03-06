export class UserRepos {
    constructor() {
        this.repos = [];
    }
    componentWillLoad() {
    }
    render() {
        return h("c-list", { items: this.repos });
    }
    static get is() { return "user-repos"; }
    static get encapsulation() { return "shadow"; }
    static get properties() { return {
        "repos": {
            "state": true
        },
        "userId": {
            "type": String,
            "attr": "user-id"
        }
    }; }
    static get style() { return "/**style-placeholder:user-repos:**/"; }
}
