import { popSuspenseFiber } from "./SuspenseStack";
import { FiberNode } from "./fiber";
import { popContextValue } from "./fiberContext";
import { DidCapture, NoFlags, ShouldCapture } from "./fiberFlags";
import { WorkTag } from "./workTags";


export function unwindWork(wip: FiberNode) {
    const flags = wip.flags;

    switch (wip.tag) {
        case WorkTag.Suspense:
            popSuspenseFiber();
            if (
                (flags & ShouldCapture) !== NoFlags &&
                (flags & DidCapture) === NoFlags
            ) {
                wip.flags = (flags & ~ShouldCapture) | DidCapture;
                return wip;
            }
            break;
        case WorkTag.ContextProvider:
            const context = wip.type._context;
            popContextValue(context);
            return null;
        default:
            return null;

    }
    return null;
}
