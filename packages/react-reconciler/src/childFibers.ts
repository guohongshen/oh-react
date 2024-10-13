import { Key, Props, ReactElement } from "shared/ReactTypes";
import { FiberNode, createWorkInProgress } from "./fiber";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE, REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from "shared/ReactSymbols";
import { WorkTag } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";

type ExistingChildren = Map<Key, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
    function deleteChild (returnFiber: FiberNode, childFiber: FiberNode) {
        if (!shouldTrackEffects) {
            return;
        }
        const deletions = returnFiber.deletions;
        if (deletions === null) {
            returnFiber.deletions = [childFiber];
            returnFiber.flags |= ChildDeletion;
        } else {
            deletions.push(childFiber);
            // deletions 不为空说明 flags 中已经有 ChildDeletion 了，不必要再加了
        }
    }
    /*
    * 删除 firstChildToDelete 及其之后的所有孩子
    */
    function deleteRemainingChildren(
        returnFiber: FiberNode,
        firstChildToDelete: FiberNode | null
    ) {
        if (!shouldTrackEffects) return;
        let childToDelete = firstChildToDelete;
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
                        let props = element.props;
                        if (element.type === REACT_FRAGMENT_TYPE) {
                            // 注意：带有 key 的 Fragment，其 props 就是 children；
                            // 但是如果没有 key，那就不会创建 Fragment fiber
                            props = element.props.children;
                        }
                        // type 相同
                        const existing = useFiber(currentFiber, props);
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
        let fiber;
        if (element.type === REACT_FRAGMENT_TYPE) {
            fiber = createFiberFromFragment(element.props.children, key);
        } else {
            fiber = createFiberFromElement(element);
        }
        fiber.return = returnFiber;
        return fiber;
    }
    function reconcileSingleTextNode(
        returnFiber: FiberNode,
        currentFiber: FiberNode | null,
        content: string | number
    ) {
        while (currentFiber !== null) { // update
            if (currentFiber.tag === WorkTag.HostText) {
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
            WorkTag.HostText, 
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
    function getElementKey(element: any, index: number) {
        if (
            Array.isArray(element) ||
            typeof element === 'string' ||
            typeof element === 'number' ||
            element === undefined || // 比如 {isShow && <Cpn/>}
            element === null || // 比如 {isShow ? <Cpn/> : null}
            typeof element === 'boolean'
        ) {
            return index;
        }
        return element.key !== null ? element.key : index;
    }
    /**
     * 尝试从 existingChildren map 中复用一个可复用的 fiber，如果不行就创建一个新的。
     * 原名：updateFromMap，很难理解
     */
    function useFiberInMapOrCreate(
        returnFiber: FiberNode,
        existingChildren: ExistingChildren,
        index: number,
        element: any
    ): FiberNode | null {
        const key = getElementKey(element, index);
        const before = existingChildren.get(key);
        if ((typeof element === 'string' && element !== '') || typeof element === 'number') {
            // HostText
            if (before) {
                if (before.tag === WorkTag.HostText) {
                    existingChildren.delete(key);
                    return useFiber(before, { content: element + '' });
                }
            }
            return new FiberNode(
                WorkTag.HostText,
                { content: element + '' },
                null
            );
        }

        // ReactElement
        if (typeof element === 'object' && element !== null) {
            switch (element.$$typeof) {
                case REACT_ELEMENT_TYPE:
                    if (element.type === REACT_FRAGMENT_TYPE) {
                        return useAsFragmentFiberOrCreate(
                            returnFiber,
                            before,
                            element, // QUESTION 显然是个数组，既然是数组，那就没有 $$typeof 属性吧
                            key,
                            existingChildren
                        );
                    }
                    if (before) {
                        if (before.type === element.type) {
                            // 可以复用
                            existingChildren.delete(key);
                            return useFiber(before, element.props);
                        }
                    }
                    return createFiberFromElement(element);
            }

            if (Array.isArray(element)) {
                return useAsFragmentFiberOrCreate(
                    returnFiber,
                    before,
                    element,
                    key,
                    existingChildren
                );
            }
        }

        // 其他情况如：null, undefined, boolean or ''。
        return null;
    }
    function reconcileChildrenArray(
        returnFiber: FiberNode,
        currentFirstChild: FiberNode | null,
        /**
         * 虽然在我们这个项目中，这里是 ReactElement[]，但是实际 React 有很多其他类型，
         * 所以这里用 any。
         */
        newChildren: any[]
    ): FiberNode {
        let node: FiberNode | null = null;
        /**
         * 当下遍历到的最后一个可复用 fiber 的旧 index（也即在 current 中的位置）
         */
        let lastPlacedIndex: number = 0;
        /**
         * 随着遍历而构建中的新 fiber 链表的表尾
         */
        let lastNewFiber: FiberNode | null = null;
        /**
         * 随着遍历而构建中的新 fiber 链表的表头。协调完后，需要返回它
         */
        let firstNewFiber: FiberNode | null = null;
        // 1. 将 current 保存在 map 中
        const existingChildren: ExistingChildren = new Map();
        let current = currentFirstChild;
        while (current !== null) {
            const keyToUse = current.key !== null
                ? current.key // 有 key 用 key
                : current.index; // 无 key 用 index 
            existingChildren.set(keyToUse, current);
            current = current.sibling;
        }
        // 2. 遍历 newChild 查看是否可复用
        for (let i = 0; i< newChildren.length; ++i) {
            const el = newChildren[i];
            const newFiber = useFiberInMapOrCreate(
                returnFiber,
                existingChildren,
                i,
                el
            );

            if (newFiber === null) { // any -> false null 等不是 string、number 
                // 或者 object 的情况
                continue;
            }

            // 3. 标记移动还是插入
            newFiber.index = i; // 注意 newFiber 的 index 正是在这里做赋值的
            newFiber.return = returnFiber;

            if (lastNewFiber === null) {
                lastNewFiber = newFiber;
                firstNewFiber = newFiber;
            } else {
                lastNewFiber.sibling = newFiber;
                lastNewFiber = newFiber;
            }

            if (!shouldTrackEffects) continue;

            const current = newFiber.alternate;
            if (current !== null) {
                const oldIndex = current.index;
                if (oldIndex < lastPlacedIndex) {
                    newFiber.flags |= Placement; // 移动
                    continue;
                } else {
                    // 不移动
                    lastPlacedIndex = oldIndex;
                }
            } else {
                // mount
                newFiber.flags |= Placement;
            }
        }
        // 4. 将 map 中剩下的标记为删除
        existingChildren.forEach(child => {
            deleteChild(returnFiber, child);
        });

        return firstNewFiber as FiberNode;
    }
    return function reconcile(
        /**
         * wipFiber
         */
        returnFiber: FiberNode,
        /**
         * newChild 对应的 current，即 wipFiber.alternate.child，mount 时为 null
         */
        currentFiber: FiberNode | null,
        /**
         * newChild or newChildren，类型是 any | any[]
         */
        newChild?: any
    ) {
        // 判断 Fragment
        const isUnkeyedTopLevelFragment = typeof newChild === 'object' &&
            newChild !== null &&
            newChild.type === REACT_FRAGMENT_TYPE &&
            newChild.key === null;
        if (isUnkeyedTopLevelFragment) {
            /*
                处理这种情况：
                <div>
                    <>
                        <div/>
                        <div/>
                        <div/>
                    </>
                </div>
             */
            newChild = newChild?.props.children;
        }

        // 判断当前 fiber 的类型
        if (typeof newChild === "object" && newChild !== null) {
            // 多节点的情况
            if (Array.isArray(newChild)) {
                return reconcileChildrenArray(
                    returnFiber,
                    currentFiber,
                    newChild
                );
            }
            switch (newChild.$$typeof) {
                case REACT_ELEMENT_TYPE:
                    return placeSingleChild(reconcileSingleElement(
                        returnFiber,
                        currentFiber,
                        newChild
                    ));
                default:
                    if (__DEV__) {
                        console.warn('reconcileChildFibers 时，遇到了不能处理的 newChild 类型');
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
            deleteRemainingChildren(returnFiber, currentFiber);
        }

        if (__DEV__) {
            console.warn('reconcileChildFibers 时，遇到了不能处理的 newChild 类型', newChild);
        }

        return null;
    }
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);

function createFiberFromElement(element: ReactElement): FiberNode {
    const { type, key, props, ref } = element;
    let fiberTag: WorkTag = WorkTag.FunctionComponent;

    if (typeof type === 'string') {
        // <div/> type: 'div
        fiberTag = WorkTag.HostComponent;
    } else if (typeof type === 'object' && type.$$typeof === REACT_PROVIDER_TYPE) {
        fiberTag = WorkTag.ContextProvider;
    } else if (type === REACT_SUSPENSE_TYPE) {
        fiberTag = WorkTag.Suspense;
    } else if (typeof type !== 'function' && __DEV__) {
        console.warn('未定义的 type 类型', type);
    }
    const fiber = new FiberNode(fiberTag, props, key);
    fiber.type = type;
    fiber.ref = ref;
    return fiber;
}

function createFiberFromFragment(elements: any[], key: Key) {
    const fiber = new FiberNode(WorkTag.Fragment, elements, key);
    fiber.type = REACT_FRAGMENT_TYPE;
    return fiber;
}

/**
 * 复用该 oldFiber。这里的“复用”是宏观层面上看到的，即在通俗化的 diff 过程的描述中，某
 * 个节点在更新之后继续存在便被看成是被复用，而实际在微观底层层面，函数返回的 newFiber
 * 和 oldFiber 并不是同一个实例，有可能是新创建的对象，也有可能指向的是 alternate。
 * @param oldFiber 
 * @param pendingProps 
 * @returns 
 */
function useFiber(oldFiber: FiberNode, pendingProps: Props): FiberNode {
    const clone = createWorkInProgress(oldFiber, pendingProps);
    clone.index = 0; // 当前仅支持单一孩子节点
    clone.sibling = null;
    return clone;
}

/**
 * use a fiber(current) as a Fragment fiber or create a new one.
 * 原名：updateFragment
 */
function useAsFragmentFiberOrCreate(
    returnFiber: FiberNode,
    current: FiberNode | undefined,
    elements: any[],
    key: Key,
    existingChildren: ExistingChildren
) {
    let fiber;
    if (!current || current.tag !== WorkTag.Fragment) {
        fiber = createFiberFromFragment(elements, key);
    } else {
        existingChildren.delete(key);
        fiber = useFiber(current, elements);
    }
    fiber.return = returnFiber;
    return fiber;
}
