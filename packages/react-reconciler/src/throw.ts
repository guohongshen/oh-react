import { Wakeable } from "shared/ReactTypes";
import { FiberRootNode } from "./fiber";
import { Lane } from "./fiberLanes";
import { ensureRootIsScheduled, markRootUpdate, markUpdateFromFiberToRoot } from "./workLoop";
import { getNearestSuspenseFiber } from "./SuspenseStack";
import { ShouldCapture } from "./fiberFlags";


export function throwException(
    root: FiberRootNode,
    value: any,
    lane: Lane
) {
    // Error Boundary TODO

    // thenable
    if (value !== null && typeof value === 'object' && typeof value.then === 'function') {
        const wakeable: Wakeable<any> = value;
        const suspenseFiber = getNearestSuspenseFiber();
        if (suspenseFiber) {
            suspenseFiber.flags |= ShouldCapture;
        }
        letLaneAsAListenerToWakeable(root, wakeable, lane);
    }
}

/**
 * let lane as a listener to the wakeable.
 * 如果 wakeable(ot thenable) 转为 fulfilled or rejected，就将 lane 加入到 root.pendingLanes
 * 中，并调用 ensureRootIsScheduled 开启调度。也就是说 lane 这次更新因为 wakeable 是
 * pending 而进入睡眠了，wakeable 转为 fulfilled or rejected 后，lane 这次更新就绪了。
 * @param root 
 * @param wakeable 
 * @param lane 
 */
function letLaneAsAListenerToWakeable(
    root: FiberRootNode,
    wakeable: Wakeable<any>,
    lane: Lane
) {
    let pingCache = root.pingCache;
    let threadIds: Set<Lane> | undefined;

    if (pingCache === null) {
        threadIds = new Set<Lane>();
        pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>
        pingCache.set(wakeable, threadIds);
    } else {
        threadIds = pingCache.get(wakeable);
        if (threadIds === undefined) {
            threadIds = new Set<Lane>();
            pingCache.set(wakeable, threadIds);
        }
    }

    if (!threadIds.has(lane)) {
        threadIds.add(lane); // 这里看着，wakeable 和 lane 可以是一对多关系，也即
        // 不只一个 lane 是 wakeable 的 listener
        function ping() {
            if (pingCache !== null) {
                pingCache.delete(wakeable);
            }
            markRootUpdate(root, lane);
            ensureRootIsScheduled(root);
        }
        wakeable.then(ping, ping);
    }
}
