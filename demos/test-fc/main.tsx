import React, { useState, useTransition } from 'react';
import ReactDOM from 'react-dom';
import TabButton from './TabButton';
import AboutTab from './AboutTab';
import PostsTab from './PostsTab';
import ContactTab from './ContactTab';

let a = 0;

export default function TabContainer() {
  console.log('>>>>>>>>>>>>>>>>>>');
  
  if (!a) {
    a = 1;
  } else {
    // debugger;
  }
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');
console.log('isPending: ', isPending);
console.log('tab: ', tab);


  function selectTab(nextTab) {
    startTransition(() => {
      console.log('nextTab: ', nextTab);
      
      setTab(nextTab);
    });
  }

  return (
    <>
      <TabButton
        isActive={tab === 'about'}
        onClick={() => selectTab('about')}
      >
        About
      </TabButton>
      <TabButton
        isActive={tab === 'posts'}
        onClick={() => selectTab('posts')}
      >
        Posts (slow)
      </TabButton>
      <TabButton
        isActive={tab === 'contact'}
        onClick={() => selectTab('contact')}
      >
        Contact
      </TabButton>
      <hr />
      {tab === 'about' && <AboutTab />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'contact' && <ContactTab />}
    </>
  );
}
// @ts-ignore
ReactDOM.createRoot(
  document.getElementById('root')
).render(<TabContainer/>)
