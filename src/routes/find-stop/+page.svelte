<script lang="ts">
	import { onMount } from 'svelte';
	import { MapPin, Navigation, AlertCircle, Loader } from 'lucide-svelte';
	import L from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	
	// Import stores and utilities for adding stops
	import { 
		stops, 
		loading as storeLoading, 
		error as storeError,
		showModal,
		selectedStop
	} from '$lib/stores/muniStore';
	import { fetchStopData, transformApiData } from '$lib/utils/muniApi';
	import { saveLocationGranted, loadLocationGranted } from '$lib/utils/localStorage';
	import { disableScroll, enableScroll } from '$lib/utils/scrollManager';
	
	// Import components
	import StopModal from '$lib/components/StopModal.svelte';

	interface MuniStop {
		stopId: string;
		lat: number;
		lng: number;
	}

	let mapContainer: HTMLDivElement;
	let map: L.Map;
	let userMarker: L.Marker | null = null;
	let stopMarkers: L.Marker[] = [];
	let loading = $state(false);
	let error = $state('');
	let locationGranted = $state(false);
	let userLocation: { lat: number; lng: number } | null = $state(null);
	let nearbyStops: MuniStop[] = $state([]);

	// Reactive statement to handle modal state changes
	$effect(() => {
		if ($showModal) {
			disableScroll();
		} else {
			enableScroll();
		}
	});

	// Parse CSV data to extract stops
	async function loadMuniStops(): Promise<MuniStop[]> {
		try {
			const response = await fetch('/muni_stops.csv');
			const csvText = await response.text();
			const lines = csvText.trim().split('\n').slice(1); // Skip header
			
			return lines.map(line => {
				var [stopId, shape] = line.split(',');
                stopId = "1" + stopId
				// Parse POINT (-122.465411 37.740759) format
				const coords = shape.match(/POINT \(([^)]+)\)/);
				if (coords) {
					const [lng, lat] = coords[1].split(' ').map(Number);
					return { stopId, lat, lng };
				}
				return null;
			}).filter(Boolean) as MuniStop[];
		} catch (err) {
			console.error('Error loading Muni stops:', err);
			return [];
		}
	}

	// Calculate distance between two points in km
	function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const R = 6371; // Earth's radius in km
		const dLat = (lat2 - lat1) * Math.PI / 180;
		const dLng = (lng2 - lng1) * Math.PI / 180;
		const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
			Math.sin(dLng/2) * Math.sin(dLng/2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		return R * c;
	}

	// Find stops within a certain radius (default 1km)
	function findNearbyStops(userLat: number, userLng: number, allStops: MuniStop[], radiusKm = 1): MuniStop[] {
		return allStops
			.map(stop => ({
				...stop,
				distance: calculateDistance(userLat, userLng, stop.lat, stop.lng)
			}))
			.filter(stop => stop.distance <= radiusKm)
			.sort((a, b) => a.distance - b.distance);
	}

	// Initialize the map
	function initializeMap(lat: number, lng: number) {
		if (map) {
			map.remove();
		}

		map = L.map(mapContainer, {
			center: [lat, lng],
			zoom: 16,
			zoomControl: true
		});

		// Add Carto Light_all tiles
		L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 20
		}).addTo(map);

		// Add user location marker
		const userIcon = L.divIcon({
			html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>`,
			className: 'user-location-marker',
			iconSize: [16, 16],
			iconAnchor: [8, 8]
		});

		userMarker = L.marker([lat, lng], { icon: userIcon })
			.addTo(map)
			.bindPopup('Your location');
	}

	// Add stop markers to the map
	function addStopMarkers(stops: MuniStop[]) {
		// Clear existing markers
		stopMarkers.forEach(marker => marker.remove());
		stopMarkers = [];

		stops.forEach(stop => {
			// Create a small box with stop code (keep the full stop code with "1")
			const stopIcon = L.divIcon({
				html: `<div class="stop-code-box bg-white border-2 border-red-500 text-red-600 text-xs font-bold px-2 py-1 rounded shadow-lg cursor-pointer hover:bg-red-50 transition-colors" style="white-space: nowrap; text-align: center; min-width: fit-content;">${stop.stopId}</div>`,
				className: 'stop-marker-box',
				iconSize: [40, 20],
				iconAnchor: [20, 10]
			});

			const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon })
				.addTo(map);

			// Add click event to show modal
			marker.on('click', () => openStopModal(stop.stopId));
			
			stopMarkers.push(marker);
		});
	}

	// Open stop modal with data
	async function openStopModal(stopId: string) {
		storeLoading.set(true);
		storeError.set('');

		try {
			const data = await fetchStopData(stopId);
			const stopData = transformApiData(stopId, data);
			selectedStop.set(stopData);
			showModal.set(true);
		} catch (err) {
			storeError.set(`Error loading stop data: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			storeLoading.set(false);
		}
	}

	// Close modal
	function closeModal() {
		showModal.set(false);
		selectedStop.set(null);
	}

	// Toggle route ignore (for modal compatibility)
	function toggleRouteIgnore(stopCode: string, routeId: string) {
		// Since this is a temporary modal view, we don't need to persist route ignoring
		// But we need to update the selectedStop to reflect changes
		if ($selectedStop && $selectedStop.code === stopCode) {
			const updatedStop = {
				...$selectedStop,
				routes: $selectedStop.routes.map((route: any) => {
					if (route.id === routeId) {
						const ignoredRoutes = $selectedStop.ignoredRoutes || [];
						const isIgnored = ignoredRoutes.includes(routeId);
						
						// Update the selectedStop's ignoredRoutes
						const newIgnoredRoutes = isIgnored 
							? ignoredRoutes.filter((id: any) => id !== routeId)
							: [...ignoredRoutes, routeId];
						
						$selectedStop.ignoredRoutes = newIgnoredRoutes.length > 0 ? newIgnoredRoutes : undefined;
					}
					return route;
				})
			};
			selectedStop.set(updatedStop);
		}
	}



	// Request user location
	async function requestLocation() {
		loading = true;
		error = '';

		try {
			if (!navigator.geolocation) {
				throw new Error('Geolocation is not supported by this browser');
			}

			const position = await new Promise<GeolocationPosition>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 300000 // 5 minutes
				});
			});

			userLocation = {
				lat: position.coords.latitude,
				lng: position.coords.longitude
			};

			locationGranted = true;
			saveLocationGranted(true);
			
			// Load all stops and find nearby ones
			const allStops = await loadMuniStops();
			nearbyStops = findNearbyStops(userLocation.lat, userLocation.lng, allStops);

			// Initialize map with user location
			initializeMap(userLocation.lat, userLocation.lng);
			
			// Add stop markers
			addStopMarkers(nearbyStops);

		} catch (err: any) {
			console.error('Error getting location:', err);
			if (err.code === 1) {
				error = 'Location access denied. Please enable location permissions and try again.';
				saveLocationGranted(false);
			} else if (err.code === 2) {
				error = 'Location unavailable. Please check your GPS settings.';
			} else if (err.code === 3) {
				error = 'Location request timed out. Please try again.';
			} else {
				error = err.message || 'Failed to get your location';
			}
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		// Fix for Leaflet marker icons in production
		delete (L.Icon.Default.prototype as any)._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
			iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
			shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
		});

		// Check if location was previously granted
		const wasLocationGranted = loadLocationGranted();
		if (wasLocationGranted) {
			requestLocation();
		}
	});
</script>

<svelte:head>
	<title>Find Nearby Stops - Simple Muni Tracker</title>
	<meta name="description" content="Find Muni stops near your location with an interactive map" />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-white shadow-sm border-b">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3">
					<MapPin class="w-6 h-6 text-blue-600" />
					<h1 class="text-xl font-semibold text-gray-900">Find Nearby Stops</h1>
				</div>
				<a 
					href="/" 
					class="text-sm text-blue-600 hover:text-blue-800 font-medium"
				>
					← Back to Tracker
				</a>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		{#if !locationGranted}
			<!-- Location Permission Request -->
			<div class="max-w-md mx-auto">
				<div class="bg-white rounded-lg shadow-sm border p-6 text-center">
					<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<Navigation class="w-8 h-8 text-blue-600" />
					</div>
					
					<h2 class="text-lg font-semibold text-gray-900 mb-2">
						Find Stops Near You
					</h2>
					
					<p class="text-gray-600 mb-6">
						We'll use your location to show nearby Muni stops on an interactive map. 
						Your location data is not stored or shared.
					</p>

					{#if error}
						<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
							<div class="flex items-center">
								<AlertCircle class="w-4 h-4 text-red-500 mr-2" />
								<span class="text-sm text-red-700">{error}</span>
							</div>
						</div>
					{/if}

					<button
						onclick={requestLocation}
						disabled={loading}
						class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
					>
						{#if loading}
							<Loader class="w-4 h-4 animate-spin" />
							<span>Getting your location...</span>
						{:else}
							<Navigation class="w-4 h-4" />
							<span>Share My Location</span>
						{/if}
					</button>

					<p class="text-xs text-gray-500 mt-3">
						Click "Allow" when your browser asks for location permission
					</p>
				</div>
			</div>
		{:else}
			<!-- Map and Results -->
			<div class="space-y-6">
				<!-- Stats -->
				<div class="bg-white rounded-lg shadow-sm border p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-2">
							<MapPin class="w-5 h-5 text-green-600" />
							<span class="text-sm font-medium text-gray-900">
								Found {nearbyStops.length} stops within 1km
							</span>
						</div>
						<button
							onclick={requestLocation}
							disabled={loading}
							class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
						>
							<Navigation class="w-4 h-4" />
							<span>Refresh Location</span>
						</button>
					</div>
				</div>

				<!-- Map -->
				<div class="bg-white rounded-lg shadow-sm border overflow-hidden">
					<div 
						bind:this={mapContainer}
						class="w-full h-96 relative"
					>
						<!-- Map loads here -->
					</div>
				</div>

				<!-- Error display for stop adding -->
				{#if $storeError}
					<div class="bg-red-50 border border-red-200 rounded-lg p-4">
						<div class="flex items-center">
							<AlertCircle class="w-4 h-4 text-red-500 mr-2" />
							<span class="text-sm text-red-700">{$storeError}</span>
						</div>
					</div>
				{/if}


			</div>
		{/if}
	</main>
</div>

<!-- Stop Modal -->
<StopModal 
	onClose={closeModal}
	onToggleRouteIgnore={toggleRouteIgnore}
/>

<style>
	:global(.leaflet-container) {
		font-family: inherit;
		z-index: 1 !important;
	}
	
	:global(.leaflet-control-container) {
		z-index: 2 !important;
	}
	
	:global(.leaflet-popup) {
		z-index: 3 !important;
	}
	
	:global(.user-location-marker) {
		background: none !important;
		border: none !important;
	}
	
	:global(.stop-marker) {
		background: none !important;
		border: none !important;
	}
	
	:global(.stop-marker-box) {
		background: none !important;
		border: none !important;
	}
	
	:global(.stop-code-box:hover) {
		transform: scale(1.1);
	}
	
	/* Ensure modal appears above map */
	:global([role="dialog"]) {
		z-index: 9999 !important;
	}
</style>
