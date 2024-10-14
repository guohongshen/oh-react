type Callback = (...args: any) => void;

let syncQueue: Callback[] | null = null;
let isFlushingSyncQueue: boolean = false;

/**
 * 原名 scheduleSyncCallback，更名后 addCallbackToSyncQueue。添加 callback 到
 * syncQueue 中（但不执行）。
 * @param callback 
 */
export function addCallbackToSyncQueue(callback: Callback) {
    if (syncQueue === null) {
        syncQueue = [callback];
    } else {
        syncQueue.push(callback);
    }
}

export function flushSyncCallbacks() {
    if (!isFlushingSyncQueue && syncQueue) {
        isFlushingSyncQueue = true;
        try {
            syncQueue.forEach(callback => {
                callback();
            });
        } catch (e) {
            if (__DEV__) {
                console.error('flushSyncCallbacks 报错', e);
            }
        } finally {
            syncQueue = null;
            isFlushingSyncQueue = false;
        }
    }
}
