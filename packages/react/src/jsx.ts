import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { Type, Key, Ref, Props, ReactElement, ElementTpe } from "shared/ReactTypes";

const createReactElement = function (type: Type, key: Key, ref: Ref, props: Props): ReactElement {
    const element = {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref,
        props,
        __mark: 'hongshen.guo'
    };
    return element;
}

export const jsx = function (type: ElementTpe, config: any, ...maybeChildren: any) {
    let key: Key = null;
    const props: Props = {};
    let ref: Ref = null;

    for (const prop in config) {
        const val = config[prop];
        if (prop === 'key') {
            if (val !== undefined) {
                key = '' + val;
            }
            continue;
        }
        if (prop === 'ref') {
            if (val !== undefined) {
                ref = val;
            }
            continue;
        }
        if (Object.hasOwnProperty.call(config, prop)) {
            props[prop] = val;
        }
    }

    const maybeChildrenLength = maybeChildren.length;
    if (maybeChildrenLength) {
        if (maybeChildrenLength === 1) {
            props.children = maybeChildren[0];
        } else {
            props.children = maybeChildren;
        }
    }

    return createReactElement(type, key, ref, props);
}

export const jsxDEV = jsx;
