import internals from "shared/internals";
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue } from "./updateQueue";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Lane, NoLane, requestUpdateLane } from "./fiberLanes";

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

export function renderWithHooks(wip: FiberNode, lane: Lane) {
    currentlyRenderingFiber = wip;
    // 重置 hooks 链表
    wip.memoizedState = null;

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
    renderLane = NoLane;
    return children;
}

const HooksDispatcherOnMount: Dispatcher = {
    useState: mountState,
    useEffect: null
};

const HooksDispatcherOnUpdate: Dispatcher = {
    useState: updateState,
    useEffect: null
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
