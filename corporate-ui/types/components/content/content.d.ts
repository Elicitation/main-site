import '../../stencil.core';
export declare class Content {
    theme: string;
    router: Boolean;
    currentTheme: string;
    updateTheme(name: any): void;
    componentWillLoad(): void;
    render(): JSX.Element[];
}
