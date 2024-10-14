import { Props, Key, Wakeable } from "shared/ReactTypes";
import { WorkTag, WorkTagToName } from './workTags';
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";
import { UpdateQueue } from "./updateQueue";
import { Lane, Lanes, NoLane, NoLanes } from "./fiberLanes";
import { Effect } from "./fiberHooks";
import { REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";

export class FiberNode {
    tag: WorkTag;
    tagName: string;
    key: Key;
    stateNode: any;
    pendingProps: Props;
    memoizedProps: Props | null;
    memoizedState: any;
    alternate: FiberNode | null;
    /**
     * 本节点的 flags，不包括后代 fiber 节点那些
     */
    flags: Flags;
    /**
     * 所有后代 fiber 节点的 flags
     */
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
        this.tagName = WorkTagToName[tag];
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
     * 刚刚完成了 render 工作的 hostRootFiber
     */
    finishedWork: FiberNode | null;
    /**
     * finishedWork render 过程中的 render lane，也即刚刚完成的这次 render 的 lane
     */
    finishedLane: Lane;

    pendingPassiveEffects: PendingPassiveEffects;
    pendingLanes: Lanes;

    /**
     * scheduler.addTask() 的返回值，也即 newTask 实例，原名：callbackNode
     */
    schedulerTask: any;
    /**
     * 当前更新的优先级，可能是同步优先级，也可能是异步优先级（如果是异步优先级，那就是
     *  schedulerTask 的 lane）。原名：callbackPriority
     */
    currentPriority: Lane;

    // WeakMap{ promise: }
    pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null;

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

        this.schedulerTask = null;
        this.currentPriority = NoLane;

        this.pingCache = null;
    }
}

/**
 * 如果 current.alternate !== null，则对 alternate 的某些属性重新赋值即可完成复用，
 * 否则就创建一个全新的 FiberNode，并将引用赋值给 current.alternate。
 * @param current 
 * @param pendingProps 
 * @returns 
 */
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
    wip.ref = current.ref;

    return wip;
}

export function createFiberFromFragment(elements: any[], key: Key) {
    const fiber = new FiberNode(WorkTag.Fragment, elements, key);
    fiber.type = REACT_FRAGMENT_TYPE;
    return fiber;
}

export interface OffscreenProps {
    mode: 'visible' | 'hidden',
    children: any;
}

export function createFiberFromOffscreen(pendingProps: OffscreenProps) {
    const fiber = new FiberNode(WorkTag.Offscreen, pendingProps, null);
    return fiber;
}
