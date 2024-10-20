import React, { Fragment, Suspense, useState } from 'react';
import ReactDOM, { Container } from 'react-dom/client';

// 简单例子 + 没有Suspense catch的情况
function App() {
	const [num, setNum] = useState(0);
	console.log('App render', num);
	
	return (<div onClick={() => {
		setNum(1);
	}}>
		<Cpn />
	</div>);
}

function Cpn() {
	console.log('Cpn render');
	return <div>Cpn</div>
}

// 嵌套Suspense
// function App() {
// 	return (
// 		<Suspense fallback={<div>外层...</div>}>
// 			<Cpn id={0} timeout={1000} />
// 			<Suspense fallback={<div>内层...</div>}>
// 				<Cpn id={1} timeout={3000} />
// 			</Suspense>
// 		</Suspense>
// 	);
// }

// 缓存快速失效
// function App() {
// 	const [num, setNum] = useState(0);
// 	return (
// 		<div>
// 			<button onClick={() => setNum(num + 1)}>change id: {num}</button>
// 			<Suspense fallback={<div>loading...</div>}>
// 				<Cpn id={num} timeout={2000} />
// 			</Suspense>
// 		</div>
// 	);
// }

ReactDOM.createRoot(
	document.getElementById('root') as Container
).render(<App />);
