import '../../stencil.core';
export declare class Header {
    theme: string;
    siteName: string;
    siteUrl: string;
    items: any;
    primaryItems: any;
    secondaryItems: any;
    currentTheme: string;
    navigationOpen: any;
    _items: object[];
    navigationSlot: any;
    el: HTMLElement;
    setItems(items: any): void;
    updateTheme(name: any): void;
    toggleNavigation(open: any): void;
    componentWillLoad(): void;
    componentDidLoad(): void;
    getNavSlotItems(node: any): void;
    render(): JSX.Element[];
}
