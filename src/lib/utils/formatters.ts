import type { Prediction } from '$lib/types/muni';

// Format minutes for display
export function formatMinutes(minutes: number): string {
	if (minutes === 0) return 'Now';
	if (minutes === 1) return '1 min';
	return `${minutes} min`;
}

// Format last refresh time
export function formatLastRefresh(date: Date): string {
	return date.toLocaleTimeString();
}

// Get next prediction for a route
export function getNextPrediction(predictions: Prediction[]): Prediction | null {
	return predictions.length > 0 ? predictions[0] : null;
}
