import { ReactElement } from "shared/ReactTypes";
// @ts-ignore
import { createRoot } from "react-dom";


export function renderIntoContainer(element: ReactElement) {
    const div = document.createElement('div');
    createRoot(div).render(element);
}
