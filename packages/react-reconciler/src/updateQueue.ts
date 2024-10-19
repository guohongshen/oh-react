import { Action } from "shared/ReactTypes";
import { Dispatch } from "react/src/currentDispatcher";
import { Lane, NoLane, isSubsetOfLanes, mergeLanes } from "./fiberLanes";
import { FiberNode } from "./fiber";

export interface Update<State> {
    action: Action<State>;
    lane: Lane;
    next: Update<any> | null; // QUESTION 新的 state 和旧的不是一个类型
}

export interface UpdateQueue<State = any> {
    shared: {
        /**
         * 单项循环链表，指向队尾，pending.next 即队头
         */
        pending: Update<State> | null;
    };
    dispatch: Dispatch<State> | null;
}

export function createUpdate<State>(
    action: Action<State>,
    lane: Lane
): Update<State> {
    return {
        action,
        lane,
        next: null
    };
}

export function createUpdateQueue<State>(): UpdateQueue<State> {
    return {
        shared: {
            pending: null
        },
        dispatch: null
    };
}

export function enqueueUpdate<State>(
    fiber: FiberNode,
    updateQueue: UpdateQueue<State>,
    update: Update<State>,
    lane: Lane
) {
    const pending = updateQueue.shared.pending;
    if (pending === null) {
        update.next = update;
    } else {
        update.next = pending.next;
        pending.next = update;
    }
    updateQueue.shared.pending = update;

    fiber.lanes = mergeLanes(fiber.lanes, lane);
    const alternate = fiber.alternate;
    if (alternate !== null) {
        alternate.lanes = mergeLanes(alternate.lanes, lane); // 多存一份数据，重置的时候拿 QUESTION 什么叫重置时候拿？
    }
}

/**
 * 消费一个 update，注意是一个。
 * @param baseState 
 * @param updateQueue baseQueue 和 pendingQueue 的连接。
 * @returns 
 */
export function processUpdateQueue<State>(
    baseState: State,
    updateQueue: Update<State> | null,
    renderLane: Lane,
    onSkipUpdate?: <State>(update: Update<State>) => void
): {
    baseState: State,
    memoizedState: State,
    baseQueue: Update<State> | null
} {
    const result: ReturnType<typeof processUpdateQueue<State>> = {
        baseState,
        memoizedState: baseState,
        baseQueue: null
    };

    if (updateQueue !== null) {
        let first = updateQueue.next;
        let pending = updateQueue.next as Update<any>;
        let lane = NoLane;
        let newBaseState = baseState;
        let newBaseQueueFirst: Update<State> | null = null;
        let newBaseQueueLast: Update<State> | null = null;
        let newMemoizedState = baseState; // 也即 newState

        do {
            lane = pending.lane;
            if (!isSubsetOfLanes(lane, renderLane)) {
                // 优先级不够 跳过
                const clone = createUpdate( // clone 是偷懒了，不想破坏原链表的结构
                    pending.action,
                    pending.lane
                );
                onSkipUpdate?.(clone);
                if (newBaseQueueLast === null) {
                    newBaseQueueFirst = clone;
                    newBaseQueueLast = clone;
                    newBaseState = newMemoizedState;
                } else {
                    newBaseQueueLast.next = clone;
                    newBaseQueueLast = clone;
                }
            } else {
                // 优先级足够

                if (newBaseQueueLast) {
                    const clone = createUpdate(pending.action, NoLane);
                    newBaseQueueLast.next = clone;
                    newBaseQueueLast = clone;
                }

                // 参与计算
                const action = pending.action;
                if (action instanceof Function) {
                    // baseState 2 update x => 3x -> memoizedState 6
                    newMemoizedState = action(newMemoizedState);
                } else {
                    // baseState 1 update 2 -> memoizedState 2
                    newMemoizedState = action;
                }

            }
            pending = pending.next as Update<any>;
        } while (pending !== first)

        if (newBaseQueueLast === null) {
            // 本次计算过程中，没有 update 被跳过
            newBaseState = newMemoizedState;
        } else {
            newBaseQueueLast.next = newBaseQueueFirst; // 放外面也可以
        }
        result.memoizedState = newMemoizedState;
        result.baseState = newBaseState;
        result.baseQueue = newBaseQueueLast;
    }

    return result;
}
