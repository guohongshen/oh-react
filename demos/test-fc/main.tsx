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
    
  return <div>
    <ul onClick={(window as any).onClick}>
      {arr}
    </ul>
    <button id="button">点击我</button>
  </div>

}
/*
var btn = document.querySelector('button');
btn.onclick = () => {
  var ul = document.querySelector("ul");
  const children = ul.childNodes;
  var first = children[0];
  var third = children[2];
  var second = children[1];
  ul.insertBefore(third, second);
  ul.appendChild(first);
}

var btn = document.querySelector('button');
btn.onclick = () => {
  var ul = document.querySelector("ul");
  const children = ul.childNodes;
  var first = children[0];
  var third = children[2];
  var second = children[1];
  ul.appendChild(first);
}

var btn = document.querySelector('button');
btn.onclick = () => {
  var li = document.createElement('li');
  var ul = document.querySelector("ul");
  ul.appendChild(li);
}

var btn = document.querySelector('button');
btn.onclick = () => {
  var li = document.createElement('li');
  var ul = document.querySelector("ul");
  ul.insetBefore(li, ul.childNodes[0]);
}
*/

function Child(params) {
  return <span>Big-React</span>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App/>,
)
