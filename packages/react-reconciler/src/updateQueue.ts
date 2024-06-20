import { Action } from "shared/ReactTypes";
import { Dispatch } from "react/src/currentDispatcher";
import { Lane, NoLane } from "./fiberLanes";

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
    updateQueue: UpdateQueue<State>,
    update: Update<State>
) {
    const pending = updateQueue.shared.pending;
    if (pending === null) {
        update.next = update;
    } else {
        update.next = pending.next;
        pending.next = update;
    }
    updateQueue.shared.pending = update;
}

/**
 * 消费一个 update，注意是一个。
 * @param baseState 
 * @param pendingUpdate 
 * @returns 
 */
export function processUpdateQueue<State>(
    baseState: State,
    pendingUpdate: Update<State> | null,
    renderLane: Lane
): {
    memoizedState: State
} {
    const result: ReturnType<typeof processUpdateQueue<State>> = {
        memoizedState: baseState
    };
    if (pendingUpdate !== null) {
        let first = pendingUpdate.next;
        let pending = pendingUpdate.next as Update<any>;
        let lane = NoLane;
        do {
            lane = pending.lane;
            if (lane === renderLane) {
                const action = pending.action;
                if (action instanceof Function) {
                    // baseState 2 update x => 3x -> memoizedState 6
                    baseState = action(baseState);
                } else {
                    // baseState 1 update 2 -> memoizedState 2
                    baseState = action;
                }
            } else {
                if (__DEV__) {
                    console.error('目前不应该走到这里，因为目前只有 SyncLane');
                }
            }
            pending = pending.next as Update<any>;
        } while (pending !== first)
    }

    result.memoizedState = baseState;
    return result;
}
