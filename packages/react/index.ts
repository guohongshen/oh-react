import { Dispatcher, resolveDispatcher } from "./src/currentDispatcher";
import currentDispatcher from "./src/currentDispatcher";
import { jsxDEV, jsx, isValidElement as _isValidElement } from "./src/jsx";

export const useState: Dispatcher['useState'] = (initialState) => {
    const dispatcher = resolveDispatcher();
    return dispatcher.useState(initialState);
};

/** 数据共享层 */
export const Sharing = {
    currentDispatcher
};

export const version = '0.0.0';

// TODO 根据环境区分 jsx 还是 jsxDEV
export const createElement = jsx;

export const isValidElement = _isValidElement;
