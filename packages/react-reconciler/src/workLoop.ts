import { scheduleMicroTask } from "hostConfig";
import scheduler, { Priority } from 'scheduler';
import { beginWork } from "./beginWork";
import { commitHookEffectListCreate, commitHookEffectListDestroy, commitHookEffectListUnmount, commitLayoutEffects, commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, PendingPassiveEffects, createWorkInProgress } from "./fiber";
import { EffectMask, EffectMaskDuringMutation, NoFlags, PassiveEffect, PassiveMask } from "./fiberFlags";
import { Lane, NoLane, SyncLane, getHighestPriorityLane, lanesToSchedulerPriority, markFiberFinished, mergeLanes } from "./fiberLanes";
import { flushSyncCallbacks, addCallbackToSyncQueue } from "./syncTaskQueue";
import { WorkTag } from "./workTags";
import { HookHasEffect, Passive } from "./hookEffectTag";
import { SuspenseException, getSuspendedThenable } from "./thenbale";
import { resetHooksWhenUnwind } from "./fiberHooks";
import { throwException } from "./throw";
import { unwindWork as unwindUnitOfWork } from "./unwindWork";

let workInProgress: FiberNode | null;
/**
 * 本次更新的优先级
 */
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffect: boolean = false;

// 下面这几个是和 Suspense 有关的：
enum SuspendedReason {
    NotSuspended = 0,
    onData = 1
}
let wipSuspendedReason: SuspendedReason = SuspendedReason.NotSuspended;
let wipThrownValue: any = null;

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
    const existingTask = root.schedulerTask;

    if (lane === NoLane) { // 参数检查
        if (existingTask !== null) {
            scheduler.cancelTask(existingTask);
        }
        root.schedulerTask = null;
        root.currentPriority = NoLane;
        return;
    }

    const curPriority = lane;
    const prevPriority = root.currentPriority;

    if (curPriority === prevPriority) { // 同优先级，不做任务操作
        return;
    }

    if (existingTask !== null) {
        scheduler.cancelTask(existingTask); // 删除低优先级任务
        // 注意，因为 lane 是 getHighestPriorityLane(root.pendingLanes)，所以 lane
        // 只会比 existingTask 的 lane 优先级更高。
    }

    let newSchedulerTask = null;

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
        newSchedulerTask = scheduler.addTask(
            priority,
            performConcurrentWorkOnRoot.bind(null, root)
        )
    }
    root.schedulerTask = newSchedulerTask; // 同步更新时，它是 null
    root.currentPriority = curPriority;
}

/**
 * 此 fiber 新增了一个 update，开始调度。
 * @param fiber 
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
    // TODO: 调度功能
    
    const root /* fiberRootNode */ = markUpdateLaneFromFiberToRoot(fiber, lane);

    markRootUpdate(root, lane);
    
    ensureRootIsScheduled(root);
}

/**
 * 更新从 fiber.parent 直到 hostRootFiber 的 childLanes，返回 fiberRootNode。
 * @param fiber 
 * @returns 
 */
export function markUpdateLaneFromFiberToRoot(
    fiber: FiberNode,
    lane: Lane
) {
    let node = fiber;
    let parent = node.return;
    while (parent !== null) {
        parent.childLanes = mergeLanes(
            parent.childLanes,
            lane
        );
        const alternate = parent.alternate;
        if (alternate !== null) {
            alternate.childLanes = mergeLanes(
                alternate.childLanes,
                lane
            );
        }
        node = parent;
        parent = node.return;
    }
    if (node.tag === WorkTag.HostRoot) {
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
    const subtreeHasEffect = (finishedWork.subtreeFlags & EffectMaskDuringMutation) !== NoFlags;
    const rootHasEffect = (finishedWork.flags & EffectMaskDuringMutation) !== NoFlags;

    if (subtreeHasEffect || rootHasEffect) {
        // 阶段1/3 beforeMutation

        // 阶段2/3 mutation
        commitMutationEffects(finishedWork, root);

        root.current = finishedWork; // wipTree -> current

        // 阶段3/3 layout
        commitLayoutEffects(finishedWork, root);
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

    if (wipRootRenderLane !== lane) { // 只有一种情况会不相等：异步任务时间片结束，
        // 于是中断。之后被其他更高优更新打断，但 wipRootRenderLane 还是异步任务的 lane，
        // 而 lane 是更高先级的 lane，所以不相等。

        // 对于不同优先级的任务，要初始化一些全局变量  
        prepareRefreshStack(root, lane);
    }

    let count = 0;

    // 构建递归流程
    // 记住：协调过程整体是递归的，函数执行并不是递归的，因为你那样的话栈太深了，所以实
    // 际的实现是迭代。
    do {
        try {
            if (
                wipSuspendedReason !== SuspendedReason.NotSuspended &&
                workInProgress !== null
            ) {
                // unwind
                const thrownValue = wipThrownValue;
                wipSuspendedReason = SuspendedReason.NotSuspended;
                wipThrownValue = null;
                throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane);
            }
            if (shouldTimeSlice) {
                concurrentWorkLoop();
            } else {
                syncWorkLoop();
            }
            break;
        } catch (err) {
            if (__DEV__) {
                console.log('workLoop 发生错误', err);
            }
            handleThrown(root, err);
            ++count;
            if (count > 20) {
                console.log('workLoop count 大于 20');
                
                break;
            }
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
        const finishedWork = root.current.alternate; // render 完成后，仍然是 wipTree，commit 阶段画到页面上后再转为 current 吧
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
    // 保证之前的副作用执行完毕。因为本次更新优先级如果比 Priority.NormalPriority 高
    // 那么就会插在副作用之前执行，而副作用的回调中是有可能触发更高优先级更新的，如：
    // App(){
    //    useEffect(() => { 产生更高优先级的更新; }, [deps])
    // }
    // 那么这次的更新就应该被这个高优更新打断，没必要进行。所以先把副作用执行完毕。
    const curCallback = root.schedulerTask;
    const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
    if (didFlushPassiveEffect) {
        if (root.schedulerTask !== curCallback) {
            // 这种情况正因为是副作用的执行中产生了更高优先级的任务，调用了 ensureRootIsScheduled
            // 导致了 root.callbackNode 被赋值为新的值，所以这里不相等。
            // 可以看成是高优任务打断了低优任务，这里低优任务直接返回 null，取消本次低优任务。
            return null;
        }
    }

    const lane = getHighestPriorityLane(root.pendingLanes);
    const curCallbackNode = root.schedulerTask;
    
    if (lane === NoLane) { // 错误检查
        return null;
    }

    const needSync = lane === SyncLane || didTimeout;

    // render 阶段
    const exitStatus = renderRoot(root, lane, !needSync);

    if (exitStatus === RootExitStatus.RootInCompleted) {
        ensureRootIsScheduled(root);

        if (root.schedulerTask !== curCallbackNode) {
            // QUESTION 怎么会出现这种情况呢？renderRoot 的执行过程中也会产生更新？如果是这样，
            // 那上面那行 ensureRootIsScheduled 就有必要调用
            return null;
        }
        return performConcurrentWorkOnRoot.bind(null, root); // 继续本任务
    } else if (exitStatus === RootExitStatus.RootCompleted) {
        ensureRootIsScheduled(root);

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
    /**
     * 副作用不可能被执行到一半就停下来，所以只能是要么没执行，要么执行完了。本次函数执行
     * 完副作用后，变量为 true；如果副作用之前已经被执行完了，本函数又被外部调用了，就会
     * 得到 false。本函数会在两种情况下被调用：一种是常规的 scheduler 调度，一种是外部
     * 主动调用。在外部条件不变时，本函数被调用一次和两次没有什么区别，两次只不过是第一
     * 次执行副作用，而第二次什么也不做。
     */
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
    // flushSyncCallbacks(); // // 我觉得这一行代码应该删掉，这是只有同步更新时写的代码

    return didFlushPassiveEffect;
}

/**
 * render 过程中抛出的错误都在这里处理
 * @param root 
 * @param thrownValue 
 */
function handleThrown(root: FiberRootNode, thrownValue: any) {
    // TODO Error Boundary

    if (thrownValue === SuspenseException) {
        thrownValue = getSuspendedThenable();
        wipSuspendedReason = SuspendedReason.onData;
    }
    wipThrownValue = thrownValue; // 转存，workLoop 会读
}

function throwAndUnwindWorkLoop(
    root: FiberRootNode,
    unitOfWork: FiberNode,
    thrownValue: any,
    lane: Lane
) {
    // 重置 FC 全局变量
    resetHooksWhenUnwind();

    // 请求返回后重新触发更新
    throwException(root, thrownValue, lane);

    // unwind
    unwindWorkLoop(unitOfWork);
}

function unwindWorkLoop(unitOfWork: FiberNode) {
    let incompleteWork: FiberNode | null = unitOfWork;

    do {
        const next = unwindUnitOfWork(incompleteWork);
        if (next !== null) {
            workInProgress = next;
            return;
        } 
        const returnFiber = incompleteWork.return as FiberNode;
        if (returnFiber !== null) {
            returnFiber.deletions = null;
        }
        incompleteWork = returnFiber;
    } while (incompleteWork !== null)
    
    // 使用了 use，抛出了 data，但是没有定义 suspense，于是就一直遍历到了 root
    // TODO 
    workInProgress = null;
}

export function markRootUpdate(
    root: FiberRootNode,
    lane: Lane
) {
    root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}
