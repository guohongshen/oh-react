import { ReactElement } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { FunctionComponent, HostComponent, HostText, WorkTag } from "./workTags";
import { Placement } from "./fiberFlags";

function ChildReconciler(shouldTrackEffects: boolean) {
    function reconcileSingleElement(
        returnFiber: FiberNode,
        currentFIber: FiberNode | null,
        element: ReactElement
    ) {
        // 根据 element
        const fiber = createFiberFromElement(element);
        fiber.return = returnFiber;
        return fiber;
    }
    function reconcileSingleTextNode(
        returnFiber: FiberNode,
        currentFIber: FiberNode | null,
        content: string | number
    ) {
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
                        console.warn('为实现的 reconciler 类型', newChild);
                    }
                    return null;
            }
        }

        // HostText
        if (typeof newChild === 'string' || typeof newChild === 'number') {
            return placeSingleChild(
                reconcileSingleTextNode(
                    returnFiber,
                    currentFiber,
                    newChild
                )
            );
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
