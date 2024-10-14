import { FulfilledThenable, PendingThenable, RejectedThenable, Thenable } from "shared/ReactTypes";

export const SuspenseException = new Error('Suspense trackUsedThenable throw error')

let unnamedThenable: Thenable<any> | null = null;
export function getUnnamedThenable(): Thenable<any> {
    if (unnamedThenable === null) {
        throw new Error('getUnnamedThenable 调用时 unnamedThenable 不存在，应该存在的')；
    }
    const thenable = unnamedThenable;
    unnamedThenable = null;
    return thenable;
}

function noop() {}

export function trackUsedThenable<T>(thenable: Thenable<T>) {
    switch (thenable.status) {
        case 'fulfilled':
            return thenable.value;
        case 'rejected':
            throw thenable.reason;
        default:
            if (typeof thenable.status === 'string') {
                thenable.then(noop, noop);
            } else { // 看成 untracked

                // pending
                const pending = thenable as unknown as PendingThenable<T, void ,any>;
                pending.status = 'pending';
                pending.then(
                    val => {
                        if (pending.status === 'pending') {
                            // @ts-ignore
                            const fulfilled: FulfilledThenable<T, void, any> = pending;
                            fulfilled.status = 'fulfilled';
                            // @ts-ignore
                            fulfilled.value = val;
                        }
                    },
                    err => {
                        if (pending.status === 'pending') {
                            // @ts-ignore
                            const rejected: RejectedThenable<T, void, any> = pending;
                            rejected.status = 'rejected';
                            // @ts-ignore
                            fulfilled.reason = err;
                        }
                    }
                )
            }
    }
    thenable = thenable;
    throw SuspenseException;
}

