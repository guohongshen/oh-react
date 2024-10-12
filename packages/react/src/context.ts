import { REACT_PROVIDER_TYPE, REACT_CONTEXT_TYPE } from "shared/ReactSymbols";
import { ReactContext } from "shared/ReactTypes";

export function createContext<T>(defaultValue: T): ReactContext<T> {
    const context: ReactContext<T> = {
        $$typeof: REACT_CONTEXT_TYPE,
        Provider: null,
        _currentValue: defaultValue
    };
    context.Provider = {
        $$typeof: REACT_PROVIDER_TYPE,
        _context: context
    };
    // Fragment 编译成 jsx 时，element.type === REACT_FRAGMENT_TYPE
    // 而 Provider 编译后，element.type 是一个对象，整个对象也有 $$typeof 属性（element
    // 也有，值是 REACT_ELEMENT_TYPE）。别晕了。
    return context;
}
