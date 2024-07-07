import React, { useState, useEffect } from 'react';
import ReactNoopRenderer from 'react-noop-renderer';

function App() {
  const [num, updateNum] = useState(0);
  useEffect(() => {
    console.log('App mount');
  }, []);

  useEffect(() => {
    console.log('num change create', num);
    return () => {
      console.log('num change destroy', num);
    };
  }, [num]);

  return (
    <div onClick={() => updateNum(num + 1)}>
      {num === 0 ? <Child /> : 'noop'}
    </div>
  );
}

function Child() {
  const [num, updateNum] = useState('child');
  useEffect(() => {
    console.log('Child mount');
    return () => console.log('Child unmount');
  }, []);

  return 'i am child';
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

// @ts-ignore
ReactNoopRenderer.createRoot().render(<App2/>)
