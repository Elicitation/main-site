import '../../stencil.core';
export declare class Theme {
    name: string;
    currentTheme: any;
    setTheme(name: any): void;
    componentWillLoad(): void;
    render(): JSX.Element;
}
