import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { jsxDEV } from 'react/jsx-dev-runtime';

function App(params) {
  const [num, setNum] = useState(100);
  (window as any).asd = setNum;
  return (
    <div onClick={() => {
      setNum(num + 1)
    }}>
      {num}
    </div>
  );
}

function Child(params) {
  return <span>Big-React</span>
}

console.log(<App/>);
console.log('JSX: ', jsxDEV);


ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />,
)
