import React, { useContext, createContext } from 'react';
import ReactDOM from 'react-dom/client';

const contextA = createContext<any>(null);
const contextB = createContext<any>(undefined);

function App() {
	return (
		<contextA.Provider value={'2'}>
			<contextB.Provider value={'b'}>
				<contextA.Provider value={'3'}>
					<Cpn/>
				</contextA.Provider>
			</contextB.Provider>
			<Cpn/>
		</contextA.Provider>
	);
}

function Cpn() {
	const a = useContext(contextA);
	const b = useContext(contextB);
	return <p>{a}-{b}</p>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
