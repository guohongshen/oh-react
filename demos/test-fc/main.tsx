import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  (window as any).asd = setNum;
  const res = num !== 3
    ? <div>
      <span key="000"></span>
      <span key="001"></span>
      <span key="002"></span>
    </div>
    : <div>
    <span key="002"></span>
    </div>;
    (window as any).res = res;
    return res;
}

function Child(params) {
  return <span>Big-React</span>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App/>,
)
