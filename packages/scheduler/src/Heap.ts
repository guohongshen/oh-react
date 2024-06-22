/**
 * 堆中元素的类型定义
 */
type Node = any;

/**
 * 小顶堆实现
 */
export default class Heap<T = Node> {
	/**
	 * 权重的属性
	 */
	private weightReference = 'weight';
	/**
	 * 元素数组
	 */
	private nodes: T[] = [];
	/**
	 * @param weightKey 权重属性 
	 */
	constructor(weightKey) {
		this.weightReference = weightKey || this.weightReference;
	}
	/**
	* 添加元素
	* @param node 
	* @returns 
	*/
	public push(node: T) {
		if (node) {
			this.nodes.push(node);
			this.up();
		}
		return node;
	}
	/**
	* 对末尾元素进行上提操作
	*/
	private up() {
		const { nodes } = this;
		let parent = -1, index = nodes.length - 1;
		while (index > 0) {
			parent = (index - 1) >> 1;
			if (this.compare(index, parent) < 0) {
				index = this.exchange(index, parent);
				continue;
			}
			break;
		}
	}
	public pop() {
		if (this.nodes.length <= 1) {
			return this.nodes.shift() || null;
		}
		this.exchange(0, this.nodes.length - 1);
		const task = this.nodes.pop();
		this.down();
		return task;
	}
	/**
	* 对堆顶元素进行下滑操作
	* @returns 
	*/
	private down() {
		const { nodes } = this;
		if (nodes.length <= 1) {
			return;
		}
		let parent = 0, leftChild = 1, rightChild = 2, smallest = -1;
		while (leftChild < nodes.length) {
			smallest = this.getSmallest([parent, leftChild, rightChild]);
			if (smallest === parent) {
				break;
			} else {
				parent = this.exchange(parent, smallest === leftChild ? leftChild : rightChild);
				leftChild = 2 * parent + 1; // 同理
				rightChild = leftChild + 1;
			}
		}
	}
	/**
	 * 返回堆顶元素
	 */
	public peek(): T | null {
		return this.nodes[0] || null;
	}
	/**
	* 比较两个元素的大小
	* @param x 
	* @param y 
	* @returns 
	*/
	private compare(x: number, y: number): number {
		return this.nodes[x][this.weightReference] - this.nodes[y][this.weightReference];
	}
	/**
	* 交换两个元素在数组中的位置
	* @param x 
	* @param y 
	* @returns 
	*/
	private exchange(x: number, y: number): number {
		if (x === y) {
			return y;
		}
		const { nodes } = this;
		const task = nodes[x];
		nodes[x] = nodes[y];
		nodes[y] = task;
		return y;
	}
	/**
	 * 返回索引列表中最小元素的索引
	 * @param indexes 
	 * @returns 
	 */
	private getSmallest(indexes: number[]): number {
		if (!indexes || indexes.length <= 0) {
			return -1;
		}
		let smallest = indexes[0];
		indexes.forEach(index => {
			if (this.compare(index, smallest) < 0) {
				smallest = index;
			}
		});
		return smallest;
	}
}
