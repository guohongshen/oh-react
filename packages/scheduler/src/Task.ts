/**
 * 任务的类定义
 */
import { getCurrentTime } from "./utils";
import { Priority, Timeouts } from "./Priority";

/**
 * 时间分片所依赖的基础之一是任务分片
 */
export type Executor = (reachDeadline?: boolean) => any; /* Executor */

export function isExecutor(executor: any) {
	return typeof executor === 'function';
}

/**
 * 任务类
 */
export default class Task {
	/**
	 * 下一个可分配的任务 id
	 */
	public static nextId = 1;
	/**
	 * 任务 id，唯一标识
	 */
	public id: number;
	/**
	 * 任务执行函数
	 */
	public executor: Executor;
	/**
	 * 任务优先级
	 */
	public priority: Priority;
	/**
	 * 在这一刻以及之后，任务可以被执行
	 */
	public startTime: number;
	/**
	 * 在这一刻以及之前，任务必须执行完
	 */
	public deadline: number;
	constructor(
		currentTime: number,
		priority: Priority,
		executor: Executor,
		options?: {
			/**
			 * startTime 往后偏移一段
			 */
			delay: number
		}
	) {
		currentTime = currentTime || getCurrentTime(); // 以外部传入的时间外准以防止轻微的时间误差
		let startTime = currentTime;
		if (options && options.delay && options.delay > 0) {
			startTime += options.delay;
		}
		const deadline = Timeouts[priority] + startTime;
		this.id = Task.nextId++;
		this.executor = executor;
		this.priority = priority;
		this.startTime = startTime;
		this.deadline = deadline;
	}
}
