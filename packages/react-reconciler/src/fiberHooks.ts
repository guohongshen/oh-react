import internals from "shared/internals";
import { FiberNode } from "./fiber";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null;

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
        currentDispatcher.current;
    }

    const Component = wip.type;
    const props = wip.pendingProps;
    const children = Component(props);

    currentlyRenderingFiber = null;
    return children;
}
