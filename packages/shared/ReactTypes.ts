export type Type = any;
export type Key = any;
export type Ref = any;
export type Props = any;
export type ElementTpe = any;

export interface ReactElement {
    $$typeof: symbol | number;
    type: ElementTpe;
    key: Key;
    ref: Ref;
    props: Props;
    __mark: string;
}

export type Action<State> = State | ((prevState: State) => State);
