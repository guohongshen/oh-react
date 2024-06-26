
/**
 * @file
 * 区分 useEffect useLayoutEffect 等等，可以看做它们都是 effect 类的 hook
 */


/**
 * 对于 effect hook，effect.tag === Passive 表示该 hook 是 useEffect
 */
export const Passive = 0b0010;

/**
 * 对于 effect hook，HookHasEffect 代表「当前 effect 在本次更新存在副作用」
 */
export const HookHasEffect = 0b0001;

export type HookEffectTag = number;
