/**
 * @file
 * Lane 模型；
 * 优先级；
 * requestUpdateLane 从 scheduler 中获取当前的优先级，这一点很奇怪；
 * 一些工具函数。
 */


import scheduler, { Priority } from "scheduler";
import { FiberRootNode } from "./fiber";
import currentBatchConfig from "react/src/currentBatchConfig";

/**
 * 用赛道代表优先级，把二进制数的每一位看成一条赛道，越靠右的赛道（低位）优先级越高。比如：
 * 0b...0001 代表第一条赛道，0b...0010 代表第二条赛道，0b...0110 代表第二、第三条赛道，
 * 也即用 1 表示（表达）某条赛道。
 */

/**
 * 某条赛道
 */
export type Lane = number;
/**
 * 复数，多条赛道
 */
export type Lanes = number;

/**
 * 同步赛道（或者叫同步优先级）
 */
export const SyncLane = 0b00001;
/**
 * 连续的输入，比如拖拽等。相应的也有离散的输入(InputDiscreteLane)，就如点击、敲入字符等。
 */
export const InputContinuousLane = 0b00010;
export const DefaultLane = 0b00100;
/**
 * useTransition
 */
export const TransitionLane = 0b01000;
export const IdleLane = 0b10000;

/**
 * 对应 Priority.IdlePriority
 */
export const NoLane = 0b00000;
export const NoLanes = 0b00000;

/**
 * 将多个优先级合并，即逻辑运算上做 | 操作
 */
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
    const isTransition = currentBatchConfig.transition !== null;
    if (isTransition) {
        return TransitionLane;
    }

    // 从上下文中获取 scheduler 优先级
    const currentPriority = scheduler.getCurrentPriority(); // 3
    const lane = schedulerPriorityToLane(currentPriority);
    return lane;
}

export function getHighestPriorityLane(lanes: Lanes) {
    return lanes & -lanes;
}

/**
 * 从 root.pendingLanes 中移除 lane，表示该优先级的更新已经完成了。
 * @param root 
 * @param lane 
 */
export function markFiberFinished(
    root: FiberRootNode,
    lane: Lane
) {
    root.pendingLanes &= ~lane;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
    // 对于 lanes 的优先级，就用它内部最低位二进制 1 代表的优先级
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
