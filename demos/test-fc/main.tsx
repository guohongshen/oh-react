import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  if (!(window as any).setNum) {
    (window as any).setNum = setNum;
    (window as any).onClick = () => {
      setNum(num => num + 1);
    }
  }


  const arr = num % 2 === 0
    ? [
      <li key="1">1</li>,
      <li key="2">2</li>,
      <li key="3">3</li>
    ] : [
      <li key="3">3</li>,
      <li key="2">2</li>,
      <li key="1">1</li>
    ];
    console.log('arr: ', arr);
    
  return <ul onClick={(window as any).onClick}>
      {arr}
    </ul>

}

function Child(params) {
  return <span>Big-React</span>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App/>,
)
