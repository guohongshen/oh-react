

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;
/**
 * 对于 fiber，新增 PassiveEffect，代表「当前 fiber 本次更新存在副作用」
*/
export const PassiveEffect = 0b0001000;

export type Flags = number;

export const MutationMask = Placement | Update | ChildDeletion;

export const PassiveMask = PassiveEffect | ChildDeletion;
// 如果依赖没有变化，但是组件标记删除，那么也要触发 useEffect destroy 回调
