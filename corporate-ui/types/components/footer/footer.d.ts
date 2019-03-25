import '../../stencil.core';
export declare class Footer {
    theme: string;
    items: any;
    currentTheme: string;
    show: boolean;
    _items: object[];
    itemsSlot: any;
    el: HTMLElement;
    setItems(items: any): void;
    updateTheme(name: any): void;
    componentWillLoad(): void;
    componentDidLoad(): void;
    getNavSlotItems(node: any): void;
    render(): JSX.Element[];
}
