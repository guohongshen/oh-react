import { createContainer, updateContainer } from "react-reconciler/src/fiberReconciler";
import { Container, createContainer as createHostRoot, Instance } from "./hostConfig";
import { ReactElement } from "shared/ReactTypes";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";

/**
 * ReactDOM 对外接口
 * @returns 
 */
export function createRoot() {
    /** HostRoot */
    const container = createHostRoot();
    // @ts-ignore
    const root = createContainer(container); // 初始化 fiber tree

    function getChildren(parent: Container | Instance) {
        if (parent) {
            return parent.children;
        }
        return null;
    }

    /** 给测试环境用的 */
    function parseChildToJSX(child: any): any {
        if (typeof child === 'string' || typeof child === 'number') {
            // 文本节点
            return child;
        }

        // 数组
        if (Array.isArray(child)) {
            if (child.length === 0) {
                return null;
            }
            if (child.length === 1) {
                return parseChildToJSX(child[0]);
            }

            const children = child.map(parseChildToJSX);
            if (children.every(child => (
                typeof child === 'string' ||
                typeof child === 'number'
            ))) {
                return children.join('');
            }

            return children;
        }

        // Instance
        if (Array.isArray(child.children)) {
            const instance: Instance = child;
            const children = parseChildToJSX(instance.children);
            const props = instance.props;

            if (children !== null) {
                props.children = children;
            }

            return {
                $$typeof: REACT_ELEMENT_TYPE,
                type: instance.type,
                key: null,
                ref: null,
                props,
                __mark: 'hongshen.guo'
            };
        }

        // TextInstance
        return child.text;
    }

    function getChildrenAsJSX(parent: Container | Instance) {
        if (parent) {
            const children = parseChildToJSX(getChildren(parent));
            if (Array.isArray(children)) {
                return {
                    $$typeof: REACT_ELEMENT_TYPE,
                    type: REACT_FRAGMENT_TYPE,
                    key: null,
                    ref: null,
                    props: { children },
                    __mark: 'hongshen.guo'
                };
            }
            return children;
        }
        return null;
    }

    return {
        render(element: ReactElement) { // element 传入 <App/>
            return updateContainer(element, root);
        },
        getChildren() {
            return getChildren(container);
        },
        getChildrenAsJSX() {
            return getChildrenAsJSX(container);
        }
    }
}