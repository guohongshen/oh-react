/**
 * @file
 * context 相关的逻辑。
 */
import { ReactContext } from "shared/ReactTypes";

let prevContextValue: any = null;

/**
 * 不包括 current value，所以是 prev，current value 在 context._currentValue，没必
 * 要往数组里面添加。
 */
const prevContextValuesStack: any[] = [];

export function pushContextValue<T>(context: ReactContext<T>, newValue: T) {
    console.log('newValue: ', newValue);
    
    prevContextValuesStack.push(context._currentValue);
    context._currentValue = newValue;
}

export function popContextValue<T>(context: ReactContext<T>) {
    context._currentValue = prevContextValuesStack.pop();
}
