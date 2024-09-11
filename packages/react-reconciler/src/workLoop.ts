import { scheduleMicroTask } from "hostConfig";
import scheduler, { Priority } from 'scheduler';
import { beginWork } from "./beginWork";
import { commitHookEffectListCreate, commitHookEffectListDestroy, commitHookEffectListUnmount, commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, PendingPassiveEffects, createWorkInProgress } from "./fiber";
import { MutationMask, NoFlags, PassiveEffect, PassiveMask } from "./fiberFlags";
import { Lane, NoLane, SyncLane, getHighestPriorityLane, lanesToSchedulerPriority, markFiberFinished, mergeLanes } from "./fiberLanes";
import { flushSyncCallbacks, addCallbackToSyncQueue } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import { HookHasEffect, Passive } from "./hookEffectTag";

let workInProgress: FiberNode | null;
/**
 * 本次更新的优先级
 */
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffect: boolean = false;

enum RootExitStatus {
    RootInCompleted = 1,
    RootCompleted = 2,
    /**
     * TODO render 过程中出错了，目前还没有考虑这种情况
     */
    RootError = 3
}

function prepareRefreshStack(root: FiberRootNode, lane: Lane) {
    root.finishedLane = NoLane;
    root.finishedWork = null;
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
    const lane = getHighestPriorityLane(root.pendingLanes); // 这一优先级的更新批处理
    const existingCallbackNode = root.callbackNode;

    if (lane === NoLane) { // 参数检查
        if (existingCallbackNode !== null) {
            scheduler.cancelTask(existingCallbackNode);
        }
        root.callbackNode = null;
        root.callbackPriority = NoLane;
        return;
    }

    const curPriority = lane;
    const prevPriority = root.callbackPriority;

    if (curPriority === prevPriority) {
        return;
    }

    if (existingCallbackNode !== null) {
        scheduler.cancelTask(existingCallbackNode); // 删除低优先级任务
    }

    let newCallbackNode = null;

    if (lane === SyncLane) {
        // 同步优先级，用微任务调度
        if (__DEV__) {
            console.log('在微任务中调度，优先级： ', lane);
        }
        addCallbackToSyncQueue(performSyncWorkOnRoot.bind(null, root));
        scheduleMicroTask(flushSyncCallbacks);
    } else {
        if (__DEV__) {
            console.log('在宏任务中调度，优先级： ', lane);
        }
        // 其他优先级，用宏任务调用
        const priority = lanesToSchedulerPriority(lane);
        newCallbackNode = scheduler.addTask(
            priority,
            performConcurrentWorkOnRoot.bind(null, root)
        )
    }
    root.callbackNode = newCallbackNode; // 同步更新时，它是 null
    root.callbackPriority = curPriority;
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

    if (
        (finishedWork.flags & PassiveMask) !== NoFlags ||
        (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
    ) { // 即说明，存在函数组件需要执行 effect 回调
        if (!rootDoesHasPassiveEffect) {
            rootDoesHasPassiveEffect = true;
            // 调度副作用
            scheduler.addTask(
                Priority.NormalPriority,
                () => {
                    // 执行副作用
                    flushPassiveEffects(root.pendingPassiveEffects);
                    return;
                }
            );
        }
    }

    if (lane === NoLane && __DEV__) {
        console.error('commit 阶段 finishedLane 不应该是 NoLane');
    }

    // 判断是否存在 3 个子阶段需要执行的操作
    const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
    const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

    if (subtreeHasEffect || rootHasEffect) {
        // beforeMutation
        // mutation
        commitMutationEffects(finishedWork, root);

        root.current = finishedWork; // wipTree -> current

        // layout
    } else {
        root.current = finishedWork;
    }

    rootDoesHasPassiveEffect = false;
    ensureRootIsScheduled(root);
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

function syncWorkLoop() {
    while (workInProgress !== null) {
        performUnitOfWork(workInProgress);
    }
}

function concurrentWorkLoop() {
    while (workInProgress !== null && !scheduler.ifSliceEnd()) { // TODO !shouldYield()
        performUnitOfWork(workInProgress);
    }
}

function renderRoot(
    root: FiberRootNode,
    lane: Lane,
    shouldTimeSlice?: boolean
) {
    if (__DEV__) {
        console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
    }

    if (wipRootRenderLane !== lane) {
        // 初始化
        prepareRefreshStack(root, lane);
    }

    // 构建递归流程
    // 记住：协调过程整体是递归的，函数执行并不是递归的，因为你那样的话栈太深了，所以实
    // 际的实现是迭代。
    do {
        try {
            if (shouldTimeSlice) {
                concurrentWorkLoop();
            } else {
                syncWorkLoop();
            }
            break;
        } catch (err) {
            if (__DEV__) {
                console.log('err: ', err);
                
                console.log('workLoop 发生错误');
            }
            workInProgress = null;
        }
    } while (true);

    // 中断执行
    if (shouldTimeSlice && workInProgress !== null) {
        return RootExitStatus.RootInCompleted;
    }
    // 执行完了
    if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
        console.error('render 阶段结束时 wip 不应该不是 null');
    }
    // TODO render 过程中出错

    return RootExitStatus.RootCompleted;
}

function performSyncWorkOnRoot(root: FiberRootNode) {
    const lane = getHighestPriorityLane(root.pendingLanes);
    
    if (lane !== SyncLane) { // 参数检查
        // 其他比 SyncLane 低的优先级 或者是 NoLane
        ensureRootIsScheduled(root);
        return;
    }

    const exitStatus = renderRoot(root, lane, false);

    if (exitStatus === RootExitStatus.RootCompleted) {
        const finishedWork = root.current.alternate;
        root.finishedWork = finishedWork;
        root.finishedLane = lane;
        wipRootRenderLane = NoLane;

        // wip fiberNode 树中的 flags
        commitRoot(root);
    } else {
        if (__DEV__) {
            console.error('无法处理同步型更新未完成状态'); 
        }
    }
}

function performConcurrentWorkOnRoot(
    root: FiberRootNode,
    didTimeout?: boolean
): any {
    // 保证之前的 useEffect 执行完毕，因为有可能之前的 useEffect 回调中会触发更高优先
    // 级的更新，如：
    // App(){
    //    useEffect(() => { 产生更高优先级的更新; }, [deps])
    // }
    // 那么这次的更新就应该被这个高优更新打断，没必要进行
    const curCallback = root.callbackNode;
    const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
    if (didFlushPassiveEffect) {
        if (root.callbackNode !== curCallback) {
            // 这种情况是副作用的执行中产生了更高优先级的任务，调用了 ensureRootIsScheduled
            // 导致了 root.callbackNode 被赋值为新的值，所以这里不相等。
            // 可以看成是高优任务打断了低优任务，这里低优任务直接返回 null，取消本次低优任务。
            return null;
        }
    }

    const lane = getHighestPriorityLane(root.pendingLanes);
    const curCallbackNode = root.callbackNode;
    
    if (lane === NoLane) { // 错误检查
        return null;
    }

    const needSync = lane === SyncLane || didTimeout;

    // render 阶段
    const exitStatus = renderRoot(root, lane, !needSync);

    ensureRootIsScheduled(root);

    if (exitStatus === RootExitStatus.RootInCompleted) {
        if (root.callbackNode !== curCallbackNode) { // 不会出现这种情况
            return null;
        }
        return performConcurrentWorkOnRoot.bind(null, root); // 继续本任务
    } else if (exitStatus === RootExitStatus.RootCompleted) {
        const finishedWork = root.current.alternate;
        root.finishedWork = finishedWork;
        root.finishedLane = lane;
        wipRootRenderLane = NoLane;
        // wip fiberNode 树中的 flags
        commitRoot(root);
    } else {
        if (__DEV__) {
            console.error('并发型更新过程中出错了，还未实现针对此的处理程序');
        }
    }
}

function flushPassiveEffects(
    pendingPassiveEffects: PendingPassiveEffects
) {
    let didFlushPassiveEffect = false;
    pendingPassiveEffects.unmount.forEach(effect => {
        didFlushPassiveEffect = true;
        commitHookEffectListUnmount(
            Passive,
            effect
        );
    });
    pendingPassiveEffects.unmount = [];

    // 触发所有上次更新的 destroy
    pendingPassiveEffects.update.forEach(effect => {
        didFlushPassiveEffect = true;
        commitHookEffectListDestroy(
            Passive | HookHasEffect,
            effect
        );
    });

    // 触发所有的 create
    pendingPassiveEffects.update.forEach(effect => {
        didFlushPassiveEffect = true;
        commitHookEffectListCreate(
            Passive | HookHasEffect,
            effect
        );
    });

    pendingPassiveEffects.update = [];

    // 对于在执行 effect 过程中触发的更新，再调用一次 flush
    flushSyncCallbacks();

    return didFlushPassiveEffect;
}
