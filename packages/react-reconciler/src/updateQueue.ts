import { Action } from "shared/ReactTypes";
import { Dispatch } from "react/src/currentDispatcher";

export interface Update<State> {
    action: Action<State>;
}

export interface UpdateQueue<State = any> {
    shared: {
        pending: Update<State> | null;
    };
    dispatch: Dispatch<State> | null;
}

export function createUpdate<State>(action: Action<State>): Update<State> {
    return {
        action
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
    pendingUpdate: Update<State> | null
): {
    memoizedState: State
} {
    const result: ReturnType<typeof processUpdateQueue<State>> = {
        memoizedState: baseState
    };
    if (pendingUpdate !== null) {
        const action = pendingUpdate.action;
        if (action instanceof Function) {
            // baseState 2 update x => 3x -> memoizedState 6
            result.memoizedState = action(baseState);
        } else {
            // baseState 1 update 2 -> memoizedState 2
            result.memoizedState = action;
        }
    }

    return result;
}
