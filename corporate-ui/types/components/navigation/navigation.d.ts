import '../../stencil.core';
export declare class Navigation {
    theme: string;
    primaryItems: any;
    secondaryItems: any;
    navigationOpen: boolean;
    currentTheme: string;
    _primaryItems: object[];
    _secondaryItems: object[];
    setItems(items: any, type: any): void;
    updateTheme(name: any): void;
    componentWillLoad(): void;
    render(): JSX.Element[];
}
