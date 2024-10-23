import React, { Fragment, Suspense, memo, useState, useContext, createContext } from 'react';
import ReactDOM, { Container } from 'react-dom/client';

const ctx = createContext(0);

// 简单例子 + 没有Suspense catch的情况
export default function App() {
	const [num, setNum] = useState(0);
	console.log('App render', num);
	
	return (<ctx.Provider value={num}>
        <div onClick={() => {
            setNum(1);
        }}>
            <Cpn />
        </div>
    </ctx.Provider>);
}

const Cpn = memo(function() {
	console.log(`Cpn render`);
	return <div>
        <Child/>
    </div>
})

function Child() {
    console.log('Child render');
    const val = useContext(ctx);
    return <div>ctx: {val}</div>;
}
