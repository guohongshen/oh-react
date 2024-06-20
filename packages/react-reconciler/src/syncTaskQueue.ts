type Callback = (...args: any) => void;

let syncQueue: Callback[] | null = null;
let isFlushingSyncQueue: boolean = false;

export function scheduleSyncCallback(callback: Callback) {
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
            syncQueue = null; // 他没加，我这边加了
        } catch (e) {
            if (__DEV__) {
                console.error('flushSyncCallbacks 报错');
            }
        } finally {
            isFlushingSyncQueue = false;
        }
    }
}
