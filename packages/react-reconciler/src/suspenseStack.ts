import { FiberNode } from "./fiber";


const stack: FiberNode[] = [];

export function getNearestSuspenseFiber() {
    return stack[stack.length -1];
}

export function pushSuspenseFiber(fiber: FiberNode) {
    return stack.push(fiber)
}

export function popSuspenseFiber() {
    return stack.pop()
}
