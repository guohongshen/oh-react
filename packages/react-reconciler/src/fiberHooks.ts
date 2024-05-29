import internals from "shared/internals";
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from "./updateQueue";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;

export interface Hook {
    memoizedState: any;
    updateQueue: unknown;
    next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
    currentlyRenderingFiber = wip;
    wip.memoizedState = null;

    const current = wip.alternate;
    if (current !== null) {
        // update
    } else {
        // mount
        currentDispatcher.current = HooksDispatcherOnMount;
    }

    const Component = wip.type;
    const props = wip.pendingProps;
    const children = Component(props);

    currentlyRenderingFiber = null;
    return children;
}

const HooksDispatcherOnMount: Dispatcher = {
    useState: mountState,
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

function dispatchSetState<State>(
    fiber: FiberNode,
    updateQueue: UpdateQueue<State>,
    action: Action<State>
) {
    const update = createUpdate(action);
    enqueueUpdate(updateQueue, update);
    scheduleUpdateOnFiber(fiber);
}
