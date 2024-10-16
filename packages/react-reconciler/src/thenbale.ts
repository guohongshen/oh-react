import { FulfilledThenable, PendingThenable, RejectedThenable, Thenable } from "shared/ReactTypes";

export const SuspenseException = new Error('Suspense trackUsedThenable throw error')

let suspendedThenable: Thenable<any> | null = null;
export function getSuspendedThenable(): Thenable<any> {
    if (suspendedThenable === null) {
        throw new Error('getSuspendedThenable 调用时 suspendedThenable 不存在，应该存在的');
    }
    const thenable = suspendedThenable;
    suspendedThenable = null;
    return thenable;
}

/**
 * 这个函数的逻辑是：
 * thenable 的 status 如果是
 * <1> fulfilled，则返回 value；
 * <2> rejected，则 throw reason，假设是请求参数传错了，就抛出去，由用户去处理；
 * <3> pending，什么也不做；
 * <4> 没有值，也即没有被包装过（被添加过 status 属性等），则添加 status = 'pending'
 * 属性，并调用 then 如果 fulfilled 则修改 status 属性为 'fulfilled' 并将结果存入 value，
 * 如果 rejected 修改 status 属性为 'rejected' 并将原因存入 reason。
 * @param thenable 
 * @returns 
 */
export function getThenableValueOrThrowReasonOrTrackThenable<T>(thenable: Thenable<T>) {
    switch (thenable.status) {
        case 'fulfilled':
            return (thenable as FulfilledThenable<T, void, any>).value;
        case 'rejected':
            throw (thenable as RejectedThenable<T, void, any>).reason;
        default:
            if (typeof thenable.status === 'string') {
                /**
                 * 开发者并不会在写程序时给 thenable 添加 status 属性。那只能说明是
                 * 之前有 use 使用过这个 thenable 了。问：“之前”是什么意思？答：
                 * 概括为两种情况：<1> 本轮更新中，其他地方有 use(thenable)，如：其他 Suspense
                 * 下也有组件在 use 这个 thenable，注意：同一个 Suspense 下，如果不
                 * 嵌套 Suspense，是不可能有第二个 use 被执行的，因为一旦 use(thenable) 
                 * 被执行，就会 unwind 到 Suspense；<2>因为执行 beginWorkOnSuspense 时，
                 * 如果 flags 有 DidCapture，则 showFallback 为 true，并去掉 flags
                 * 中的 DidCapture。这就表明下次更新时，会又执行到 use(thenable)，
                 * 而此时如果 thenable 没有落定，就会跑到此处 if 里来。
                 * QUESTION: 那 beginWorkOnSuspense 为什么要去掉 DidCapture 呢？
                 */
                suspendedThenable = thenable;
                throw SuspenseException;
                // 错误还是要抛的
            }
            // 说明没被处理过，看成是 untracked 状态
            const pending = thenable as unknown as PendingThenable<T, void ,any>;
            pending.status = 'pending'; // untracked -> pending
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
                        rejected.reason = err;
                    }
                }
            );
            suspendedThenable = thenable; // 缓存一下，下面这行报错会被 workLoop 捕捉到，然后取出 suspendedThenable。
            throw SuspenseException;
            // 问：为什么不直接 throw suspendedThenable？
            // 答：不想被用户捕捉到，所以就抛出一个替身 SuspenseException，并告诉用户“这是
            // React 内部的错误，如果你捕捉到了请继续抛出”
            
    }
}

