import { Props, ReactElement } from "shared/ReactTypes";
import { FiberNode, createWorkInProgress } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { FunctionComponent, HostComponent, HostText, WorkTag } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";

function ChildReconciler(shouldTrackEffects: boolean) {
    function deleteChild (returnFiber: FiberNode, childToDelete: FiberNode) {
        if (!shouldTrackEffects) {
            return;
        }
        const deletions = returnFiber.deletions;
        if (deletions === null) {
            returnFiber.deletions = [childToDelete];
            returnFiber.flags |= ChildDeletion;
        } else {
            deletions.push(childToDelete);
            // deletions 不为空说明 flags 中已经有 ChildDeletion 了，不必要再加了
        }
    }
    function deleteRemainingChildren(
        returnFiber: FiberNode,
        currentFirstChild: FiberNode | null
    ) {
        if (!shouldTrackEffects) return;
        let childToDelete = currentFirstChild;
        while (childToDelete !== null) {
            deleteChild(returnFiber, childToDelete);
            childToDelete = childToDelete.sibling;
        }
    }
    function reconcileSingleElement(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        element: ReactElement
    ) {
        const key = element.key;
        while (currentFiber !== null) {
            // update
            if (currentFiber.key === key) {// key 相同
                if (element.$$typeof === REACT_ELEMENT_TYPE) {
                    if (currentFiber.type === element.type) {
                        // type 相同
                        const existing = useFiber(currentFiber, element.props);
                        existing.return = returnFiber;
                        // 当前节点可复用，标记剩下的节点删除
                        deleteRemainingChildren(returnFiber, existing.sibling);
                        return existing;
                    }
                    // key 相同，删除所有旧的节点
                    deleteRemainingChildren(returnFiber, currentFiber);
                    // 删掉后，就进入到下面的代码，进行创建新的
                    break;
                } else {
                    if (__DEV__) {
                        console.log('还未实现的 ReactElement 类型');
                    }
                    break;
                }
            } else {
                // key 不同，就删掉旧的
                deleteChild(returnFiber, currentFiber);
                // 继续遍历其他的兄弟节点
                currentFiber = currentFiber.sibling;
            }
        }
        // 根据 element
        const fiber = createFiberFromElement(element);
        fiber.return = returnFiber;
        return fiber;
    }
    function reconcileSingleTextNode(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        content: string | number
    ) {
        while (currentFiber !== null) { // update
            if (currentFiber.tag === HostText) {
                // 类型没变，可以复用
                const existing = useFiber(currentFiber, { content });
                existing.return = returnFiber;
                deleteRemainingChildren(returnFiber, currentFiber.sibling);
                return existing;
            }
            deleteChild(returnFiber, currentFiber); // <div> -> 123123
            currentFiber = currentFiber.sibling;
        }
        const fiber = new FiberNode(
            HostText, 
            {content},
            null
        )
        fiber.return = returnFiber;
        return fiber;
    }
    function placeSingleChild(fiber: FiberNode) {
        if (shouldTrackEffects && fiber.alternate === null) {
            fiber.flags |= Placement;
        }
        return fiber;
    }
    return function reconcileChildFibers(returnFiber: FiberNode, currentFiber: FiberNode | null, newChild?: ReactElement) {
        // 判断当前 fiber 的类型
        if (typeof newChild === "object" && newChild !== null) {
            switch (newChild.$$typeof) {
                case REACT_ELEMENT_TYPE:
                    return placeSingleChild(reconcileSingleElement(
                        returnFiber,
                        currentFiber,
                        newChild
                    ));
                default:
                    if (__DEV__) {
                        console.warn('未实现的 reconciler 类型', newChild);
                    }
                    break;
            }
        }

        // newChild is a HostText
        if (typeof newChild === 'string' || typeof newChild === 'number') {
            return placeSingleChild(
                reconcileSingleTextNode(
                    returnFiber,
                    currentFiber,
                    newChild
                )
            );
        }

        // 兜底：
        if (currentFiber !== null) {
            // 兜底 做删除
            deleteChild(returnFiber, currentFiber);
        }

        if (__DEV__) {
            console.warn('为实现的 reconciler 类型', newChild);
        }

        return null;
    }
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);

export function createFiberFromElement(element: ReactElement): FiberNode {
    const { type, key, props } = element;
    let fiberTag: WorkTag = FunctionComponent;

    if (typeof type === 'string') {
        // <div/> type: 'div
        fiberTag = HostComponent;
    } else if (typeof type !== 'function' && __DEV__) {
        console.warn('未定义的 type 类型', type);
    }
    const fiber = new FiberNode(fiberTag, props, key);
    fiber.type = type;
    return fiber;
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0; // 当前仅支持单一孩子节点
    clone.sibling = null;
    return clone;
}
