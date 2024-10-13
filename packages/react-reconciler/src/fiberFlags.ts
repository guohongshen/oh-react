

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;
export const Visibility = 0b0100000;
/**
 * 对于 fiber，新增 PassiveEffect，代表「当前 fiber 本次更新存在副作用」
*/
export const PassiveEffect = 0b0001000;

export const Ref = 0b0010000;

export type Flags = number;

/**
 * effect mask used during mutation phrase，Mutation 阶段的工作掩码，也即用来判断 Mutation 阶段需要做什么工作。
 * 原名：MutationMask
 */
export const EffectMaskDuringMutation = Placement | Update | ChildDeletion | Ref | Visibility; // 有 Ref 即表示 mutation 阶段需要解绑 Ref

/**
 * effect mask used during layout phrase，Layout 阶段的工作掩码，也即用来判断 Mutation 阶段需要做什么工作。
 * 原名：LayoutMask
 */
export const EffectMaskDuringLayout = Ref; // 有 Ref 即表示 mutation 阶段需要解绑 Ref


/**
 * 如果依赖没有变化，但是组件标记删除，那么也要触发 useEffect destroy 回调。
 */
export const PassiveMask = PassiveEffect | ChildDeletion;

/**
 * (自己归类的)
 */
export const EffectMask = {
    Mutation: EffectMaskDuringMutation,
    Layout: EffectMaskDuringLayout
}
