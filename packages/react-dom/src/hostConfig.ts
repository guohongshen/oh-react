import { FiberNode } from "react-reconciler/src/fiber";
import { HostComponent, HostText } from "react-reconciler/src/workTags";
import { injectProps, DOMElement } from "./SyntheticEvent";
import { TextInstance } from "react-noop-renderer/src/hostConfig";

/** HostRoot */
export type Container = Element;
/** HostComponent */
export type Instance = Element;
/** HostText */
export type textInstance = Text;

export function createInstance (type: string, props?: any): Instance {
    const element = document.createElement(type) as unknown;
    if (!!props) {
        injectProps(element as DOMElement, props);
    }
    return element as Instance;
}

export function appendInitialChild(parent: Instance | Container, child: Instance) {
    parent.appendChild(child);
}

export function createTextInstance(content: string) {
    return document.createTextNode(content);
}

export function appendChildToContainer(child: any, container: Container) {
    return appendInitialChild(container, child);
}

export function insertBefore(
    parent: Container,
    newChild: Instance,
    before: Instance
) {
    parent.insertBefore(newChild, before)
}

export function commitUpdate(fiber: FiberNode) {
    switch (fiber.tag) {
        case HostText:
            const text = fiber.memoizedProps.content;
            return commitTextUpdate(fiber.stateNode, text);
        case HostComponent:
            return injectProps(fiber.stateNode, fiber.memoizedProps);
        default:
            if (__DEV__) {
                console.warn('未实现的 Update 类型, fiber');
            }
            break;
    }
}

export function commitTextUpdate(textInstance: textInstance, content: string) {
    textInstance.textContent = content;
}

export function removeChild(
    child: Instance | textInstance,
    container: Container
) {
    container.removeChild(child);
}

export const scheduleMicroTask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
        ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
        : setTimeout;

export function hideInstance(instance: Instance) {
    const style = (instance as HTMLElement).style;
    style.setProperty('display', 'none', 'important');
}

export function unhideInstance(instance: Instance) {
    const style = (instance as HTMLElement).style;
    style.display = '';
}

export function hideTextInstance(instance: Instance) {
    instance.nodeValue = '';
}

export function unhideTextInstance(instance: Instance, text: string) {
    instance.nodeValue = text;
}
