import { Container, Instance, appendInitialChild, createInstance, createTextInstance } from "hostConfig";
import { FiberNode } from "./fiber";
import { WorkTag } from "./workTags";
import { NoFlags, Ref, Update, Visibility } from "./fiberFlags";
import { popContextValue } from "./fiberContext";
import { popSuspenseFiber } from "./suspenseStack";
import { NoLanes } from "./fiberLanes";
// import { injectProps } from "react-dom/src/SyntheticEvent";

export function markUpdate(fiber: FiberNode) {
    fiber.flags |= Update;
}

export function markRef(fiber: FiberNode) {
    fiber.flags |= Ref;
}

export function completeWork(wip: FiberNode) {
    // 递归中的归

    const newProps = wip.pendingProps;
    const current = wip.alternate;

    switch (wip.tag) {
        case WorkTag.HostComponent:
            if (current !== null && wip.stateNode) {
                // TODO 这里应该按照下面两点分别对比，如果发生了变化再给打上 Update。但时间不够，所以简单粗暴直接给打上 Update
                // 1. props 是否变化 { onCLick: xx } { onCLick: xxx }
                // wip.updateQueue = [k, v, k, v, ...]
                // 2. 变 Update flag
                // className style 等
                markUpdate(wip);

                // 标记 Ref
                if (current.ref !== wip.ref) {
                    markRef(wip);
                }
            } else {
                // 1. 构建 DOM
                const instance = createInstance(wip.type, newProps);
                // 2. 将 DOM 插入到 DOM 树中
                appendAllRealSubtreeRootDOMNodes(instance, wip);
                wip.stateNode = instance;
                // 标记 Ref
                if (wip.ref !== null) {
                    markRef(wip);
                }
            }
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.HostText:
            if (current !== null && wip.stateNode) {
                // update
                const oldText = current.memoizedProps.content;
                const newText = newProps.content;
                if (oldText !== newText) {
                    markUpdate(wip);
                }
            } else {
                // 1. 构建 DOM
                const instance = createTextInstance(newProps.content);
                wip.stateNode = instance;
            }
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.HostRoot:
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.FunctionComponent:
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.Fragment:
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.ContextProvider:
            popContextValue(wip.type._context)
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.Suspense:
            // 下面这段逻辑不能写在 Offscreen，因为 Suspense 的 beginWork 有可能返回
            // 的是 Fragment，那么 completeWork 就走不到 Offscreen，那例如就不能对其
            // 子树的顶层 host 节点进行 "display:none" 操作了。
            const offscreenFiber = wip.child as FiberNode;
            const isHidden = offscreenFiber.pendingProps.mode === "hidden";
            const currentOffscreenFiber = offscreenFiber.alternate;

            if (currentOffscreenFiber !== null) {
                // update
                const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';
                if (isHidden !== wasHidden) {
                    offscreenFiber.flags |= Visibility;
                    updateSubtreeFlagsAndChildLanes(wip);
                }
            } else if (isHidden) { // mount, "hidden"
                offscreenFiber.flags |= Visibility; // QUESTION 我感觉这里不太需要加这个
                // 因为 mount 且 hidden 的话，就没有 children，就更不需要对 host 节
                // 点进行 display 处理了。
                updateSubtreeFlagsAndChildLanes(wip);
            }
            updateSubtreeFlagsAndChildLanes(wip);

            popSuspenseFiber();
        case WorkTag.Offscreen:
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        case WorkTag.Memo:
            updateSubtreeFlagsAndChildLanes(wip);
            return null;
        default:
            if (__DEV__) {
                console.warn('未处理的 completeWork 情况', );
            }
            return null;
    }
}

/**
 * 首先明确下 wip.stateNode 为 parent。这个函数的作用是：将 wip 的直接真实子树的根的
 * DOM 节点依次添加到 wip.stateNode.children 中来。
 * 注：1. 真实子树：树的根节点是 HostComponent 或者 HostText；2. 直接真实子树，在从
 * 该子树的根节点到 wip 的祖先链上不再有其他的真实节点。
 * 原名：appendAllChildren
 * @param parent 
 * @param wip 
 * @returns 
 */
function appendAllRealSubtreeRootDOMNodes(parent: Container | Instance, wip: FiberNode) {
    let node = wip.child;

    while (node !== null) {
        if (node.tag === WorkTag.HostComponent || node.tag === WorkTag.HostText) {
            appendInitialChild(parent, node?.stateNode);
            // 这里 append 之后，可以看成是 node.child === null，因为这个子树下面的
            // 子节点在执行 completeWork 已经做了这些工作了。
        } else if (node.child !== null) {
            node.child.return = node;
            node = node.child;
            continue;
        }

        if (node === wip) {
            return;
        }

        while (node.sibling === null) {
            if (node.return === null || node.return === wip) {
                return;
            }
            node = node?.return;
        }
        node.sibling.return = node.return;
        node = node.sibling;
    }
}

/**
 * 做两件事：
 * <1> 将 wip.childLanes 设置为所有子节点的 childLanes 和 lanes 的合并；
 * <2> 将 wip.subtreeFlags 设置为所有子节点的 subtreeFlags 和 flags 的合并，也即所有后
 * 代节点的 flags 的合并。通俗理解为：flags 冒泡，因为程序操作上是对子节点进行冒泡，所
 * 以每次执行 completeWork 时都要调用一次冒泡。原名：bubbleProperties
 * @param wip 
 */
function updateSubtreeFlagsAndChildLanes(wip: FiberNode) {
    let subtreeFlags = NoFlags;
    let child = wip.child;
    let childLanes = NoLanes;

    while (child !== null) {
        subtreeFlags |= child.subtreeFlags;
        subtreeFlags |= child.flags;

        childLanes |= child.lanes;
        childLanes |= child.childLanes;

        child.return = wip;
        child = child.sibling;
    }

    wip.subtreeFlags |= subtreeFlags;
    wip.childLanes = childLanes;
}
