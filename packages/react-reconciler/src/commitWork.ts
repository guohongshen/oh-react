import { Container, appendChildToContainer, commitUpdate, removeChild } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { ChildDeletion, MutationMask, NoFlags, Placement, Update } from "./fiberFlags";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { ExecFileOptionsWithBufferEncoding } from "child_process";

let nextEffect: FiberNode | null = null;

export function commitMutationEffects(finishedWork: FiberNode) {
    nextEffect = finishedWork;

    while (nextEffect !== null) {
        // 向下遍历
        const child: FiberNode | null = nextEffect.child;

        if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
            nextEffect = child;
        } else {
            // 向上遍历 DFS
            up: while (nextEffect !== null) {
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
        console.warn('执行 Placement 操作', finishedWork);
        // debugger;
    }
    // 找到 parent DOM
    const hostParent = getHostParent(finishedWork);
    // finishedWork ~ DOM
    if (hostParent !== null) {
        appendPlacementNodeIntoContainer(finishedWork, hostParent);
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
                // TODO useEffect unmount:
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
        const hostParent = getHostParent(childToDelete);
        // 单一节点，只考虑有一个子树的情况
        (hostParent !== null) && removeChild(rootHostNode, hostParent);
    }
    childToDelete.return = null;
    childToDelete.child = null;
}

function commitNestedComponent(
    root: FiberNode,
    onCommitUnmount: (fiber: FiberNode) => void
) {
    /*let node = root;
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
    }*/
    let node = root;
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

function appendPlacementNodeIntoContainer(finishedWork: FiberNode, hostParent: Container) {
    // fiber host
    if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
        appendChildToContainer(finishedWork.stateNode, hostParent);
        return;
    }
    const child = finishedWork.child;
    if (child !== null) {
        appendPlacementNodeIntoContainer(child, hostParent);
        let sibling = child.sibling;

        while (sibling !== null) {
            appendPlacementNodeIntoContainer(sibling, hostParent);
            sibling = sibling.sibling;
        }
    }
}
