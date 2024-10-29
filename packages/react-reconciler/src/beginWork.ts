import { ReactElement } from "shared/ReactTypes";
import { FiberNode, OffscreenProps, createFiberFromFragment, createFiberFromOffscreen, createWorkInProgress } from "./fiber";
import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { WorkTag } from "./workTags";
import { cloneChildFibers, createFiberFromElement, mountChildFibers, reconcileChildFibers } from "./childFibers";
import { bailoutHook, renderWithHooks } from "./fiberHooks";
import { Lane, NoLane, NoLanes, includeLanes } from "./fiberLanes";
import { ChildDeletion, DidCapture, NoFlags, Placement, Ref } from "./fiberFlags";
import { prepareToReadContext, propagateContextChange, pushContextValue } from "./fiberContext";
import { pushSuspenseFiber } from "./suspenseStack";
import { shallowEqual } from "shared/shallowEquals";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";

/**
 * 即没有命中 bailout 策略。didReceiveUpdate 意为接受更新。
 */
let didReceiveUpdate = false;
export function markWipReceiveUpdate() {
    didReceiveUpdate = true;
}

// 递归中的递阶段
export function beginWork(wip: FiberNode, renderLane: Lane) {
    didReceiveUpdate = false;
    const current = wip.alternate;
    // bailout 策略 之 第一次判断：
    if (current !== null) {
        const oldProps = current.memoizedProps;
        const newProps = wip.pendingProps;

        if (
            oldProps !== newProps || // 对于 hostRootFiber 来讲，新旧 props 永远不相等，
            // 因为每次 renderRoot 都会，prepareFreshStack，里面会调用 createWorkInProgress，
            // 参数传入一个空的 props 对象，所以把 hostRoot 的 bailout 逻辑加在了 beginWorkOnHostRoot
            // 里面。
            current.type !== wip.type
        ) { // 四要素之 props、type 改变了
            didReceiveUpdate = true;
        } else { // 四要素之 props、type 不变
            const hasRenderLane = doesFiberLanesIncludeRenderLane( // 四要素之 state context 不变
                current,
                renderLane
            );
            if (!hasRenderLane) {
                // 命中 bailout
                didReceiveUpdate = false; // 赋不赋值都行，反正之后都 return 了

                switch (wip.tag) {
                    case WorkTag.ContextProvider:
                        const newValue = wip.memoizedProps.value;
                        const context = wip.type._context;
                        pushContextValue(context, newValue);
                        // TODO 应该比较下新旧  context value，看下是否变化
                        // 如果变化了，需要将用到的子节点都启动更新。
                        break;
                    // TODO Suspense 也要入下栈
                }
                return bailoutOnAlreadyFinishedWork(
                    wip,
                    renderLane
                );
            }
            // hasUpdateWithRenderLane 为 true 的话，先不要急着把 cannotBailout 置为 true
            // 因为有可能计算出来的 state 等于旧的 state。所以在第二次判断(具体在 renderWithHook)
            // 里如果新旧 state 相等，再把 cannotBailout 置为 false。

            // TODO 如果 Context value 变化，需要给其下的消费者都打上 renderLane
        }
    }
    // 第一次判断如果无法 bailout，就需要在 beginWorkOnXxx 内进行更具体的第二次判断。

    wip.lanes = NoLanes; // 先置空，后面把跳过的更新的 lane 再加进来就好了

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
            return beginWorkOnContextProvider(wip, renderLane);
        case WorkTag.Suspense:
            return beginWorkOnSuspense(wip);
        case WorkTag.Offscreen:
            return beginWorkOnOffscreen(wip);
        case WorkTag.Memo:
            return beginWorkOnMemo(wip, renderLane);
        default:
            if (__DEV__) {
                console.warn('beginWork 未实现的类型', wip);
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

    const prevChildren = wip.memoizedState;

    const res = processUpdateQueue(baseState, pending, renderLane);
    wip.memoizedState = res.memoizedState;

    const current = wip.alternate;
    // 考虑 RootDidNotComplete 的情况，需要复用 memoizedState QUESTION 这里没看懂做什么的
    if (current !== null) {
        if (!current.memoizedState) {
            current.memoizedState = res.memoizedState
        }
    }

    const nextChildren = wip.memoizedState;
    if (prevChildren === nextChildren) { // 如果用户只在初始时调用了一次 createRoot()
        // 的 render 方法，那么之后每一次更新 hostRootFiber 的 updateQueue 都为空，
        // processUpdateQueue 返回的就初始时计算出来的 memoizedState。memoizedState 是 children

        return bailoutOnAlreadyFinishedWork(
            wip,
            renderLane
        );
    }
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
    prepareToReadContext(wip, renderLane);
    const nextChildren = renderWithHooks(wip, renderLane);

    const current = wip.alternate;
    if (current !== null && !didReceiveUpdate) {
        // 这里可能乍一看有点迷，梳理下：对于 FunctionComponent，第一次判断时如果命中
        // 则 bailout，不能则将 cannotBailout 置为 true，
        // 然后在 beginWorkOnFunctionComponent 进行第二次判断，renderWithHook 里面
        // 计算 state 的时候如果计算出来的 state 改变了，则将 cannotBailout 置为 true
        bailoutHook(wip, renderLane);
        return bailoutOnAlreadyFinishedWork(
            wip,
            renderLane
        );
    }

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

function beginWorkOnContextProvider(wip: FiberNode, renderLane: Lane) {
    const provider = wip.type;
    const context = provider._context;
    const nextProps = wip.pendingProps;

    const oldProps = wip.memoizedProps;
    const newValue = nextProps.value;

    pushContextValue(context, newValue);
    if (oldProps !== null) {
        const oldValue = oldProps.value;
        if (
            Object.is(oldValue, newValue) &&
            oldProps.children === nextProps.children // 如果 children 变了的话，就需要走 reconcile 了
            // 所以可以把 children 走手动 bailout 逻辑，也即用 useMemo 包一下
        ) {
            return bailoutOnAlreadyFinishedWork(wip, renderLane);
        } else {
            propagateContextChange(wip, context, renderLane);
        }
    }

    const nextChildren = nextProps.children;
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function beginWorkOnSuspense(wip: FiberNode) {
    const current = wip.alternate;
    const nextProps = wip.pendingProps;

    let showFallback = false;
    const isSuspended = (wip.flags & DidCapture) !== NoFlags;

    if (isSuspended) {
        showFallback = true;
        wip.flags &= ~DidCapture; // QUESTION: 为什么要去掉 DidCapture 呢？思考详见 ./thenable.ts
    }
    const newOffscreenChildren = nextProps.children;
    const newFragmentChildren = nextProps.fallback;

    pushSuspenseFiber(wip);

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
        offscreenChildren: any,
        fallbackChildren: any
    ) {
        const offscreenProps: OffscreenProps = {
            mode: 'hidden',
            children: offscreenChildren
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
        offscreenChildren: any
    ) {
        const offscreenProps: OffscreenProps = {
            mode: 'visible',
            children: offscreenChildren
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

        // QUESTION kasong 这里是不是应该对子节点的 return 更新下，不然之后 hideOrUnhide 
        // 的时候会回归不到 Offscreen
        if (currentOffscreenFiber.child) {
            let curOffscreenChildFiber: FiberNode | null = currentOffscreenFiber.child;
            while (curOffscreenChildFiber !== null) {
                curOffscreenChildFiber.return = offscreenFiber;
                curOffscreenChildFiber = curOffscreenChildFiber.sibling;
            }
            currentOffscreenFiber.child = null;
        }

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

function beginWorkOnMemo(wip: FiberNode, renderLane: Lane) {
    const current = wip.alternate;
    const nextProps = wip.pendingProps;
    let newChildFiber = null;

    if (current !== null) {
        const currentChild = current.child as FiberNode;
        const prevProps = currentChild.memoizedProps;
        if (
            shallowEqual(prevProps, nextProps) &&
            current.ref === wip.ref
        ) {
            didReceiveUpdate = false;
            return bailoutOnAlreadyFinishedWork(
                wip,
                renderLane
            );
        }
        newChildFiber = createWorkInProgress(
            currentChild,
            nextProps
        );
        newChildFiber.ref = wip.ref;
        newChildFiber.return = wip;
        wip.child = newChildFiber;
        return newChildFiber;
    }
    newChildFiber = createFiberFromElement({
        $$typeof: REACT_ELEMENT_TYPE,
        type: wip.type.type,
        props: nextProps,
        key: wip.key,
        ref: wip.ref,
        __mark: 'hongshen.guo'
    });
    // 注意：React 17 这里是直接调用 beginWorkOnFunctionComponent(wip)，也即 memo
    // 和被包裹的组件公用一个 fiber，big-react 也是这种实现；React 18 不是共用的，是各
    // 有各的 fiber，我这里采用的是这种。
    newChildFiber.ref = wip.ref;
    newChildFiber.return = wip;
    wip.child = newChildFiber;
    return newChildFiber;
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

/**
 * fiber.lanes 是否包含 renderLane。
 * 原名：checkScheduledUpdateOrContext，原名的意思是 current 上是否有优先级为 renderLane
 * 的 update 或者有优先级为 renderLane 的 context 更新。当某次优先级为 lane 的更新进行
 * 时，某个 context 值发生了改变，那么使用了该 context 的 fiber 的 lanes 就会被添加
 * lane，组件就需要重新 render。所以原名起得没问题，组件存在更新需要 render，这种更新可
 * 能是 update 引起的，有可能是 context 引起的。
 * @param current 
 * @param renderLane 
 * @returns 
 */
function doesFiberLanesIncludeRenderLane(current: FiberNode, renderLane: Lane): boolean {
    const updateLanes = current.lanes;
    if (includeLanes(updateLanes, renderLane)) {
        return true;
    }
    return false;
}

/**
 * 根据 wip.childLanes 是否包含 renderLanes 决定仅仅 bailout 该 wip 节点还是 bailout
 *  整个 wip 树。
 * @param wip 
 * @param renderLane 
 * @returns 
 */
function bailoutOnAlreadyFinishedWork(
    wip: FiberNode,
    renderLane: Lane
) {
    if (!includeLanes(wip.childLanes, renderLane)) { // 那么整个子树都可以跳过
        if (__DEV__) {
            console.warn('bailout 整颗子树', wip);
        }
        return null;
    }
    if (__DEV__) {
        console.warn('bailout 一个 fiber', wip);
    }
    return cloneChildFibers(wip);
}
