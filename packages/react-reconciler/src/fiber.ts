import { Props, Key } from "shared/ReactTypes";
import { WorkTag } from './workTags';
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";
import { UpdateQueue } from "./updateQueue";
import { Lane, Lanes, NoLane, NoLanes } from "./fiberLanes";
import { Effect } from "./fiberHooks";

export class FiberNode {
    tag: WorkTag;
    key: Key;
    stateNode: any;
    pendingProps: Props;
    memoizedProps: Props | null;
    memoizedState: any;
    alternate: FiberNode | null;
    flags: Flags;
    subtreeFlags: Flags;
    updateQueue: UpdateQueue | null;
    deletions: FiberNode[] | null;
    /**
     * 对于 FunctionComponent，type 就是 Function
     */
    type: any;
    return: FiberNode | null;
    sibling: FiberNode | null;
    child: FiberNode | null;
    index: number;

    ref: any;
    constructor(tag: WorkTag, pendingProps: Props, key: Key) {
        this.tag = tag;
        this.key = key || null;
        this.stateNode = null;
        this.type = null;

        this.return = null;
        this.sibling = null;
        this.child = null;
        this.index = 0;

        this.ref = null;

        // 作为工作单元：
        this.pendingProps = pendingProps;
        this.memoizedProps = null;
        this.memoizedState = null;
        this.alternate = null;
        this.updateQueue = null;

        // 副作用
        this.deletions = null;
        this.flags = NoFlags;
        this.subtreeFlags = NoFlags;
    }
}

export interface PendingPassiveEffects {
    unmount: Effect[];
    update: Effect[];
}

export class FiberRootNode {
    container: Container;
    current: FiberNode;
    /**
     * 当前已经完成递归流程的 hostRootFiber
     */
    finishedWork: FiberNode | null;
    pendingPassiveEffects: PendingPassiveEffects;
    pendingLanes: Lanes;
    finishedLane: Lane;

    /**
     * scheduler.addTask() 的返回值，也即 newTask 实例，这么讲它的名字应该是 task。
     */
    callbackNode: any;
    /**
     * 当前被 scheduler 执行的更新任务的优先级(task 对应的 priority 的 lane 形式)。
     */
    callbackPriority: Lane;

    constructor (container: Container, hostRootFiber: FiberNode) {
        /**
         * FiberRootNode
         * |current   /\
         * \/         | stateNode
         * hostRootFiber 对应 <div id="root"></div>
         * |child     /\
         * \/         | return
         *  App
         */
        this.container = container;
        this.current = hostRootFiber;
        hostRootFiber.stateNode = this;
        this.finishedWork = null;

        this.pendingLanes = NoLanes;
        this.finishedLane = NoLane;

        this.pendingPassiveEffects = {
            unmount: [],
            update: []
        }

        this.callbackNode = null;
        this.callbackPriority = NoLane;
    }
}

export function createWorkInProgress(
    current: FiberNode,
    pendingProps: Props
): FiberNode {
    let wip = current.alternate;
    // ...
    if (wip === null) {
        // mount
        wip = new FiberNode(
            current.tag,
            pendingProps,
            current.key
        );
        wip.type = current.type;
        wip.stateNode = current.stateNode;

        wip.alternate = current;
        current.alternate = wip;
    } else {
        // update
        wip.pendingProps = pendingProps;
        wip.flags = NoFlags; // QUESTION 这里为什么要这么做呢？
        wip.subtreeFlags = NoFlags;
        wip.deletions = null;
    }
    wip.type = current.type;
    wip.updateQueue = current.updateQueue;
    wip.child = current.child;
    wip.memoizedProps = current.memoizedProps;
    wip.memoizedState = current.memoizedState;

    return wip;
}
