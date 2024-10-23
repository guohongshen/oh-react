/**
 * @file
 * context 相关的逻辑。
 */
import { ReactContext } from "shared/ReactTypes";
import { FiberNode } from "./fiber";
import { Lane, NoLanes, includeLanes, isSubset, mergeLanes } from "./fiberLanes";
import { markWipReceiveUpdate } from "./beginWork";
import { WorkTag } from "./workTags";

export interface ContextItem<Value> {
    context: ReactContext<Value>;
    memoizedState: Value;
    next: ContextItem<Value> | null;
}

let prevContextValue: any = null;
let lastContextDep: ContextItem<any> | null = null;

/**
 * 不包括 current value，所以是 prev，current value 在 context._currentValue，没必
 * 要往数组里面添加。
 */
const prevContextValuesStack: any[] = [];

export function pushContextValue<T>(context: ReactContext<T>, newValue: T) {
    prevContextValuesStack.push(context._currentValue);
    context._currentValue = newValue;
}

export function popContextValue<T>(context: ReactContext<T>) {
    context._currentValue = prevContextValuesStack.pop();
}

export function prepareToReadContext(
    wip: FiberNode,
    renderLane: Lane
) {
    lastContextDep = null;

    const deps = wip.dependencies;
    if (deps !== null) {
        const firstContext = deps.firstContext;
        if (firstContext !== null) {
            if (includeLanes(deps.lanes, renderLane)) { // QUESTION 这里就有个问题，既然用的
                // 是 includeLanes，那就说明 deps.lanes 可能还有其他 lane？什么情况
                // 下会有呢？我想应该是低优更新修改了 context，然后 context 下 beginWork
                // 到某个节点时被高优更新打断了，这个高优更新也修改了另一个 context，
                // 那么使用了这两个 context 的节点在 beginWork 时，在此处 lanes 就会
                // 包含低优的 lane 和高优的 lane。但是之后在执行 readContext 时，会把
                // deps.lanes 置为 NoLanes，嗯？？？不过好像也没问题，因为 beginWork
                // 到那个 fiber 时，不管是哪个 context，拿到的都是新的值。QUESTION 但
                // 是 root.pendingLanes 没有把低优 lane 去掉呀。。。

                markWipReceiveUpdate(); // 将 didReceiveUpdate 置为 true，这样就不会命中 bailout 了（见 beginWorkOnFunctionComponent）
            }
            deps.firstContext = null;
        }
    }
}

export function readContext<T>(
    consumer: FiberNode | null,
    context: ReactContext<T>
): T {
    if (consumer === null) { // 意外地在函数组件外调用 useContext，报错
        throw new Error('只能在函数组件中调用 useContext');
    }

    const value = context._currentValue;
    // 建立 fiber -> context
    const contextItem: ContextItem<T> = {
        context,
        next: null,
        memoizedState: value
    };

    if (lastContextDep === null) {
        lastContextDep = contextItem;
        consumer.dependencies = {
            firstContext: contextItem,
            lanes: NoLanes
        }
    } else {
        lastContextDep = lastContextDep.next = contextItem;
    }

    return value;
}

/**
 * propagate（传递）context's change。前序遍历以 wip 为根的树（wip 本身不用），检查
 * 每个节点是否读取了 context，如果读取了就将 renderLane 添加到从该节点开始一直往上直到
 * wip（包括该节点和 wip）的 lanes 中以及这些节点的 alternate 的 childLanes 中。如果
 * 碰到了同一个 context 的另一个 Provider，那就不做任何处理，等效于遍历到了叶子节点。
 * @param wip 
 * @param context 
 * @param renderLane 
 */
export function propagateContextChange<T>(
    /**
     * ContextProvider fiber
     */
    wip: FiberNode,
    context: ReactContext<T>,
    renderLane: Lane
) {
    let fiber = wip.child;
    if (fiber !== null) {
        fiber.return = wip; // QUESTION 不太清楚，这里为什么要主动去保存 return，不是太要紧的问题
    }
    // 前序遍历
    while (fiber !== null) {
        let nextFiber: FiberNode | null = null;
        const deps = fiber.dependencies;
        if (deps !== null) {
            nextFiber = fiber.child;
            let contextItem = deps.firstContext;
            while (contextItem !== null) {
                if (contextItem.context === context) { // 读了该 context
                    fiber.lanes = mergeLanes(fiber.lanes, renderLane); // renderLane 添加到 lanes 中
                    const alternate = fiber.alternate;
                    if (alternate !== null) {
                        alternate.lanes = mergeLanes( // QUESTION 不太明白，为什么要给 alternate.lanes 也加 renderLane，难道之后还要使用？
                            alternate.lanes,
                            renderLane
                        );
                    }
                    scheduleContextWorkOnParentPath(
                        fiber.return,
                        wip,
                        renderLane
                    );
                    deps.lanes = mergeLanes(deps.lanes, renderLane);
                    break;
                }
                contextItem = contextItem.next;
            }
        } else if (fiber.tag === WorkTag.ContextProvider) {
            nextFiber = fiber.type === wip.type ? null : fiber.child;
        } else {
            nextFiber = fiber.child;
        }

        if (nextFiber !== null) {
            nextFiber.return = fiber;
        } else {
            // 到了叶子节点
            nextFiber = fiber;
            while (nextFiber !== null) {
                if (nextFiber === wip) {
                    nextFiber = null;
                    break;
                }
                const sibling: FiberNode | null = nextFiber.sibling;
                if (sibling !== null) {
                    sibling.return = nextFiber.return;
                    nextFiber = sibling;
                    break;
                }
                nextFiber = nextFiber.return;
            }
        }
        fiber = nextFiber;
    }
}

/**
 * 从 from 开始，到 to 结束（包括 from 和 to），给这条链上的节点的 childLanes 及其
 * alternate 的 childLanes 添加 renderLane。
 * @param from 
 * @param to 
 * @param renderLane 
 */
function scheduleContextWorkOnParentPath(
    from: FiberNode | null,
    to: FiberNode,
    renderLane: Lane
) {
    let node = from;
    while (node !== null) {
        const alternate = node.alternate;

        if (!isSubset(renderLane, node.childLanes)) {
            node.childLanes = mergeLanes(node.childLanes, renderLane);
            if (alternate !== null) {
                alternate.childLanes = mergeLanes(alternate.childLanes, renderLane); // QUESTION 不太明白，为什么要给 alternate 也加 renderLane，难道之后还要读？
            }
        } else if (
            alternate !== null &&
            !isSubset(renderLane, alternate.childLanes)
        ) {
            alternate.childLanes = mergeLanes( // QUESTION 不太明白，为什么要给 alternate 也加 renderLane，难道之后还要读？
                alternate.childLanes,
                renderLane
            );
        }

        if (node === to) {
            break;
        }
        node = node.return;
    }
}

