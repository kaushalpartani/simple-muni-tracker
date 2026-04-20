import type { Stop } from '$lib/types/muni';

const STOPS_KEY = 'muni-stops';
const REFRESH_INTERVAL_KEY = 'muni-refresh-interval';
const LOCATION_GRANTED_KEY = 'muni-location-granted';
const SORT_BY_DISTANCE_KEY = 'muni-sort-by-distance';

// Save stops to localStorage
export function saveStops(stops: Stop[]): void {
	localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
}

// Load stops from localStorage
export function loadStops(): Stop[] {
	const saved = localStorage.getItem(STOPS_KEY);
	if (saved) {
		try {
			return JSON.parse(saved);
		} catch (err) {
			console.error('Error parsing saved stops:', err);
			return [];
		}
	}
	return [];
}

// Save refresh interval to localStorage
export function saveRefreshInterval(interval: number): void {
	localStorage.setItem(REFRESH_INTERVAL_KEY, interval.toString());
}

// Load refresh interval from localStorage
export function loadRefreshInterval(): number {
	const saved = localStorage.getItem(REFRESH_INTERVAL_KEY);
	if (saved) {
		const parsed = parseInt(saved);
		if (!isNaN(parsed) && parsed >= 5 && parsed <= 60) {
			return parsed;
		}
	}
	return 10; // Default value
}

// Save location permission status to localStorage
export function saveLocationGranted(granted: boolean): void {
	localStorage.setItem(LOCATION_GRANTED_KEY, granted.toString());
}

// Load location permission status from localStorage
export function loadLocationGranted(): boolean {
	const saved = localStorage.getItem(LOCATION_GRANTED_KEY);
	return saved === 'true';
}

// Save distance sorting preference
export function saveSortByDistanceEnabled(enabled: boolean): void {
	localStorage.setItem(SORT_BY_DISTANCE_KEY, enabled.toString());
}

// Load distance sorting preference
export function loadSortByDistanceEnabled(): boolean {
	const saved = localStorage.getItem(SORT_BY_DISTANCE_KEY);
	return saved === 'true';
}
