import { Priority } from "./src/Priority";
import Scheduler from "./src/Scheduler";

const scheduler = new Scheduler();
(window as any).scheduler = scheduler;

export { Priority, Scheduler };

export default scheduler;
