import React, { Fragment, Suspense, useState } from 'react';
import ReactDOM, { Container } from 'react-dom/client';
import App from './context';


ReactDOM.createRoot(
	document.getElementById('root') as Container
).render(<App />);
