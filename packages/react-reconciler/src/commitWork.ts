import { Container, Instance, appendChildToContainer, commitUpdate, insertBefore, removeChild } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { ChildDeletion, MutationMask, NoFlags, Placement, Update } from "./fiberFlags";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { ExecFileOptionsWithBufferEncoding } from "child_process";

let nextEffect: FiberNode | null = null;

/**
 * 利用 DFS 和 subtreeFlags 完成 mutation。
 * @param finishedWork 
 */
export function commitMutationEffects(finishedWork: FiberNode) {
    nextEffect = finishedWork;
    // 两个 while 实现 DFS:
    while (nextEffect !== null) { // 这个 while 是用来向下遍历的
        const child: FiberNode | null = nextEffect.child;

        if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
            nextEffect = child;
        } else {
            up: while (nextEffect !== null) { // 这个 while 是用来向上遍历的
                commitMutationEffectsOnFiber(nextEffect);
                const sibling: FiberNode | null = nextEffect.sibling;
                if (sibling) {
                    nextEffect = sibling;
                    break up;
                }
                nextEffect = nextEffect.return;
            }
        }
    }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode) {
    const flags = finishedWork.flags;
    if ((flags & Placement) !== NoFlags) {
        commitPlacement(finishedWork);

        finishedWork.flags &= ~Placement; // 移除 Placement
    }
    if ((flags & Update) !== NoFlags) {
        commitUpdate(finishedWork);

        finishedWork.flags &= ~Update; // 移除 Update
    }
    if ((flags & ChildDeletion) !== NoFlags) {
        const deletions = finishedWork.deletions;
        if (deletions !== null) {
            deletions.forEach(child => {
                commitDeletion(child);
            });
        }
        
        finishedWork.flags &= ~ChildDeletion; // 移除 ChildDeletion
    }
}

function commitPlacement(finishedWork: FiberNode) {
    if (__DEV__) {
        // console.warn('执行 Placement 操作', finishedWork);
        // debugger;
    }
    // 找到 parent DOM
    const hostParent = getHostParent(finishedWork);

    // host sibling
    const hostSibling = getHostSibling(finishedWork);

    // finishedWork ~ DOM
    if (hostParent !== null) {
        insertBeforeOrAppendPlacementNodeIntoContainer(
            finishedWork,
            hostParent,
            hostSibling
        );
    }
}

/**
 * 也即：移除以 childToDelete 为根节点的子树。由于子树中：
 * <1> 对于 FC，需要处理 useEffect unmount 执行、解绑 ref；
 * <2> 对于 HostComponent，需要解绑 ref；
 * <3> 对于子树中所有以 HostComponent 为根的子树，需要移除其根的 DOM 节点；
 * 那么本函数(commitDeletion)一定是递归的，递归的遍历这棵子树。
 * @param childToDelete 
 */
function commitDeletion(childToDelete: FiberNode) {
    let rootHostNode: FiberNode | null = null;
    // 递归子树
    commitNestedComponent(childToDelete, unmountFiber => {
        switch (unmountFiber.tag) {
            case HostComponent:
                if (rootHostNode === null) {
                    rootHostNode = unmountFiber; // QUESTION
                }
                // TODO 解绑 ref
                return;
            case HostText:
                if (rootHostNode === null) {
                    rootHostNode = unmountFiber; // QUESTION
                }
                return;
            case FunctionComponent:
                // TODO useEffect、unmount、解绑 ref
                return;
            default:
                if (__DEV__) {
                    console.warn('未处理的 unmount 类型');
                }
                break;
        }
    });

    // 移除 rootHostNode 的 DOM
    if (rootHostNode !== null) {
        const hostParent = getHostParent(childToDelete); // child text
        (window as any).getHostParent = getHostParent;
        // 单一节点，只考虑有一个子树的情况
        if (hostParent !== null) {
            removeChild((rootHostNode as FiberNode).stateNode, hostParent);
        }
    }
    childToDelete.return = null;
    childToDelete.child = null;
}

function commitNestedComponent(
    root: FiberNode,
    onCommitUnmount: (fiber: FiberNode) => void
) {
    let node = root;
    while (true) {
        onCommitUnmount(node);

        if (node.child !== null) {
            node.child.return = node;
            node = node.child;
            continue;
        }
        if (node === root) {
            return;
        }
        while (node.sibling === null) {
            if (node.return === null || node.return === root) {
                return;
            }
            node = node.return;
        }
        node.sibling.return = node.return;
        node = node.sibling;
    }
    /*node = root;
    function toLeave(n: FiberNode) {
        while (n.child !== null) {
            n = n.child;
        }
        return n;
    };
    node = toLeave(node);
    // node 现在是叶子节点
    while (true) {
        onCommitUnmount(node);
        if (node === root) return;
        if (node.sibling !== null) {
            node = toLeave(node.sibling);
            continue;
        } else {
            if (node.return === null) { // 应付类型检查
                return;
            } else {
                node = node.return;
            }
        }
    }*/
}

/**
 * 返回 fiber 的「后驱 Host 节点，后驱肯定就要求是兄弟了」，不稳定的除外。不稳定是指携
 * 带 Placement flag。
 * @param fiber 
 */
function getHostSibling(fiber: FiberNode): Instance | null {
    let node = fiber;
    function isStable(fiber: FiberNode) {
        return (fiber.flags & Placement) === NoFlags;
    }
    findSibling: while (true) {
        while (node.sibling === null) {
            const parent = node.return;
            if (parent === null ||
                parent.tag === HostComponent || // QUESTION
                parent.tag === HostRoot // HostRot 没有兄弟节点，所以不用找了
            ) {
                return null;
            }
            node = parent;
        }
        node.sibling.return = node.return;
        node = node.sibling;
        
        while (node.tag !== HostText && node.tag !== HostComponent) {
            // 向下遍历
            if (!isStable(node)) {
                continue findSibling;
            }
            if (node.child === null) {
                continue findSibling;
            } else {
                node.child.return = node;
                node = node.child;
            }
        }

        // HostText or HostComponent
        if (isStable(node)) {
            return node.stateNode;
        }
    }
}

function getHostParent(fiber: FiberNode): Container | null {
    let parent = fiber.return;

    while (parent) {
        const parentTag = parent.tag;
        // hostComponent
        // hostRoot
        if (parentTag === HostComponent) {
            return parent.stateNode;
        }
        if (parentTag === HostRoot) {
            return (parent.stateNode as FiberRootNode).container;
        }
        parent = parent.return;
    }
    if (__DEV__) {
        console.warn('未找到 host parent');
    }
    return null;
}

function insertBeforeOrAppendPlacementNodeIntoContainer(
    finishedWork: FiberNode,
    hostParent: Container,
    hostSibling?: Instance | null
) {
    // fiber host
    if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
        if (hostSibling) {
            insertBefore(
                hostParent,
                finishedWork.stateNode,
                hostSibling
            );
        } else {
            appendChildToContainer(finishedWork.stateNode, hostParent);
        }
        return;
    }
    const child = finishedWork.child;
    if (child !== null) {
        insertBeforeOrAppendPlacementNodeIntoContainer(
            child,
            hostParent
        );
        let sibling = child.sibling;

        while (sibling !== null) {
            insertBeforeOrAppendPlacementNodeIntoContainer(
                sibling,
                hostParent
            );
            sibling = sibling.sibling;
        }
    }
}
