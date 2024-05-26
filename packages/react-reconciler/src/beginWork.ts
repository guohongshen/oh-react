import { ReactElement } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { HostComponent, HostRoot, HostText } from "./workTags";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";

// 递归中的递阶段
export function beginWork(wip: FiberNode) {
    // 比较，返回子 fiberNode
    switch (wip.tag) {
        case HostRoot:
            updateHostRoot(wip);
            return;
        case HostComponent:
            updateHostComponent(wip);
            return;
        case HostText:
            return null; // 叶子节点
        default:
            if (__DEV__) {
                console.warn('beginWork 未实现的类型');
            }
            return;
    }
}

function updateHostRoot(wip: FiberNode) {
    const baseState = wip.memoizedState;
    const updateQueue = wip.updateQueue as UpdateQueue<ReactElement>;
    const pending = updateQueue.shared.pending;
    updateQueue.shared.pending = null;
    const { memoizedState } = processUpdateQueue(baseState, pending);
    wip.memoizedState = memoizedState;

    const nextChildren = wip.memoizedState;
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function updateHostComponent(wip: FiberNode) {
    const nextProps = wip.pendingProps;
    const nextChildren = nextProps.children;
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

/**
 * 将 wip.alternate 与 children 进行比较。
 * @param wip 
 * @param children 
 */
function reconcileChildren(wip: FiberNode, children?: ReactElement) {
    const current = wip.alternate;

    if (current !== null) {
        // update
        wip.child = reconcileChildFibers(wip, current?.child, children);
    } else {
        // mount
        wip.child = mountChildFibers(wip, null, children);
    }
    
}
