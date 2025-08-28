// Disable scroll when modal is open
export function disableScroll(): void {
	if (typeof document !== 'undefined') {
		document.body.style.overflow = 'hidden';
	}
}

// Enable scroll when modal is closed
export function enableScroll(): void {
	if (typeof document !== 'undefined') {
		document.body.style.overflow = '';
	}
}
