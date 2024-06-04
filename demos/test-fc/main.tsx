import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { jsxDEV } from 'react/jsx-dev-runtime';

function App(params) {
  const [num, setNum] = useState(100);
  (window as any).asd = setNum;
  const jsx = (
    <div onClick={() => {
      setNum(num + 1)
    }}>
      {num}
    </div>
  );
  console.log('jsx: ', jsx);
  return num !== 3
    ? <div>
    </div>
    : <div>
    <span></span>
    </div>;
}

function Child(params) {
  return <span>Big-React</span>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App/>,
)
