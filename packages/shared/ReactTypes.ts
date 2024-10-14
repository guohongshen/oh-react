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

export type ReactContext<T> = {
    $$typeof: symbol | number;
    Provider: ReactProvider<T> | null;
    _currentValue: T;
}

export type ReactProvider<T> = {
    $$typeof: symbol | number;
    _context: ReactContext<T> | null;
}

export type Usable<T> = Thenable<T> | ReactContext<T>;

/**
 * 通用的 Thenable 定义
 */
export type OriginalThenable<T, Result, Err> = {
    then(
        onFulfilled: (value: T) => Result,
        onRejected: (err: Err) => Result
    ): void | Wakeable<Result>
}

type ThenableStatus = 'untracked' | 'fulfilled' | 'rejected' | 'pending';

export interface Thenable<T, Result = void, Err = any> extends OriginalThenable<T, Result, Err> {
    status: ThenableStatus;
}

export interface UntrackedThenable<T, Result, Err> extends Thenable<T, Result, Err> {
    status: 'untracked';
}

export interface FulfilledThenable<T, Result, Err> extends Thenable<T, Result, Err> {
    status: 'fulfilled';
    value: T;
}

export interface RejectedThenable<T, Result, Err> extends Thenable<T, Result, Err> {
    status: 'rejected';
    reason: Err;
}

export interface PendingThenable<T, Result, Err> extends Thenable<T, Result, Err> {
    status: 'pending';
}

export type Wakeable<Result> = {
    then(
        onFulfilled: () => Result,
        onRejected: () => Result
    ): void | Wakeable<Result>
}
