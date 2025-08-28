export interface Stop {
	code: string;
	name: string;
	nickname?: string; // Optional nickname field
	routes: Route[];
	ignoredRoutes?: string[]; // Array of route IDs to ignore
}

export interface Route {
	id: string;
	title: string;
	description: string;
	predictions: Prediction[];
}

export interface Prediction {
	minutes: number;
	direction: string;
	destination: string;
	occupancy: string;
	vehicleId: string;
}
