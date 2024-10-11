import React from "react";
import { useEffect } from 'react';

export default function TabButton({ children, isActive, onClick }) {
  useEffect(() => {
    console.log(`TabButton ${children} mounted`);
  }, []);
  useEffect(() => {
    console.log('isActive changed, new value: ', isActive);
  }, [isActive]);
  return (
    <button onClick={() => {
      onClick();
    }}>
      {children}
    </button>
  )
}
