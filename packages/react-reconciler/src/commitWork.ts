import { Container, appendChildToContainer } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";

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
    // TODO: flags Update
    // TODO: flags ChildDeletion
}

function commitPlacement(finishedWork: FiberNode) {
    if (__DEV__) {
        console.warn('执行 DOM 操作', finishedWork);
    }
    // 找到 parent DOM
    const hostParent = getHostParent(finishedWork);
    // finishedWork ~ DOM
    appendPlacementNodeIntoContainer(finishedWork, hostParent);
}

function getHostParent(fiber: FiberNode): Container {
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
