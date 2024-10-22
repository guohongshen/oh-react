import { Dispatcher, resolveDispatcher } from "./src/currentDispatcher";
import currentDispatcher from "./src/currentDispatcher";
import { jsxDEV, jsx, isValidElement as _isValidElement } from "./src/jsx";
import ReactCurrentBatchConfig from "./src/currentBatchConfig";
import { ReactContext, Usable } from "shared/ReactTypes";
export { memo } from "./src/memo";
export * from './src/context';
export {
    REACT_FRAGMENT_TYPE as Fragment,
    REACT_SUSPENSE_TYPE as Suspense
} from 'shared/ReactSymbols';

export const useState: Dispatcher['useState'] = (initialState) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useTransition();
}

export const useRef: Dispatcher['useRef'] = <T>(initialValue: T) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useRef<T>(initialValue);
}

export const useContext: Dispatcher['useContext'] = <T>(context: ReactContext<T>) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useContext(context);
}

export const use: Dispatcher['use'] = <T>(usable: Usable<T>) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.use(usable);
}

/** 数据共享层 */
export const Sharing = {
    currentDispatcher,
    ReactCurrentBatchConfig
};

export const version = '0.0.0';

// TODO 根据环境区分 jsx 还是 jsxDEV
export const createElement = jsxDEV;

export const isValidElement = _isValidElement;
