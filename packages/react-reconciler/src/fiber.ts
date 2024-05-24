import { Props, Key } from "shared/ReactTypes";
import { WorkTag } from './workTags';
import { Flags, NoFlags } from "./FiberFlags";

export class FiberNode {
    tag: WorkTag;
    key: Key;
    stateNode: any;
    pendingProps: Props;
    memoizedProps: Props | null;
    alternate: FiberNode | null;
    flags: Flags;
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
        this.alternate = null;

        this.flags = NoFlags;
    }
}
