import React, { Fragment, Suspense, memo, useState } from 'react';
import ReactDOM, { Container } from 'react-dom/client';

// 简单例子 + 没有Suspense catch的情况
export default function App() {
	const [num, setNum] = useState(0);
	console.log('App render', num);
	
	return (<div onClick={() => {
		setNum(num + 1);
	}}>
		<Cpn num={num} name="cpn1"/>
        <Cpn num={0} name="cpn2"/>
	</div>);
}

const Cpn = memo(function ({
    num, name
}: {
    num: number,
    name: string
}) {
	console.log(`child-${name} render`);
	return <div>
        {name}: {num}
        <Child/>
    </div>
})

function Child() {
    return 'Child';
}
