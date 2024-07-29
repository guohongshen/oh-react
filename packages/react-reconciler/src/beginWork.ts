import { ReactElement } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";

// 递归中的递阶段
export function beginWork(wip: FiberNode, renderLane: Lane) {
    // 比较，返回子 fiberNode
    switch (wip.tag) {
        case HostRoot:
            return updateHostRoot(wip, renderLane);
        case HostComponent:
            return updateHostComponent(wip);
        case HostText:
            return null; // 叶子节点
        case FunctionComponent:
            return updateFunctionComponent(wip, renderLane);
        case Fragment:
            return updateFragment(wip);
        default:
            if (__DEV__) {
                console.warn('beginWork 未实现的类型');
            }
            return null;
    }
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
    const baseState = wip.memoizedState;
    const updateQueue = wip.updateQueue as UpdateQueue<ReactElement>;
    const pending = updateQueue.shared.pending;
    updateQueue.shared.pending = null;
    const res = processUpdateQueue(baseState, pending, renderLane);
    wip.memoizedState = res.memoizedState;

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

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
    const nextChildren = renderWithHooks(wip, renderLane);
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function updateFragment(wip: FiberNode) {
    // 注意：带有 key 的 Fragment，其 props 就是 children；
    // 但是如果没有 key，那就不会创建 Fragment fiber
    const nextChildren = wip.pendingProps;

    reconcileChildren(wip, nextChildren);
    return wip.child;
}

/**
 * 将 wip.alternate 与 children 进行比较。
 * @param wip 
 * @param children 
 */
function reconcileChildren(
    wip: FiberNode,
    children?: any // ReactElement | any[]
) {
    const current = wip.alternate;
    if (current !== null) {
        // update
        wip.child = reconcileChildFibers(wip, current?.child, children);
    } else {
        // mount
        wip.child = mountChildFibers(wip, null, children);
    }
    
}
