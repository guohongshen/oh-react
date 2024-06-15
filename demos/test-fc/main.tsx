import React, { Fragment, useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(0);
  if (!(window as any).setNum) {
    (window as any).setNum = setNum;
    (window as any).onClick = () => {
      // debugger;
      setNum(num => {
        console.log(num, num + 1);
        return num + 1;
      });
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
    console.log(num, arr);

    const res = <ul>
    {arr}
  </ul>;
  console.log('res: ', res);
  
  return res; 

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
  ul.insertBefore(li, ul.childNodes[0]);
}
*/

function ChildSum() {
  return 
}

function Child1(params) {
  return <span>Child1</span>
}
function Child2(params) {
  return <span>Child2</span>
}
function Child3(params) {
  return <span>Child3</span>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App/>,
)
