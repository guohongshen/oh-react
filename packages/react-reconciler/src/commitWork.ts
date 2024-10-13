import { Container, Instance, appendChildToContainer, commitUpdate, hideInstance, hideTextInstance, insertBefore, removeChild, unhideInstance, unhideTextInstance } from "hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import { ChildDeletion, Flags, EffectMaskDuringMutation, NoFlags, PassiveEffect, PassiveMask, Placement, Update, EffectMask, Ref, Visibility } from "./fiberFlags";
import { WorkTag } from "./workTags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTag";

let fiber: FiberNode | null = null;

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
        insertBeforeSiblingOrAppendIntoParent(
            finishedWork,
            hostParent,
            hostSibling
        );
    }
}

/**
 * 也即：移除以 childToDelete 为根节点的子树。深度优先前序遍历这颗树：
 * <1> 对于 FC，需要处理 useEffect unmount 执行、解绑 ref；
 * <2> 对于 HostComponent，需要解绑 ref；
 * 同时将这颗树中所有的最大真实非严格子树的根节点的 stateNode 从 hostParent 中删除。
 * 注：所有的最大真实非严格子树：对于一个真实非严格子树，从它的根开始到 childToDelete，
 * 不存在第二个真实节点（host 类型的 fiber），非严格子树意思是一个是树也是自己的子树，
 * 暂时这么规定下。
 * @param childToDelete 
 */
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
    // 前序遍历这颗树：
    let node = childToDelete; // 把 childToDelete 看成 root
    /**
     * roots of trees which's root is a host type fiber, 之后只需要在对这些 roots 在 DOM 那边做下删除就可以了
     */
    let rootsOfTreesWithHostFiberToDelete = [];
    /**
     * 我也不知道怎么命名，反正是遇到第一个最大真实非严格子树的根节点时，把节点赋值给 temp，当遍历到离开这个树时 temp 为 null
     */
    let temp = null;
    debugger;
    outer: do {
        // 做 unmount 处理：
        switch (node.tag) {
            case WorkTag.HostComponent:
                unbindRef(childToDelete);
                if (temp === null) { // 说明本节点是最大真实非严格子树的根节点
                    temp = node;
                    rootsOfTreesWithHostFiberToDelete.push(node);
                }
                break;
            case WorkTag.HostText:
                if (!temp) { // 说明本节点是最大真实非严格子树的根节点
                    temp = node;
                    rootsOfTreesWithHostFiberToDelete.push(node);
                }
                break;
            case WorkTag.FunctionComponent:
                // useEffect、unmount、解绑 ref
                commitPassiveEffect(node, root, 'unmount');
                break;
            default:
                if (__DEV__) {
                    console.warn('未处理的 unmount 类型', node);
                }
                break;
        }
        
        if (node.child !== null) {
            node = node.child; // 向下递
        } else if (node.sibling !== null) {
            node = node.sibling;
            // level 不变
        } else {
           inner: while (true) { // 内层循环是为了跳过已经做过 unmount 处理的节点，这个过程是向上的归，同时寻找未被 unmount 的节点以继续外层循环
                if (node === childToDelete) break outer;
                if (node.sibling !== null) {
                    node = node.sibling;
                    break inner;
                } else {
                    node = node.return as FiberNode;
                    if (node === temp) temp = null;
                }
            }
        }
    } while (true) // 外层循环每循环一次就执行一次 unmount 处理，所以循环次数等于树的节点数

    // 移除 rootHostNode 的 DOM
    if (rootsOfTreesWithHostFiberToDelete.length !== 0) {
        const hostParent = getHostParent(childToDelete); // child text
        if (hostParent !== null) {
            rootsOfTreesWithHostFiberToDelete.forEach(childToDelete => {
                removeChild((childToDelete).stateNode, hostParent);
            });
        }
    }
    childToDelete.return = null;
    childToDelete.child = null;
}

function commitPassiveEffect(
    fiber: FiberNode,
    root: FiberRootNode,
    type: keyof PendingPassiveEffects
) {
    // 常规的类型检查
    if (
        fiber.tag !== WorkTag.FunctionComponent || // 非函数组件
        (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags) // type 为 update，却没有 PassiveEffect 标志，属于异常
    ) {
        return;
    }
    
    const updateQueue = fiber.updateQueue as FCUpdateQueue;
    if (updateQueue !== null) {
        if (updateQueue.lastEffect === null) {
            __DEV__ && console.warn('当 FC 存在 PAssiveEffect flag 时，不应该不存在 lastEffect');
        } else {
            root.pendingPassiveEffects[type].push(
                updateQueue.lastEffect // 只需要 push lastEffect 就行了，因为
                // lastEffect 对应的是那条环状链表，之后我们再遍历那条环状链表就能执行
                // 这个函数组件下所有的 effect 回调。
            );
        }
    }
}

function commitHookEffectList(
    flags: Flags,
    lastEffect: Effect,
    callback: (effect: Effect) => void
) {
    let effect = lastEffect.next as Effect;

    do {
        if ((effect.tag & flags) === flags) {
            callback(effect);
        }
        effect = effect.next as Effect;
    } while (effect !== lastEffect.next);
}

/**
 * 执行组件卸载时才会执行的 destroy（也即依赖数组为空的 effect hook 的 destroy）
 * @param flags 
 * @param lastEffect 
 * @param callback 
 */
export function commitHookEffectListUnmount(
    flags: Flags,
    lastEffect: Effect
) {
    commitHookEffectList(flags, lastEffect, effect => {
        const destroy = effect.destroy;
        if (typeof destroy === 'function') {
            destroy();
        }
        effect.tag &= ~ HookHasEffect; // 既然已经卸载，就不需要后续的触发流程了
    });
}

/**
 * 触发所有上次更新的 destroy，destroy 对应依赖数组不为空的 effect hook 的 destroy
 * @param flags 
 * @param lastEffect 
 */
export function commitHookEffectListDestroy(
    flags: Flags,
    lastEffect: Effect
) {
    commitHookEffectList(flags, lastEffect, effect => {
        const destroy = effect.destroy;
        if (typeof destroy === 'function') {
            destroy();
        }
    });
}

/**
 * 执行所有的 create
 * @param flags 
 * @param lastEffect 
 */
export  function commitHookEffectListCreate(
    flags: Flags,
    lastEffect: Effect
) {
    commitHookEffectList(flags, lastEffect, effect => {
        const create = effect.create;
        if (typeof create === 'function') {
            effect.destroy = create();
        }
        effect.tag &= ~ HookHasEffect;
    });
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
                parent.tag === WorkTag.HostComponent || // QUESTION
                parent.tag === WorkTag.HostRoot // HostRot 没有兄弟节点，所以不用找了
            ) {
                return null;
            }
            node = parent;
        }
        node.sibling.return = node.return;
        node = node.sibling;
        
        while (node.tag !== WorkTag.HostText && node.tag !== WorkTag.HostComponent) {
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
        if (parentTag === WorkTag.HostComponent) {
            return parent.stateNode;
        }
        if (parentTag === WorkTag.HostRoot) {
            return (parent.stateNode as FiberRootNode).container;
        }
        parent = parent.return;
    }
    if (__DEV__) {
        console.warn('未找到 host parent');
    }
    return null;
}

function insertBeforeSiblingOrAppendIntoParent(
    finishedWork: FiberNode,
    hostParent: Container,
    hostSibling?: Instance | null
) {
    // fiber host
    if (finishedWork.tag === WorkTag.HostComponent || finishedWork.tag === WorkTag.HostText) {
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
        insertBeforeSiblingOrAppendIntoParent(
            child,
            hostParent
        );
        let sibling = child.sibling;

        while (sibling !== null) {
            insertBeforeSiblingOrAppendIntoParent(
                sibling,
                hostParent
            );
            sibling = sibling.sibling;
        }
    }
}

/**
 * 将 instance 绑定到 ref。
 * 原名：safelyAttachRef
 */
function bindRef(fiber: FiberNode) {
    const ref = fiber.ref;
    if (ref !== null) {
        const instance = fiber.stateNode;
        if (typeof ref === 'function') {
            ref(instance);
        } else {
            ref.current = instance;
        }
    }
}
/**
 * 解绑 ref。
 * 原名：safelyDetachRef
 * @param fiber 
 */
function unbindRef(currentFiber: FiberNode) {
    const ref = currentFiber.ref;
    if (ref !== null) {
        if (typeof ref === 'function') {
            ref(null);
        } else {
            ref.current = null;
        }
    }
}

/**
 * 在 DFS 的过程中，结合 subtreeFlags 完成对 effect 的处理。
 * @param finishedWork 
 */
export function commitEffects(
    phrase: 'mutation' | 'layout',
    mask: Flags,
    commitEffectsOnFiber: (fiber: FiberNode, root: FiberRootNode) => void
) {
    return (finishedWork: FiberNode, root: FiberRootNode) => {
        fiber = finishedWork;
        // 两个 while 实现 DFS:
        while (fiber !== null) { // 这个 while 是用来向下遍历的
            const child: FiberNode | null = fiber.child;
    
            if (
                (fiber.subtreeFlags & mask) !== NoFlags &&
                child !== null
            ) {
                fiber = child;
            } else {
                up: while (fiber !== null) { // 这个 while 是用来向上遍历的
                    commitEffectsOnFiber(fiber, root);
                    const sibling: FiberNode | null = fiber.sibling;
                    if (sibling) {
                        fiber = sibling;
                        break up;
                    }
                    fiber = fiber.return;
                }
            }
        }
    };
}

/**
 * commit Mutation 类型的 effects on the finishedWork fiber
 * @param finishedWork 
 * @param root 
 */
function commitMutationEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode) {
    const { flags, tag } = finishedWork;
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
                commitDeletion(child, root);
            });
        }

        finishedWork.flags &= ~ChildDeletion; // 移除 ChildDeletion
    }

    if ((flags & PassiveEffect) !== NoFlags) {
        // 收集回调
        commitPassiveEffect(
            finishedWork,
            root,
            'update'
        );
        finishedWork.flags &= ~PassiveEffect;
    }

    if ((flags & Ref) !== NoFlags && tag === WorkTag.HostComponent) {
        unbindRef(finishedWork);
    }

    if ((flags & Visibility) !== NoFlags && tag === WorkTag.Offscreen) {
        const isHidden = finishedWork.pendingProps.mode === 'hidden';
        hideOrUnhideAllChildren(finishedWork, isHidden);
        finishedWork.flags &= ~Visibility;
    }
}
export const commitMutationEffects = commitEffects(
    'mutation',
    EffectMaskDuringMutation | PassiveEffect,
    commitMutationEffectsOnFiber
);
/**
 * commit layout 类型的 effects on the finishedWork fiber
 * @param finishedWork 
 * @param root 
 */
function commitLayoutEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode) {
    const { flags, tag } = finishedWork;
    if ((flags & Ref) !== NoFlags && tag === WorkTag.HostComponent) { // 额外加个检查，只有 HostComponent 才支持绑定 ref
        // 绑定新的 ref
        bindRef(finishedWork);
        finishedWork.flags &= ~Ref; // 移除 Placement
    }
}
export const commitLayoutEffects = commitEffects(
    'layout',
    EffectMask.Layout,
    commitLayoutEffectsOnFiber
);

// 一些工具函数：
/**
 * hide or unhide All max real subtree's root's stateNode.
 * @param finishedWork 
 * @param isHidden 
 */
function hideOrUnhideAllChildren(
    finishedWork: FiberNode,
    isHidden?: boolean
) {
    runCallbackOnAllMaxRealSubtreeRoots(
        finishedWork,
        subtreeRoot => {
            const { tag, stateNode, memoizedProps } = subtreeRoot;
            if (tag === WorkTag.HostComponent) {
                isHidden
                    ? hideInstance(stateNode)
                    : unhideInstance(stateNode);
                // QUESTION 用户应该不会通过 DOMNode.style.setProperty('display', ...)
                // 来控制元素展示与否吧，虽然我可能会这么做，那如何避免和用户冲突呢？
                // TODO 这里之后可以改进下。
            } else if (tag === WorkTag.HostText) {
                isHidden
                    ? hideTextInstance(stateNode)
                    : unhideTextInstance(stateNode, memoizedProps.content);
                // 问：如果 text fiber 本身有 Update，这里的 unhideTextInstance 
                // 会不会和之后处理 Update 时冲突？
                // 答：不会，二者都是取的 memoizedProps.content，后者就是最新的值，
                // performUnitOfWork 每调用一次 beginWork 之后，会把 pendingProps
                // 赋值给 memoizedProps。
            }
        }
    )
}
/**
 * execute callback on all max real subtree's root，即：对所有的
 * 以 host fiber 为根的最大子树的根节点(host fiber)执行 callback。
 */
function runCallbackOnAllMaxRealSubtreeRoots(
    fiber: FiberNode,
    callback: (hostSubtreeRoot: FiberNode) => void
) {
    let node = fiber;
    /**
     * 我也不知道怎么命名，反正是遇到第一个最大真实非严格子树的根节点时，把节点赋值给
     * temp，当遍历到离开这个树时 temp 为 null。
     */
    let temp = null;
    outer: do {
        const { tag } = node;
        if (tag === WorkTag.HostComponent) {
            temp = node;
            callback(temp);
        } else if (tag === WorkTag.HostText) {
            temp = node;
            callback(temp);
        } else if (
            tag === WorkTag.Offscreen &&
            node.pendingProps.mode === 'hidden' &&
            node !== fiber
        ) {
            // 什么都不做
        } else if (node.child !== null) {
            node = node.child;
            continue;
        } else if (node.sibling !== null) {
            node = node.sibling;
            continue;
        }

        inner: while (true) { // 触底了，于是向上归，继续寻找其他可遍历的节点
            if (node === fiber) break outer;
            if (node.sibling !== null) { 
                node = node.sibling;
                break inner;
            } else {
                node = node.return as FiberNode;
                if (node === temp) temp = null;
            }
        }
    } while (true)
}
