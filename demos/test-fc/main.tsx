import React from 'react';
import ReactDOM from 'react-dom/client';
import { jsxDEV } from 'react/jsx-dev-runtime';

function App(params) {
  return (
    <div>
      <Child></Child>
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
