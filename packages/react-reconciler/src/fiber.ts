import { Props, Key } from "shared/ReactTypes";
import { WorkTag } from './workTags';
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";
import { UpdateQueue } from "./updateQueue";

export class FiberNode {
    tag: WorkTag;
    key: Key;
    stateNode: any;
    pendingProps: Props;
    memoizedProps: Props | null;
    memoizedState: any;
    alternate: FiberNode | null;
    flags: Flags;
    updateQueue: UpdateQueue | null;
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
        this.key = key;
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

        this.flags = NoFlags;
    }
}

export class FiberRootNode {
    container: Container;
    current: FiberNode;
    /**
     * 当前已经完成递归流程的 hostRootFiber
     */
    finishedWork: FiberNode | null;
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
    }
    wip.type = current.type;
    wip.updateQueue = current.updateQueue;
    wip.child = current.child;
    wip.memoizedProps = current.memoizedProps;
    wip.memoizedState = current.memoizedState;

    return wip;
}
