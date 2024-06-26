import internals from "shared/internals";
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue } from "./updateQueue";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Lane, NoLane, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookEffectTag, HookHasEffect, Passive } from "./hookEffectTag";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

export interface Hook {
    memoizedState: any;
    updateQueue: unknown;
    next: Hook | null;
}

/** 创建和销毁函数 */
type EffectCallback = () => void;
/** 依赖数组 */
type EffectDeps = any[] | null;
/**
 * effect 类的 hook 用于存储 effect 相关信息。
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
    renderLane = NoLane;
    return children;
}

const HooksDispatcherOnMount: Dispatcher = {
    useState: mountState,
    useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
    useState: updateState,
    useEffect: updateEffect
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
    const queue = createUpdateQueue<State>();
    hook.updateQueue = queue;

    const dispatch = dispatchSetState.bind(
        null,
        // @ts-ignore
        currentlyRenderingFiber,
        queue,
    );
    queue.dispatch = dispatch;

    return [memoizedState, queue.dispatch];
}

function updateState<State>(
    initialState: (() => State) | State
): [State, Dispatch<State>] {
    const hook = updateWorkInProgressHook();

    // 计算新 state 的逻辑
    const queue = hook.updateQueue as UpdateQueue<State>;
    const pending = queue.shared.pending;

    if (pending !== null) {
        const {
            memoizedState
        } = processUpdateQueue(hook.memoizedState, pending, renderLane);
        hook.memoizedState = memoizedState;
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

/**
 * mount 时，创建 hook 并加入到 hook 链表，并返回。
 * @returns 
 */
function mountWorkInProgressHook(): Hook {
    const hook: Hook = {
        memoizedState: null,
        updateQueue: null,
        next: null
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
        next: null
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

function dispatchSetState<State>(
    fiber: FiberNode,
    updateQueue: UpdateQueue<State>,
    action: Action<State>
) {
    const lane = requestUpdateLane();
    const update = createUpdate(action, lane);
    enqueueUpdate(updateQueue, update);
    scheduleUpdateOnFiber(fiber, lane);
}

/**
 * 将 effect 加入到 fiber.updateQueue.lastEffect 为尾的 effect 列表中（updateQueue
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

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
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
