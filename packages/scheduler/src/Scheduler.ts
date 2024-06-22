import { Priorities } from "./Priority";
import Task, { Executor } from "./Task";
import { Priority } from "./Priority";
import Heap from "./Heap";
import { getCurrentTime, localClearTimeout, localSetTimeout } from "./utils";

/**
 * 任务调度器
 */
export default class Scheduler {
	/**
	 * 当下的时刻（可以看做是调度器手上戴的表），它并不是实时更新的，只是需要用的时候重新获取一下
	 */
	private currentTime = -1;
	/**
	 * 当前时间片的开始时刻
	 */
	private sliceStart = -1;
	/**
	 * 时间片的长度（单位：ms）
	 */
	private sliceLength = 5;
	/**
	 * 睡眠任务队列，这些任务的可开始执行时刻晚于当下时刻
	 */
	private sleepQueue = new Heap<Task>('startTime');
	/**
	 * 就绪任务队列，这些任务当下是应该被按序执行的，有逾期的也有没逾期的
	 */
	private readyQueue = new Heap<Task>('deadline');
	/**
	 * 设置下一时间片的工作。
	 */
	private prepareToWorkInNextSlice: () => void;
	/**
	 * 下一时间片是否需要工作（一个标志位）。
	 */
	private ifNextSliceWillWork = false;
	constructor() {
		this.init();
	}
	/**
	 * 初始化操作。
	 */
	private init() {
		if (MessageChannel) {
			const channel = new MessageChannel();
			channel.port1.onmessage = this.work;
			this.prepareToWorkInNextSlice = () => {
				this.ifNextSliceWillWork = true;
				channel.port2.postMessage(null);
			}
		} else {
			this.prepareToWorkInNextSlice = () => {
				this.ifNextSliceWillWork = true;
				localSetTimeout(this.work, 0);
			}
		}
	}
	/**
	 * 刷新 currentTime 以保证实时。
	 */
	private refreshCurrentTime() {
		this.currentTime = getCurrentTime();
		return this.currentTime;
	}
	/**
	 * 根据 currentTime 叫醒已经可以被执行的 sleeping tasks。
	 */
	private wake() {
		const { sleepQueue, readyQueue } = this;
		let task = sleepQueue.peek();
		while (task) {
			if (!task.executor) {
				sleepQueue.pop();
			} else if (task.startTime <= this.currentTime) { // 该叫醒了
				sleepQueue.pop();
				readyQueue.push(task);
			} else {
				return; // 没事儿，继续睡
			}
			task = sleepQueue.peek();
		}
	}
	/**
	 * 检查当前时间片是否结束了。
	 * @returns
	 */
	public ifSliceEnd(): boolean {
		// TODO 这里对应的是 shouldYieldToHost，其内容再详细看下
		const cost = getCurrentTime() - this.sliceStart;
		return cost >= this.sliceLength;
	}
	/**
	 * 是否有个睡眠中的任务占用了 setTimeout
	 */
	private ifTimeoutCalled = false;
	/**
	 * 被占用的 timer id。
	 */
	private timeoutId = -1;
	/**
	 * 添加任务。
	 * @param priority 
	 * @param executor 
	 * @param options 
	 */
	public addTask(priority: Priority, executor: Executor, options?: { delay: number }): Task {
		const currentTime = this.refreshCurrentTime();
		const newTask = new Task(currentTime, priority, executor, options);
		const { readyQueue, sleepQueue } = this;
		if (newTask.startTime > currentTime) {
			sleepQueue.push(newTask);
			if (readyQueue.peek() === null && newTask === sleepQueue.peek()) {
				if (this.ifTimeoutCalled) {
					localClearTimeout(this.timeoutId);
					this.ifTimeoutCalled = false;
				} else {
					this.ifTimeoutCalled = true;
				}
				this.timeoutId = localSetTimeout(() => { }, newTask.startTime - currentTime);
			}
		} else {
			readyQueue.push(newTask);
			if (!this.ifNextSliceWillWork) {
				this.prepareToWorkInNextSlice();
			} // 如果下一阶段将会工作，那么就不需要再重复设置了
		}
		return newTask;
	}
	/**
	* 处理需要处理的 tasks。
	*/
	private work = () => {
		// 注意：work 有可能是 readyTasks 触发的，也可能是 sleepTask 触发的。
		this.sliceStart = this.refreshCurrentTime(); //  新的时间片开始
		this.ifNextSliceWillWork = false; // 新的时间片已经开始，重置为 false
		if (this.ifTimeoutCalled) { // 也可能是 setTimeout 触发的
			localClearTimeout(this.timeoutId);
			this.ifTimeoutCalled = false;
		}
		this.wake(); // 这一步决定了 readyQueue 一定不为空
		this.loop();
		const { readyQueue, sleepQueue } = this;
		if (readyQueue.peek()) {
			this.prepareToWorkInNextSlice();
		} else if (sleepQueue.peek()) {
			this.ifTimeoutCalled = true;
			this.timeoutId = localSetTimeout(() => { }, (sleepQueue.peek() as Task).startTime - this.refreshCurrentTime());
		} else {
			return 'scheduler is waiting a new Task';
		}
	}
	/**
	 * 依次拿出任务来执行
	 */
	private loop() {
		let currentTask = this.readyQueue.peek();
		const { readyQueue } = this;
		while (currentTask) {
			if (this.ifSliceEnd()) {
				return;
			}
			let executor = currentTask.executor;
			if (typeof executor === 'function') {
				while (!!executor && this.ifSliceEnd()) {
					executor = executor();
				}
				if (!!executor || this.ifSliceEnd()) {
					currentTask.executor = executor;
					this.wake();
					return;
				} else {
					this.wake();
					readyQueue.pop();
				}
			} else {
				readyQueue.pop();
			}
			currentTask = readyQueue.peek();
		}
		return;
	}
}
