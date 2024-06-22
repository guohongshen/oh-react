export const localSetTimeout = window.setTimeout;
export const localClearTimeout = clearTimeout;
export const getCurrentTime: () => number =
	(typeof performance === 'object' && typeof performance.now === 'function')
		? () => performance.now()
		: () => Date.now();
