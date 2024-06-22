/**
 * 调度器的优先级
 */

export type Priority = number;

export const Priorities = {
	NoPriority: 0,
	ImmediatePriority: 1,
	UserBlockingPriority: 2,
	NormalPriority: 3,
	LowPriority: 4,
	IdlePriority: 5
};

export const Timeouts = {
	[Priorities.NoPriority]: 5000,
	[Priorities.ImmediatePriority]: -1,
	[Priorities.UserBlockingPriority]: 250,
	[Priorities.NormalPriority]: 5000,
	[Priorities.LowPriority]: 10000,
	[Priorities.IdlePriority]: 99999999 // 先设置一个非常大的值
}
