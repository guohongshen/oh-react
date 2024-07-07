import { Container } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { HostRoot } from "./workTags";
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from "./updateQueue";
import { ReactElement } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { SyncLane, requestUpdateLane } from "./fiberLanes";


/**
 * 创建 fiberRootNode 和 fiberRootNode，并返回 fiberRootNode。注意此时还是初始阶段，
 * 但 fiberRootNode.current 已经不为空且指向创建的 fiberRootNode。
 * @param container 即 <div id="root">...</div>
 * @returns 
 */
export function createContainer(container: Container) {
    const hostRootFiber = new FiberNode(
        HostRoot,
        {},
        null
    );
    const root = new FiberRootNode(container, hostRootFiber);
    hostRootFiber.updateQueue = createUpdateQueue();
    return root;
}

/**
 * 初始渲染，利用 Update 机制触发, update 的内容就是根组件渲染出来的 ReactElement。
 * @param element 
 * @param root 
 * @returns 
 */
export function updateContainer(
    element: ReactElement | null,
    root: FiberRootNode
) {
    const hostRootFiber = root.current;
    const lane = requestUpdateLane();
    const update = createUpdate<ReactElement | null>(element, lane);
    enqueueUpdate(
        hostRootFiber.updateQueue as UpdateQueue<ReactElement | null>,
        update
    );

    scheduleUpdateOnFiber(hostRootFiber, lane);
    return element;
}

