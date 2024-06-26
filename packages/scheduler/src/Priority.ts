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

export const Timeouts = {
	[Priority.NoPriority]: 5000,
	[Priority.ImmediatePriority]: -1,
	[Priority.UserBlockingPriority]: 250,
	[Priority.NormalPriority]: 5000,
	[Priority.LowPriority]: 10000,
	[Priority.IdlePriority]: 99999999 // 先设置一个非常大的值
}
