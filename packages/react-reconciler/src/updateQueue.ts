import { Action } from "shared/ReactTypes"

export interface Update<State> {
    action: Action<State>;
}

export interface UpdateQueue<State = any> {
    shared: {
        pending: Update<State> | null;
    };
}

export function createUpdate<State>(action: Action<State>): Update<State> {
    return {
        action
    };
}

export function createUpdateQueue<Action>(): UpdateQueue<Action> {
    return {
        shared: {
            pending: null
        }
    };
}

export function enqueueUpdate<Action>(
    updateQueue: UpdateQueue<Action>,
    update: Update<Action>
) {
    updateQueue.shared.pending = update;
}

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
