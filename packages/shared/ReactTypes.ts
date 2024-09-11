export type Type = any;
export type Key = any;
export type Ref ={
    current: any;
} | ((instance: any) => void);
export type Props = any;
export type ElementTpe = any;

export interface ReactElement {
    /**
     * 表示该 object 是 ReactElement
     */
    $$typeof: symbol | number;
    /**
     * ReactElement 的类型，如：'div', function，class, Fragment 等
     */
    type: ElementTpe;
    key: Key;
    ref: Ref;
    props: Props;
    __mark: string;
}

export type Action<State> = State | ((prevState: State) => State);
