import scheduler, { Priority } from "scheduler";
import { FiberRootNode } from "./fiber";

/**
 * 数值越低，优先级越高。
 */
export type Lane = number;
export type Lanes = number;

/**
 * 同步
 */
export const SyncLane = 0b0001;
/**
 * 连续的输入，比如拖拽等。对应的离散的输入，就如点击、敲入字符等。
 */
export const InputContinuousLane = 0b0010;
export const DefaultLane = 0b0100;
export const IdleLane = 0b1000;

/**
 * 对应 Priority.IdlePriority
 */
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(...lanes: Lane[]) {
    let merge = 0;
    if (lanes && lanes.length > 0) {
        lanes.forEach(lane => {
            merge = merge | lane;
        });
    }
    return merge;
}

export function requestUpdateLane() {
    // 从上下文中获取 scheduler 优先级
    const currentPriority = scheduler.getCurrentPriority(); // 3
    const lane = schedulerPriorityToLane(currentPriority);
    return lane;
}

export function getHighestPriorityLane(lanes: Lanes) {
    return lanes & -lanes;
}

export function markFiberFinished(
    root: FiberRootNode,
    lane: Lane
) {
    root.pendingLanes &= ~lane;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
    const lane = getHighestPriorityLane(lanes);

    switch (lane) {
        case SyncLane:
            return Priority.ImmediatePriority;
        case InputContinuousLane:
            return Priority.UserBlockingPriority;
        case DefaultLane:
            return Priority.NormalPriority;
        default:
            return Priority.IdlePriority;
    }
}

export function schedulerPriorityToLane(priority: Priority) {
    if (priority === Priority.ImmediatePriority) {
        return SyncLane;
    }
    if (priority === Priority.UserBlockingPriority) {
        return InputContinuousLane;
    }
    if (priority === Priority.NormalPriority) {
        return DefaultLane;
    }
    return NoLane;
}

export function isSubsetOfLanes(subset: Lanes, set: Lanes) {
    return (set & subset) === subset;
}
