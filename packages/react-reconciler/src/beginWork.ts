import { ReactElement } from "shared/ReactTypes";
import { FiberNode, OffscreenProps, createFiberFromFragment, createFiberFromOffscreen, createWorkInProgress } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { WorkTag } from "./workTags";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import { ChildDeletion, Placement, Ref } from "./fiberFlags";
import { pushContextValue } from "./fiberContext";

// 递归中的递阶段
export function beginWork(wip: FiberNode, renderLane: Lane) {
    // 比较，返回子 fiberNode
    switch (wip.tag) {
        case WorkTag.HostRoot:
            return beginWorkOnHostRoot(wip, renderLane);
        case WorkTag.HostComponent:
            return beginWorkOnHostComponent(wip);
        case WorkTag.HostText:
            return null; // 叶子节点
        case WorkTag.FunctionComponent:
            return beginWorkOnFunctionComponent(wip, renderLane);
        case WorkTag.Fragment:
            return beginWorkOnFragment(wip);
        case WorkTag.ContextProvider:
            return beginWorkOnContextProvider(wip);
        case WorkTag.Suspense:
            return beginWorkOnSuspense(wip);
        case WorkTag.Offscreen:
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
    const provider = wip.type;
    const context = provider._context;
    const nextProps = wip.pendingProps;
    pushContextValue(context, nextProps.value)
    const nextChildren = nextProps.children;
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function beginWorkOnSuspense(wip: FiberNode) {
    const current = wip.alternate;
    const nextProps = wip.pendingProps;

    let showFallback = false;
    const isSuspended = false;

    if (isSuspended) {
        showFallback = true;
    }
    const newOffscreenChildren = nextProps.children;
    const newFragmentChildren = nextProps.fallback;

    if (current === null) { // <Suspense/> mount
        if (showFallback) {
            // 第一次就是悬停状态
            return mountWithFallback(
                wip,
                newOffscreenChildren,
                newFragmentChildren
            )
        } else { // 第一次就是正常状态
            return mountWithOffscreen(
                wip,
                newOffscreenChildren
            );
        }
    } else { // <Suspense/> update
        if (showFallback) {
            // 新状态是悬停
            return updateToFallback(
                wip,
                newOffscreenChildren,
                newFragmentChildren
            )
        } else {
            // 新状态是正常
            return updateToOffscreen(
                wip,
                newOffscreenChildren
            );
        }
    }
    function mountWithFallback(
        wip: FiberNode,
        primaryChildren: any,
        fallbackChildren: any
    ) {
        const offscreenProps: OffscreenProps = {
            mode: 'hidden',
            children: primaryChildren
        }
        const offscreenFiber = createFiberFromOffscreen(offscreenProps);
        const fragmentFiber = createFiberFromFragment(fallbackChildren, null);

        fragmentFiber.flags |= Placement;

        offscreenFiber.return = fragmentFiber.return = wip;
        offscreenFiber.sibling = fragmentFiber;
        wip.child = offscreenFiber;

        return fragmentFiber; // 这里不返回 offscreenFiber
    }
    function mountWithOffscreen(
        wip: FiberNode,
        primaryChildren: any
    ) {
        const offscreenProps: OffscreenProps = {
            mode: 'visible',
            children: primaryChildren
        }
        const offscreenFiber = createFiberFromOffscreen(offscreenProps);
        wip.child = offscreenFiber;
        offscreenFiber.return = wip;
        return offscreenFiber;
    }
    /**
     * if new status is fallback when <Suspense/> updates
     * @param suspenseWip 
     * @param offscreenChildren 
     * @param fallbackChildren 
     * @returns 
     */
    function updateToFallback(
        suspenseWip: FiberNode,
        offscreenChildren: any,
        fallbackChildren: any
    ) {
        const current = (suspenseWip.alternate) as FiberNode;
        const currentOffscreenFiber = (current.child) as FiberNode;
        const currentFragmentFiber = currentOffscreenFiber?.sibling;
    
        const offscreenProps: OffscreenProps = {
            mode: 'hidden',
            children: offscreenChildren
        }
    
        const offscreenFiber = createWorkInProgress( // 复用
            currentOffscreenFiber,
            offscreenProps
        );
    
        let fragmentFiber = null;
        if (currentFragmentFiber !== null) {
            fragmentFiber = createWorkInProgress(
                currentFragmentFiber,
                fallbackChildren // 对于 fragment props 就是 children，普通节点的话
                // props.children 才是 children
            );
        } else {
            fragmentFiber = createFiberFromFragment(fallbackChildren, null);
            fragmentFiber.flags |= Placement;
        }

        offscreenFiber.return = fragmentFiber.return = suspenseWip;
        offscreenFiber.sibling = fragmentFiber;
        suspenseWip.child = offscreenFiber;

        return fragmentFiber;
    }
    /**
     * the new status is offscreen when <Suspense/> updates
     * @param suspenseWip 
     * @param offscreenChildren 
     * @returns 
     */
    function updateToOffscreen(
        suspenseWip: FiberNode,
        offscreenChildren: any
    ) {
        const current = (suspenseWip.alternate) as FiberNode;
        const currentOffscreenFiber = (current.child) as FiberNode;
        const currentFragmentFiber = currentOffscreenFiber?.sibling;
    
        const offscreenProps: OffscreenProps = {
            mode: 'visible',
            children: offscreenChildren
        }
    
        const offscreenFiber = createWorkInProgress( // 复用
            currentOffscreenFiber,
            offscreenProps
        );
    
        let fragmentFiber = null;
        if (currentFragmentFiber !== null) {
            const deletions = wip.deletions;
            if (deletions === null) {
                wip.deletions = [currentFragmentFiber];
                wip.flags |= ChildDeletion;
            } else {
                deletions.push(currentFragmentFiber)
            }
        }

        offscreenFiber.return = suspenseWip;
        offscreenFiber.sibling = null;
        suspenseWip.child = offscreenFiber;

        return offscreenFiber;
    }
}

function beginWorkOnOffscreen(wip: FiberNode) {
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
