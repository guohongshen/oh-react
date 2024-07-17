import scheduler, { Priority } from '../../packages/scheduler';
import './style.css';

const op = document.getElementById('op');
const content = document.getElementById('content');

interface WorkUnit {
    /** 插入多少个 span */
    insertCount: number;
    spanClassName: string;
    spanText: string | number;
}

function doWork(work: WorkUnit, didTimeout: boolean) {
    function mockBusy(len: number) {
        while (len) {
            --len;
        }
    }
    function insertSpan(text) {
        const span = document.createElement('span');
        span.innerText = text;
        span.className = work.spanClassName;
        mockBusy(100000000);
        content?.appendChild(span);
    }
    while (work.insertCount && (didTimeout || !scheduler.ifSliceEnd())) {
        work.insertCount--;
        insertSpan(work.spanText);
    }
    if (work.insertCount) {
        return doWork.bind(null, work);
    } else {
        return `${work.insertCount}-${work.spanClassName}-${work.spanText}`;
    }
}

(() => {
    let btn: any;
    let textMap = {
        1: '1(立即)',
        2: '2(用户交互)',
        3: '3(普通)',
        4: '4(低优先级)'
    };
    let nextSpanTextMap = {
        1: 1,
        2: 1,
        3: 1,
        4: 1
    };
    [1, 2, 3, 4].forEach(num => {
        btn = document.createElement('button');
        op?.appendChild(btn);
        btn.innerText = textMap[num];

        btn && (btn.onclick = () => {
            let workUnit: WorkUnit = {
                insertCount: 40,
                spanClassName: `priority-${num}`,
                spanText: nextSpanTextMap[num]++
            };
            function mockBusy(len: number) {
                while (len) {
                    --len;
                }
            }
            mockBusy(1000000000);
            scheduler.addTask(
                num,
                doWork.bind(null, workUnit)
            );
        });
    });
})()

