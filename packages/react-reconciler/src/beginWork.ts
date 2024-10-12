import { ReactElement } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { ContextProvider, Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import { Ref } from "./fiberFlags";

// 递归中的递阶段
export function beginWork(wip: FiberNode, renderLane: Lane) {
    // 比较，返回子 fiberNode
    switch (wip.tag) {
        case HostRoot:
            return beginWorkOnHostRoot(wip, renderLane);
        case HostComponent:
            return beginWorkOnHostComponent(wip);
        case HostText:
            return null; // 叶子节点
        case FunctionComponent:
            return beginWorkOnFunctionComponent(wip, renderLane);
        case Fragment:
            return beginWorkOnFragment(wip);
        case ContextProvider:
            return beginWorkOnContextProvider(wip);
        default:
            if (__DEV__) {
                console.warn('beginWork 未实现的类型');
            }
            return null;
    }
}

/**
 * 原名：updateHostRoot
 * @param wip 
 * @param renderLane 
 * @returns 
 */
function beginWorkOnHostRoot(wip: FiberNode, renderLane: Lane) {
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

/**
 * 原名：updateHostComponent
 * @param wip 
 * @returns 
 */
function beginWorkOnHostComponent(wip: FiberNode) {
    const nextProps = wip.pendingProps;
    const nextChildren = nextProps.children;
    markRef(wip.alternate, wip);
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

/**
 * 原名：updateFunctionComponent
 * @param wip 
 * @param renderLane 
 * @returns 
 */
function beginWorkOnFunctionComponent(wip: FiberNode, renderLane: Lane) {
    const nextChildren = renderWithHooks(wip, renderLane);
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

/**
 * 原名：updateFragment
 * @param wip 
 * @returns 
 */
function beginWorkOnFragment(wip: FiberNode) {
    // 注意：带有 key 的 Fragment，其 props 就是 children；
    // 但是如果没有 key，那就不会创建 Fragment fiber
    const nextChildren = wip.pendingProps;

    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function beginWorkOnContextProvider(wip: FiberNode) {
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

export function markRef(current: FiberNode | null, workInProgress: FiberNode) {
    const ref = workInProgress.ref;

    if (
        (current === null && ref !== null) || // mount 时
        (current !== null && current.ref !== ref) // update 且 ref 发生变化时
    ) {
        workInProgress.flags |= Ref;
    }
    // 其他情况不需要动
}
