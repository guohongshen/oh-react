import internals from "shared/internals";
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import { Update, UpdateQueue, basicStateReducer, createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue } from "./updateQueue";
import { Action, ReactContext, Thenable, Usable } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Lane, NoLane, NoLanes, mergeLanes, removeLanes, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookEffectTag, HookHasEffect, Passive } from "./hookEffectTag";
import currentBatchConfig from "react/src/currentBatchConfig";
import { REACT_CONTEXT_TYPE } from "shared/ReactSymbols";
import { getThenableValueOrThrowReasonOrTrackThenable } from "./thenbale";
import { markWipReceiveUpdate } from "./beginWork";
import { readContext as originalReadContext } from "./fiberContext";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

export interface Hook {
    memoizedState: any;
    baseState: any;
    baseQueue: Update<any> | null;
    updateQueue: unknown;
    next: Hook | null;
}

/** 创建和销毁函数 */
type EffectCallback = () => void;
/** 依赖数组 */
type EffectDeps = any[] | null;
/**
 * Effect 类的 Hooks 的用来存储数据的
 */
export interface Effect {
    tag: HookEffectTag;
    create: EffectCallback | void;
    destroy: EffectCallback | void;
    deps: EffectDeps;
    /**
     * 为了方便使用，和其他 effect 连接成链表。render 时重置 effect 链表。
     */
    next: Effect | null;
}

export interface FCUpdateQueue<State = any> extends UpdateQueue<State>{
    lastEffect: Effect | null;
}

/** useCallback 的依赖数组 */
export type HookDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
    currentlyRenderingFiber = wip;
    // 重置 hooks 链表
    wip.memoizedState = null;
    // 重置 effect 链表
    wip.updateQueue = null;

    renderLane = lane;

    const current = wip.alternate;
    if (current !== null) {
        // update
        currentDispatcher.current = HooksDispatcherOnUpdate;
    } else {
        // mount
        currentDispatcher.current = HooksDispatcherOnMount;
    }

    const Component = wip.type;
    const props = wip.pendingProps;
    const children = Component(props);

    currentlyRenderingFiber = null;
    workInProgressHook = null;
    currentHook = null;
    renderLane = NoLane;
    return children;
}

const HooksDispatcherOnMount: Dispatcher = {
    useState: mountState,
    useEffect: mountEffect,
    useTransition: mountTransition,
    useRef: mountRef,
    useContext: readContext,
    use: use,
    useMemo: mountMemo,
    useCallback: mountCallback
};

const HooksDispatcherOnUpdate: Dispatcher = {
    useState: updateState,
    useEffect: updateEffect,
    useTransition: updateTransition,
    useRef: updateRef,
    useContext: readContext,
    use: use,
    useMemo: updateMemo,
    useCallback: updateCallback
};

function mountState<State>(
    initialState: (() => State) | State
): [State, Dispatch<State>] {
    const hook = mountWorkInProgressHook();

    let memoizedState = null;
    if (initialState instanceof Function) {
        memoizedState = initialState();
    } else {
        memoizedState = initialState;
    }
    hook.memoizedState = memoizedState;
    hook.baseState = memoizedState;

    const queue = createUpdateQueue<State>();
    hook.updateQueue = queue;

    const dispatch = dispatchSetState.bind(
        null,
        // @ts-ignore
        currentlyRenderingFiber,
        queue,
    );
    queue.dispatch = dispatch;
    queue.lastRenderedState = memoizedState;

    return [memoizedState, queue.dispatch];
}

function updateState<State>(): [State, Dispatch<State>] {
    const hook = updateWorkInProgressHook();

    // 计算新 state 的逻辑
    const queue = hook.updateQueue as UpdateQueue<State>;
    const pending = queue.shared.pending;

    const baseState = hook.baseState;
    let baseQueue = (currentHook as Hook).baseQueue;

    if (pending !== null) {
        if (baseQueue !== null) {
            const baseFirst = baseQueue.next;
            const pendingFirst = pending.next;

            baseQueue.next = pendingFirst;
            pending.next = baseFirst;
        }
        baseQueue = pending;
        // 保存在 current 中
        (currentHook as Hook).baseQueue = pending; // 这里的逻辑是：
        // 如果本次更新被高优先级更新打断（也即本次更新的结果还没来得及进入 commit）
        // 高优任务在执行时，就能从 currentHook.baseQueue 中拿到上一次的更新队列，
        // 不然下一行就把 pending 清空了。
        queue.shared.pending = null;
    }

    if (baseQueue !== null) {
        const prevState = hook.memoizedState;

        const {
            memoizedState: newMemoizedState,
            baseQueue: newBaseQueue,
            baseState: newBaseState
        } = processUpdateQueue(
            baseState,
            baseQueue,
            renderLane,
            update => {
                const skippedLane = update.lane;
                const fiber = currentlyRenderingFiber as FiberNode;
                fiber.lanes = mergeLanes(fiber.lanes, skippedLane);
            }
        );

        if (!Object.is(prevState, newMemoizedState)) {
            // NaN === NaN false, Object.is true
            // +0 === -0 false, Object.is true
            markWipReceiveUpdate();
        }

        hook.memoizedState = newMemoizedState;
        hook.baseState = newBaseState;
        hook.baseQueue = newBaseQueue;
        queue.lastRenderedState = newMemoizedState;
    }

    return [hook.memoizedState, (queue.dispatch as Dispatch<State>)];
}

function mountEffect(
    create: EffectCallback | void,
    deps: EffectDeps | void
) {
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

    hook.memoizedState = pushEffect(
        Passive | HookHasEffect,
        create,
        undefined,
        nextDeps
    );
}

function updateEffect(
    create: EffectCallback | void,
    deps: EffectDeps | void
) {
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    let destroy: EffectCallback | void;

    if (currentHook !== null) {
        const prevEffect = currentHook.memoizedState as Effect;
        destroy = prevEffect.destroy;

        if (nextDeps !== null) {
            // 浅比较依赖
            const prevDeps = prevEffect.deps;
            if (areHookInputsEqual(nextDeps, prevDeps)) {
                hook.memoizedState = pushEffect(
                    Passive,
                    create,
                    destroy,
                    nextDeps
                );
                return;
            }
        }
        // 浅比较 不相等
        (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
        hook.memoizedState = pushEffect(
            Passive | HookHasEffect,
            create,
            destroy,
            nextDeps
        );
    }
}

function mountTransition(): [boolean, (callback: () => void) => void] {
    const [isTransitioning, setIsTransitioning] = mountState(false);
    const hook = mountWorkInProgressHook();
    function startTransition(
        setIsPending: Dispatch<boolean>,
        callback: () => void
    ) {
        setIsPending(true); // 此处是同步更新

        const preTransition = currentBatchConfig.transition;
        currentBatchConfig.transition = 1; // 标记当前为 transition 更新阶段，调用 requestUpdateLane 返回 TransitionLane

        callback(); // 执行回调，触发更新
        setIsPending(false); // 回调执行完后，将 isPending 置为 false。注意此 update 的 lane 仍是 TransitionLane

        currentBatchConfig.transition = preTransition; // 任务完成，恢复进入 transition 之前的值
    };
    hook.memoizedState = startTransition.bind(null, setIsTransitioning);
    return [isTransitioning, hook.memoizedState];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
    const [isTransitioning] = updateState<boolean>();
    const hook = updateWorkInProgressHook();
    const starTransition = hook.memoizedState;
    return [isTransitioning, starTransition];
}

function mountRef<T>(initialValue: T): { current: T } {
    const hook = mountWorkInProgressHook();
    const ref = {
        current: initialValue
    };
    hook.memoizedState = ref;
    return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
    const hook = updateWorkInProgressHook();
    return hook.memoizedState;
}

function readContext<T>(context: ReactContext<T>): T {
    const consumer = currentlyRenderingFiber;
    return originalReadContext(
        consumer,
        context
    );
}

function use<T>(usable: Usable<T>): T {
    if (usable !== null && typeof usable === 'object') {
        if ((typeof (usable as Thenable<T>).then) === 'function') {
            // thenable
            const thenable = usable as Thenable<T>;
            return getThenableValueOrThrowReasonOrTrackThenable(thenable);
        } else if ((usable as ReactContext<T>).$$typeof === REACT_CONTEXT_TYPE) {
            // context
            const context = usable as ReactContext<T>;
            return readContext(context);
        }
    }
    throw new Error('use 参数类型不对：' + usable);
}

function mountCallback<T>(callback: T, deps: HookDeps | undefined) {
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    hook.memoizedState = [callback, nextDeps];
    return callback;
}

function updateCallback<T>(callback: T, deps: HookDeps | undefined) {
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    const prevState = hook.memoizedState;
    const prevDeps = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
    }
    hook.memoizedState = [callback, nextDeps];
    return callback;
}

function mountMemo<T>(nextCreate: () => T, deps: HookDeps | undefined) {
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    const nextValue = nextCreate();
    hook.memoizedState = [nextValue, nextDeps];
    return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps: HookDeps | undefined) {
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    const prevState = hook.memoizedState;
    const prevDeps = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
    }
    const nextValue = nextCreate();
    hook.memoizedState = [nextValue, nextDeps];
    return nextValue;
}

/**
 * 原名：resetHooksOnUnwind
 */
export function resetHooksWhenUnwind() {
    currentlyRenderingFiber = null;
    currentHook = null;
    workInProgressHook = null;
}

export function bailoutHook(
    wip: FiberNode,
    renderLane: Lane
) {
    const current = wip.alternate as FiberNode;
    wip.updateQueue = current.updateQueue;
    wip.flags &= ~PassiveEffect;

    wip.flags = removeLanes(wip.flags, renderLane);
}

/**
 * mount 时，创建 hook 并加入到 currentlyRenderingFiber 的 hook 链表，并返回。
 * @returns 
 */
function mountWorkInProgressHook(): Hook {
    const hook: Hook = {
        memoizedState: null,
        updateQueue: null,
        next: null,
        baseQueue: null,
        baseState: null
    };
    if (workInProgressHook === null) {
        if (currentlyRenderingFiber === null) {
            // 在外部调用 hook
            throw new Error('请在函数组件内调用 hook');
        } else { // mount 时，第一个 hook
            workInProgressHook = hook;
            currentlyRenderingFiber.memoizedState = workInProgressHook;
        }
    } else {
        // mount 时，后续的 hook
        workInProgressHook.next = hook;
        workInProgressHook = hook;
    }
    return hook;
}

/**
 * update 时，复用 current hook 的属性值，创建新的 hook 实例并加入到 currentlyRenderingFiber.memoizedState 
 * hook 链表 中，将新的 hook 实例赋值给 workInProgressHook 并返回。
 * @returns 
 */
function updateWorkInProgressHook(): Hook {
    // TODO render 阶段触发的更新
    let nextCurrentHook: Hook | null = null;

    if (currentHook === null) {
        // 这是这个 FC update 时的第一个 hook
        const current = currentlyRenderingFiber?.alternate;
        if (current !== null) {
            nextCurrentHook = current?.memoizedState;
        } else {
            nextCurrentHook = null; // 错误的边界情况，暂时忽略
        }
    } else {
        // 这个 FC update 时，后续的 hook
        nextCurrentHook = currentHook.next;
    }

    if (nextCurrentHook === null) {
        // mount 时执行了三个 hook，update 时却调用了四次，所以第四次 nextCurrent 是 null
        throw new Error(`组件${currentlyRenderingFiber?.type}本次执行时的 Hook 比上次执行时多`)
    }

    currentHook = nextCurrentHook as Hook;
    const newHook: Hook = {
        memoizedState: currentHook.memoizedState,
        updateQueue: currentHook.updateQueue,
        next: null,
        baseQueue: currentHook.baseQueue,
        baseState: currentHook.baseState
    };

    if (workInProgressHook === null) {
        if (currentlyRenderingFiber === null) {
            // 在外部调用 hook
            throw new Error('请在函数组件内调用 hook');
        } else { // update 时，第一个 hook
            workInProgressHook = newHook;
            currentlyRenderingFiber.memoizedState = workInProgressHook;
        }
    } else {
        // update 时，后续的 hook
        workInProgressHook.next = newHook;
        workInProgressHook = newHook;
    }

    return workInProgressHook;
}

/**
 * useState 返回的 setState 函数
 * @param fiber 
 * @param updateQueue 
 * @param action 
 */
function dispatchSetState<State>(
    fiber: FiberNode,
    updateQueue: UpdateQueue<State>,
    action: Action<State>
) {
    const lane = requestUpdateLane();
    const update = createUpdate(action, lane);

    // eagerState 策略
    const current = fiber.alternate;
    if (
        fiber.lanes === NoLanes && 
        (current === null || current.lanes === NoLanes)
    ) {
        // 当前产生的 update 是这个 fiber 的第一个 update
        // 1. 更新前的状态
        const currentState = updateQueue.lastRenderedState as State;
        /**
         * eager：急迫的、急切的。本来计算 state 是在 render 中发生，但在这里提前计算
         * 了，所以叫急迫的。
         */
        const eagerState = basicStateReducer<State>(
            currentState,
            action
        );
        update.hasEagerState = true;
        update.eagerState = eagerState;

        if (Object.is(currentState, eagerState)) {
            enqueueUpdate(fiber, updateQueue, update, NoLane);
            if (__DEV__) {
                console.warn('命中 eagerState', fiber);
            }
            return;
        }
    }

    enqueueUpdate(fiber, updateQueue, update, lane);
    scheduleUpdateOnFiber(fiber, lane);
}

/**
 * 将 effect 加入到 currentlyRenderingFiber.updateQueue.lastEffect 为尾的 effect 列表中（updateQueue
 * 是 FCUpdateQueue，相比于 UpdateQueue 多了一个 lastEffect 属性）。最后返回该 effect。
 * @param hookFlags 
 * @param create 
 * @param destroy 
 * @param deps 
 */
function pushEffect(
    hookFlags: Flags,
    create: EffectCallback | void,
    destroy: EffectCallback | void,
    deps: EffectDeps
): Effect {
    const effect: Effect = {
        tag: hookFlags,
        create,
        destroy,
        deps,
        next: null
    };
    const fiber = currentlyRenderingFiber as FiberNode;
    function createFCUpdateQueue<State>() {
        const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
        updateQueue.lastEffect = null;
        return updateQueue;
    }
    let updateQueue = fiber.updateQueue as FCUpdateQueue;
    if (updateQueue === null) {
        updateQueue = createFCUpdateQueue();
        fiber.updateQueue = updateQueue;
        effect.next = effect;
        updateQueue.lastEffect = effect;
    } else {
        const lastEffect = updateQueue.lastEffect;
        if (lastEffect === null) {
            effect.next = effect;
            updateQueue.lastEffect = effect;
        } else {
            effect.next = lastEffect.next;
            lastEffect.next = effect;
            updateQueue.lastEffect = effect;
        }
    }
    return effect;
}

/**
 * nextDeps 和 prevDeps 只要有一个为 null 就返回 false；属性个数不一样也返回 false；
 * 个数一样就浅比较。
 * @param nextDeps 
 * @param prevDeps 
 * @returns 
 */
function areHookInputsEqual(nextDeps: HookDeps, prevDeps: HookDeps) {
    if (prevDeps === null || nextDeps === null) {
        return false; // 如果没有传递 deps 会进到这里来
    }
    for (let i = 0; i < prevDeps.length && i < nextDeps.length; ++i) {
        if (Object.is(prevDeps[i], nextDeps[i])) {
            continue;
        }
        return false;
    }
    return true;
}
