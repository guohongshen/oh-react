import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import { commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, createWorkInProgress } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { Lane, NoLane, SyncLane, getHighestPriorityLane, markFiberFinished, mergeLanes } from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";

let workInProgress: FiberNode | null;
/**
 * 本次更新的优先级
 */
let wipRootRenderLane: Lane = NoLane;

function prepareRefreshStack(root: FiberRootNode, lane: Lane) {
    workInProgress = createWorkInProgress(
        root.current,
        {}
    );
    wipRootRenderLane = lane;
}

/**
 * 调度阶段的入口
 * @param root 
 * @returns 
 */
export function ensureRootIsScheduled(root: FiberRootNode) {
    const lane = getHighestPriorityLane(root.pendingLanes);
    if (lane === NoLane) {
        return;
    }
    if (lane === SyncLane) {
        // 同步优先级，用微任务调度
        if (__DEV__) {
            console.log('在微任务中调度，优先级： ', lane);
        }
        scheduleSyncCallback(performSyncWorkOnRoot.bind(
            null,
            root,
            lane
        ));
        scheduleMicroTask(flushSyncCallbacks);
    } else {
        // 其他优先级，用宏任务调用
    }
}

/**
 * 此 fiber 新增了一个 update，开始调度。
 * @param fiber 
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
    // TODO: 调度功能
    
    const root = markUpdateFromFiberToRoot(fiber);

    function markRootUpdate(
        root: FiberRootNode,
        lane: Lane
    ) {
        root.pendingLanes = mergeLanes(root.pendingLanes, lane);
    }
    markRootUpdate(root, lane);
    
    ensureRootIsScheduled(root);
}

// QUESTION: fiberRootNode 不应该只有一个吗，那存在一个全局变量里不就好了，为什么还要
// 往上查找。
export function markUpdateFromFiberToRoot(
    fiber: FiberNode
) {
    let node = fiber;
    let parent = node.return;
    while (parent !== null) {
        node = parent;
        parent = node.return;
    }
    if (node.tag === HostRoot) {
        return node.stateNode;
    }
    return null;
}

function completeUnitOfWork(fiber: FiberNode) {
    let node: FiberNode | null = fiber;

    do {
        completeWork(node);
        const sibling = node.sibling;

        if (sibling !== null) {
            workInProgress = sibling;
            return;
        }
        node = node.return;
        workInProgress = node;

    } while (node !== null);
}

function commitRoot(root: FiberRootNode) {
    const finishedWork = root.finishedWork;

    if (finishedWork === null) {
        return;
    }

    if (__DEV__) {
        console.warn('commit 阶段开始', finishedWork);
    }
    const lane = root.finishedLane;

    // 重置
    root.finishedWork = null;
    root.finishedLane = NoLane;

    markFiberFinished(root, lane);

    if (lane === NoLane && __DEV__) {
        console.error('commit 阶段 finishedLane 不应该是 NoLane');
    }

    // 判断是否存在三个子阶段需要执行的操作
    
    const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
    const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

    if (subtreeHasEffect || rootHasEffect) {
        // beforeMutation

        // mutation
        commitMutationEffects(finishedWork);

        root.current = finishedWork; // wipTree -> current

        // layout
    } else {

    }
}

function performUnitOfWork(fiber: FiberNode) {
    const next = beginWork(fiber, wipRootRenderLane);
    fiber.memoizedProps = fiber.pendingProps; // 其实可以放在 beginWork 里面？

    if (next === null) {
        completeUnitOfWork(fiber);
    } else {
        workInProgress = next;
    }
}

function workLoop() {
    while (workInProgress !== null) { // TODO !shouldYield()
        performUnitOfWork(workInProgress);
    }
}

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
    const nextLane = getHighestPriorityLane(root.pendingLanes);
    
    if (nextLane !== SyncLane) {
        // 其他比 SyncLane 低的优先级
        // NoLane
        ensureRootIsScheduled(root);
        return;
    }

    if (__DEV__) {
        console.log('render 阶段开始');
    }

    // 初始化
    prepareRefreshStack(root, lane);

    // 构建递归流程
    // 记住：协调过程整体是递归的，函数执行并不是递归的，因为你那样的话栈太深了，所以实
    // 际的实现是迭代。
    do {
        try {
            workLoop();
            break;
        } catch (err) {
            if (__DEV__) {
                console.log('workLoop 发生错误');
            }
            workInProgress = null;
        }
    } while (true);

    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    // wip fiberNode 树中的 flags
    commitRoot(root);
}
