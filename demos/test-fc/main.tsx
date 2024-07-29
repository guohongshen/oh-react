import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

function App() {
  const [num, updateNum] = useState(100);
  

  return (
    <ul onClick={() => updateNum(50)}>
      {new Array(num).fill(0).map((_, i) => {
        return <Child key={i}>{i}</Child>
      })}
    </ul>
  );
}

function Child({ children }) {
  const now = performance.now();
  while (performance.now() - now < 4) {
  }
  return <li>{children}</li>
}

function App2() {
  return (
    <>
    <Child2/>
    <div>hello world<span>我</span></div>
    </>
  )
}

function Child2() {
  return 'Child';
}

let root = document.getElementById('root');

// @ts-ignore
ReactDOM.createRoot(
  document.getElementById('root')
).render(<App/>)
