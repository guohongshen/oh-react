import { beginWork } from "./beginWork";
import { commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, createWorkInProgress } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { HostRoot } from "./workTags";

let workInProgress: FiberNode | null;

function prepareRefreshStack(root: FiberRootNode) {
    workInProgress = createWorkInProgress(
        root.current,
        {}
    );
}

export function scheduleUpdateOnFiber(fiber: FiberNode) {
    // TODO: 调度功能
    const root = markUpdateFromFiberToRoot(fiber);
    renderRoot(root);
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

    // 重置
    root.finishedWork = null;

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
    const next = beginWork(fiber);
    fiber.memoizedProps = fiber.pendingProps; // 其实可以放在 beginWork 里面？

    if (next === null) {
        completeUnitOfWork(fiber);
    } else {
        workInProgress = next;
    }
}

function workLoop() {
    while (workInProgress !== null) {
        performUnitOfWork(workInProgress);
    }
}

function renderRoot(root: FiberRootNode ) {
    // 初始化
    prepareRefreshStack(root);

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

    // wip fiberNode 树中的 flags
    commitRoot(root);
}
