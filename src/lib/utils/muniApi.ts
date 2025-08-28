import type { Stop, Route, Prediction } from '$lib/types/muni';

// API configuration - using our server-side proxy
const API_BASE = '/api/muni';

// Fetch stop data from API
export async function fetchStopData(stopCode: string) {
	const response = await fetch(`${API_BASE}/${stopCode}`);
	
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const data = await response.json();
	
	if (data.error) {
		throw new Error(data.error);
	}
	
	if (data.length === 0) {
		throw new Error('No data found for this stop code');
	}

	return data;
}

// Transform API data to our Stop format
export function transformApiData(stopCode: string, data: any[]): Stop {
	return {
		code: stopCode,
		name: data[0].stop.name,
		routes: data.map((route: any) => ({
			id: route.route.id,
			title: route.route.title,
			description: route.route.description,
			predictions: route.values.map((pred: any) => ({
				minutes: pred.minutes,
				direction: pred.direction.name,
				destination: pred.direction.destinationName,
				occupancy: pred.occupancyDescription,
				vehicleId: pred.vehicleId
			}))
		}))
	};
}

// Refresh a single stop
export async function refreshStop(stop: Stop): Promise<Stop> {
	const data = await fetchStopData(stop.code);
	const updatedStop = transformApiData(stop.code, data);
	
	// Preserve nickname and ignored routes during refresh
	return {
		...updatedStop,
		nickname: stop.nickname,
		ignoredRoutes: stop.ignoredRoutes
	};
}

// Refresh all stops
export async function refreshAllStops(stops: Stop[]): Promise<Stop[]> {
	const updatedStops: Stop[] = [];
	
	for (const stop of stops) {
		try {
			const updatedStop = await refreshStop(stop);
			updatedStops.push(updatedStop);
		} catch (err) {
			console.error(`Error refreshing stop ${stop.code}:`, err);
			// Keep the original stop if refresh fails
			updatedStops.push(stop);
		}
	}
	
	return updatedStops;
}
