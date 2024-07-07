import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";
import { Props } from "shared/ReactTypes";

/** HotsRoot */
export interface Container {
    rootId: number;
    children: (Instance | TextInstance)[];
};
/** HostComponent */
export interface Instance {
    id: number;
    type: string;
    children: (Instance | TextInstance)[];
    parent: number;
    props: Props;
};
/** TextInstance */
export interface TextInstance {
    text: string;
    id: number;
    parent: number;
};

let nextInstanceId = 1;
export function getNextInstanceId() {
    return nextInstanceId++;
}

export function createContainer(): Container {
    return {
        rootId: getNextInstanceId(),
        children: []
    };
}

export function createInstance(type: string, props?: any): Instance {
    const instance = {
        id: getNextInstanceId(),
        type,
        children: [],
        parent: -1,
        props
    };
    return instance as Instance;
}

/**
 * 新增一个 child 到 parent，如果 child 已经有父节点则报错。 
 * @param parent 
 * @param child 
 */
export function appendInitialChild(parent: Instance | Container, child: Instance) {
    const prevParentId = child.parent;
    const parentId = 'rootId' in parent ? parent.rootId : parent.id;
    if (prevParentId !== -1 && prevParentId !== parentId) {
        throw Error('不能重复挂载 child');
    }
    child.parent = parentId;
    parent.children.push(child);
}

export function createTextInstance(content: string) {
    const instance = {
        text: content,
        id: getNextInstanceId(),
        parent: -1
    };
    return instance;
}

/**
 * 将 child 加入到 hostRoot.children
 * @param child 
 * @param container 
 */
export function appendChildToContainer(child: any, container: Container) {
    const prevParentId = child.parent;
    if (prevParentId !== -1 && prevParentId !== container.rootId) {
        throw Error('不能重复挂载 child');
    }
    child.parent = container;
    container.children.push(child);
}

/**
 * 将 child 插入到 parent.children 中并放置在 before 前面，如果 child 可以是新元素，
 * 也可以是 parent.children 已经存在的元素（前者对应新增，后者对应移动）
 * @param parent 
 * @param child 
 * @param before 
 */
export function insertBefore(
    parent: Container | Instance,
    child: Instance,
    before: Instance
) {
    // 先检查 before 存不存在
    let beforeIndex = parent.children.indexOf(before);
    if (beforeIndex === -1) {
        throw new Error('before 不存在');
    }

    let index = parent.children.indexOf(child);
    if (index !== -1) { // child 已经在 children 里面了
        parent.children.splice(index, 1);
        if (beforeIndex > index) {
            beforeIndex--;
        }
    }

    parent.children.splice(beforeIndex, 0, child);
}

export function commitUpdate(fiber: FiberNode) {
    switch (fiber.tag) {
        case HostText:
            const text = fiber.memoizedProps.content;
            return commitTextUpdate(fiber.stateNode, text);
        default:
            if (__DEV__) {
                console.warn('未实现的 Update 类型, fiber');
            }
            break;
    }
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
    textInstance.text = content;
}

export function removeChild(
    child: Instance | TextInstance,
    container: Container
) {
    const index = container.children.indexOf(child);

    if (index === -1) {
        throw new Error('child 不存在');
    }
    container.children.splice(index, 1);
}

export const scheduleMicroTask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
        ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
        : setTimeout;
