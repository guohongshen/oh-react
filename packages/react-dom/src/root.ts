import { createContainer, updateContainer } from "react-reconciler/src/fiberReconciler";
import { Container } from "./hostConfig";
import { ReactElement } from "shared/ReactTypes";
import { initEvent } from "./SyntheticEvent";

/**
 * ReactDOM 对外接口
 * @param container `<div id="root"/>` 实例
 * @returns 
 */
export function createRoot (container: Container) {
    const root = createContainer(container); // 初始化 fiber tree

    return {
        render(element: ReactElement) { // element 传入 <App/>
            initEvent(container, 'click');
            console.log('[初始]', element);
            
            return updateContainer(element, root);
        }
    }
}