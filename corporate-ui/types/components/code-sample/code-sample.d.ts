import '../../stencil.core';
export declare class Field {
    type: string;
    code: any;
    el: HTMLElement;
    componentDidLoad(): void;
    renderExample: (node: any) => void;
    render(): JSX.Element[];
}
