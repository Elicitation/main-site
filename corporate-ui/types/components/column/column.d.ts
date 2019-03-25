import '../../stencil.core';
export declare class Column {
    sm: any;
    md: any;
    lg: any;
    xl: any;
    hostData(): {
        class: {
            col: boolean;
        };
    };
    render(): JSX.Element;
}
