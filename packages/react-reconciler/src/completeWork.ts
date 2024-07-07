import { Container, Instance, appendInitialChild, createInstance, createTextInstance } from "hostConfig";
import { FiberNode } from "./fiber";
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { NoFlags, Update } from "./fiberFlags";
// import { injectProps } from "react-dom/src/SyntheticEvent";

export function markUpdate(fiber: FiberNode) {
    fiber.flags |= Update;
}

export function completeWork(wip: FiberNode) {
    // 递归中的归

    const newProps = wip.pendingProps;
    const current = wip.alternate;

    switch (wip.tag) {
        case HostComponent:
            if (current !== null && wip.stateNode) {
                // update
                // 1. props 是否变化 { onCLick: xx } { onCLick: xxx }
                // wip.updateQueue = [k, v, k, v, ...]
                // 2. 变 Update flag
                // className style 等
                markUpdate(wip);
                // injectProps(wip.stateNode, newProps);
            } else {
                // 1. 构建 DOM
                const instance = createInstance(wip.type, newProps);
                // 2. 将 DOM 插入到 DOM 树中
                appendAllChildren(instance, wip);
                wip.stateNode = instance;
            }
            bubbleProperties(wip);
            return null;
        case HostText:
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
            bubbleProperties(wip);
            return null;
        case HostRoot:
            bubbleProperties(wip);
            return null;
        case FunctionComponent:
            bubbleProperties(wip);
            return null;
        case Fragment:
            bubbleProperties(wip);
            return null;
        default:
            if (__DEV__) {
                console.warn('未处理的 completeWork 情况');
            }
            return null;
    }
}

/**
 * 首先明确下 wip.stateNode 为 parent。这个函数的作用是：将 wip 的直接真实子树的根的
 * DOM 节点依次添加到 wip.stateNode.children 中来。
 * 注：1. 真实子树：树的根节点是 HostComponent 或者 HostText；2. 直接真实子树，在从
 * 该子树的根节点到 wip 的祖先链上不再有其他的真实节点。
 * @param parent 
 * @param wip 
 * @returns 
 */
function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
    let node = wip.child;

    while (node !== null) {
        if (node.tag === HostComponent || node.tag === HostText) {
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
 * 将 wip.subtreeFlags 设置为所有子节点的 subtreeFlags 以及 flags 的合并，也即所有后
 * 代节点的 flags 的合并。通俗理解为：flags 冒泡，因为程序操作上是对子节点进行冒泡，所
 * 以每次执行 completeWork 时都要调用一次冒泡。
 * @param wip 
 */
function bubbleProperties(wip: FiberNode) {
    let subtreeFlags = NoFlags;
    let child = wip.child;

    while (child !== null) {
        subtreeFlags |= child.subtreeFlags;
        subtreeFlags |= child.flags;

        child.return = wip;
        child = child.sibling;
    }

    wip.subtreeFlags |= subtreeFlags;
}
