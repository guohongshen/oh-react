/**
 * 任务的优先级
 */
export enum Priority {
	NoPriority = 0,
	ImmediatePriority = 1,
	UserBlockingPriority = 2,
	NormalPriority = 3,
	LowPriority = 4,
	IdlePriority = 5
};

/**
 * Max 31 bit integer. The max integer size in V8 for 32-bit systems.
 * Math.pow(2, 30) - 1
 * 0b111111111111111111111111111111
 */
const maxSigned31BitInt = 1073741823;

export const Timeouts = {
	[Priority.NoPriority]: 5000,
	[Priority.ImmediatePriority]: -1,
	[Priority.UserBlockingPriority]: 250,
	[Priority.NormalPriority]: 5000,
	[Priority.LowPriority]: 10000,
	[Priority.IdlePriority]: maxSigned31BitInt // 先设置一个非常大的值
}
