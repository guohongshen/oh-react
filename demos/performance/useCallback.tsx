import React, { Fragment, Suspense, memo, useCallback, useState } from 'react';
import ReactDOM, { Container } from 'react-dom/client';

// 简单例子 + 没有Suspense catch的情况
export default function App() {
	const [num, setNum] = useState(0);

	const onClick = useCallback(() => {
		setNum(num => num + 1);
	}, []);
	
	return (<div>
		<Cpn onClick={onClick} name="cpn1"/>
	</div>);
}

const Cpn = memo(function ({
    name, onClick
}: {
    name: string,
	onClick: any
}) {
	console.log(`${name} render`);
	return <div onClick={onClick}>
        {name}
    </div>
})
