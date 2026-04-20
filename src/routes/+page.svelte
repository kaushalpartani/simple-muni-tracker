<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Settings, Map } from 'lucide-svelte';
	
	// Import components
	import SearchBar from '$lib/components/SearchBar.svelte';
	import StopCard from '$lib/components/StopCard.svelte';
	import StopModal from '$lib/components/StopModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ExportModal from '$lib/components/ExportModal.svelte';
	import Toast from '$lib/components/Toast.svelte';
	
	// Import stores
	import { 
		stops, 
		loading, 
		lastRefreshTime, 
		refreshIntervalSeconds, 
		sortByDistanceEnabled,
		reorderMode,
		draggedIndex,
		draggedOverIndex,
		showSettingsModal,
		showModal,
		selectedStop,
		importData,
		importError,
		exportData,
		showExportData,
		autoRefreshInterval,
		toastMessage,
		toastVisible,
		toastType
	} from '$lib/stores/muniStore';
	
	// Import utilities
	import { 
		loadStops, 
		loadRefreshInterval, 
		saveStops,
		loadSortByDistanceEnabled,
		saveSortByDistanceEnabled,
		saveLocationGranted
	} from '$lib/utils/localStorage';
	import { refreshAllStops } from '$lib/utils/muniApi';
	import { formatLastRefresh } from '$lib/utils/formatters';
	import { disableScroll, enableScroll } from '$lib/utils/scrollManager';

	interface StopCoordinates {
		lat: number;
		lng: number;
	}

	let currentLocation: StopCoordinates | null = $state(null);
	let stopCoordinatesByCode: Record<string, StopCoordinates> = $state({});

	function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const R = 3959;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLng = ((lng2 - lng1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLng / 2) *
				Math.sin(dLng / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	async function loadStopCoordinates(): Promise<void> {
		try {
			const response = await fetch('/muni_stops.csv');
			const csvText = await response.text();
			const lines = csvText.trim().split('\n').slice(1);
			const parsedCoordinates: Record<string, StopCoordinates> = {};

			for (const line of lines) {
				const [stopIdRaw, shape] = line.split(',');
				const coords = shape?.match(/POINT \(([^)]+)\)/);
				if (!coords) continue;
				const [lng, lat] = coords[1].split(' ').map(Number);
				const prefixedCode = `1${stopIdRaw}`;
				parsedCoordinates[stopIdRaw] = { lat, lng };
				parsedCoordinates[prefixedCode] = { lat, lng };
			}

			stopCoordinatesByCode = parsedCoordinates;
		} catch (err) {
			console.error('Failed to load stop coordinates for distance sorting:', err);
		}
	}

	async function requestCurrentLocation(): Promise<boolean> {
		if (!navigator.geolocation) {
			toastMessage.set('Geolocation is not supported by this browser.');
			toastType.set('error');
			toastVisible.set(true);
			return false;
		}

		try {
			const position = await new Promise<GeolocationPosition>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 30000
				});
			});

			currentLocation = {
				lat: position.coords.latitude,
				lng: position.coords.longitude
			};
			saveLocationGranted(true);
			return true;
		} catch (err: any) {
			saveLocationGranted(false);
			const errorMessage =
				err?.code === 1
					? 'Location access denied. Enable "Always allow" in browser settings to sort by distance.'
					: 'Unable to get current location for distance sorting.';
			toastMessage.set(errorMessage);
			toastType.set('error');
			toastVisible.set(true);
			return false;
		}
	}

	async function onToggleDistanceSort(enabled: boolean): Promise<void> {
		if (enabled) {
			toastMessage.set('Please choose "Always allow" when your browser asks for location permission.');
			toastType.set('info');
			toastVisible.set(true);

			const granted = await requestCurrentLocation();
			if (!granted) {
				sortByDistanceEnabled.set(false);
				saveSortByDistanceEnabled(false);
				return;
			}

			if ($reorderMode) {
				reorderMode.set(false);
			}
		}

		sortByDistanceEnabled.set(enabled);
		saveSortByDistanceEnabled(enabled);
	}

	let displayStops = $derived.by(() => {
		const location = currentLocation;
		if (!$sortByDistanceEnabled || !location || Object.keys(stopCoordinatesByCode).length === 0) {
			return $stops;
		}

		return [...$stops].sort((a, b) => {
			const aCoords = stopCoordinatesByCode[a.code];
			const bCoords = stopCoordinatesByCode[b.code];
			if (!aCoords && !bCoords) return 0;
			if (!aCoords) return 1;
			if (!bCoords) return -1;

			const distanceA = calculateDistance(location.lat, location.lng, aCoords.lat, aCoords.lng);
			const distanceB = calculateDistance(location.lat, location.lng, bCoords.lat, bCoords.lng);
			return distanceA - distanceB;
		});
	});

	// Reactive statements to handle modal state changes
	$effect(() => {
		if ($showModal || $showSettingsModal) {
			disableScroll();
		} else {
			enableScroll();
		}
	});

	// Load saved stops and settings from localStorage
	onMount(() => {
		const savedStops = loadStops();
		if (savedStops.length > 0) {
			stops.set(savedStops);
		}

		const savedSortByDistance = loadSortByDistanceEnabled();
		sortByDistanceEnabled.set(savedSortByDistance);
		loadStopCoordinates();
		if (savedSortByDistance) {
			requestCurrentLocation();
		}
				
		// Load saved refresh interval
		const savedInterval = loadRefreshInterval();
		refreshIntervalSeconds.set(savedInterval);
		
		// Start auto-refresh if there are stops
		if (savedStops.length > 0) {
			startAutoRefresh();
		}

		// Function to sync stops from localStorage
		const syncStopsFromStorage = () => {
			const currentStops = loadStops();
			const currentStopCodes = new Set($stops.map(s => s.code));
			const storageStopCodes = new Set(currentStops.map(s => s.code));
			
			// Check if there are differences between current store and localStorage
			const hasChanges = currentStops.length !== $stops.length || 
				!currentStops.every(stop => currentStopCodes.has(stop.code)) ||
				!$stops.every(stop => storageStopCodes.has(stop.code));
			
			if (hasChanges) {
				stops.set(currentStops);
				
				// Start auto-refresh if we now have stops and it's not already running
				if (currentStops.length > 0 && !$autoRefreshInterval) {
					startAutoRefresh();
				}
				// Stop auto-refresh if no stops remain
				else if (currentStops.length === 0 && $autoRefreshInterval) {
					stopAutoRefresh();
				}
			}
		};

		// Listen for storage changes from other tabs/pages
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === 'muni-stops') {
				syncStopsFromStorage();
			}
		};

		// Listen for page visibility changes to sync when user returns to this page
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				syncStopsFromStorage();
			}
		};

		// Listen for focus events to sync when user returns to this tab
		const handleFocus = () => {
			syncStopsFromStorage();
		};

		window.addEventListener('storage', handleStorageChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		
		refreshAll();
		// Cleanup function
		return () => {
			window.removeEventListener('storage', handleStorageChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
		};
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if ($autoRefreshInterval) {
			clearInterval($autoRefreshInterval);
		}
		// Re-enable scroll when component is destroyed
		enableScroll();
	});

	// Start auto-refresh
	function startAutoRefresh() {
		if ($autoRefreshInterval) {
			clearInterval($autoRefreshInterval);
		}
		
		const interval = setInterval(async () => {
			if ($stops.length > 0 && !$loading) {
				await refreshAll();
			}
		}, $refreshIntervalSeconds * 1000);
		
		autoRefreshInterval.set(interval);
	}

	// Stop auto-refresh
	function stopAutoRefresh() {
		if ($autoRefreshInterval) {
			clearInterval($autoRefreshInterval);
			autoRefreshInterval.set(null);
		}
	}

	// Refresh all stops
	async function refreshAll() {
		loading.set(true);
		const updatedStops = await refreshAllStops($stops);
		stops.set(updatedStops);
		saveStops(updatedStops);
		if ($sortByDistanceEnabled) {
			await requestCurrentLocation();
		}
		loading.set(false);
		lastRefreshTime.set(new Date());
		
		// Update selectedStop if modal is open to reflect refreshed data
		if ($selectedStop) {
			const refreshedStop = updatedStops.find(s => s.code === $selectedStop!.code);
			if (refreshedStop) {
				selectedStop.set(refreshedStop);
			}
		}
	}

	// Open modal
	function openModal(stop: any) {
		selectedStop.set(stop);
		showModal.set(true);
	}

	// Close modal
	function closeModal() {
		showModal.set(false);
		selectedStop.set(null);
	}

	// Open settings modal
	function openSettingsModal() {
		showSettingsModal.set(true);
	}

	// Remove a stop
	function removeStop(code: string) {
		const updatedStops = $stops.filter(stop => stop.code !== code);
		stops.set(updatedStops);
		saveStops(updatedStops);
		
		// Stop auto-refresh if no stops remain
		if (updatedStops.length === 0) {
			stopAutoRefresh();
		}
	}

	// Toggle reorder mode
	function toggleReorderMode() {
		if ($sortByDistanceEnabled) {
			toastMessage.set('Disable distance sorting to reorder tiles manually.');
			toastType.set('info');
			toastVisible.set(true);
			return;
		}
		reorderMode.set(!$reorderMode);
	}

	// Drag and drop functions
	function handleDragStart(e: DragEvent, index: number) {
		if (!$reorderMode) return;
		
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
		draggedIndex.set(index);
	}

	function handleDragOver(e: DragEvent, index: number) {
		if (!$reorderMode) return;
		
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		draggedOverIndex.set(index);
	}

	function handleDragLeave() {
		draggedOverIndex.set(null);
	}

	function handleDrop(e: DragEvent, index: number) {
		if (!$reorderMode || $draggedIndex === null) return;
		
		e.preventDefault();
		if ($draggedIndex !== index) {
			const newStops = [...$stops];
			const [draggedItem] = newStops.splice($draggedIndex, 1);
			newStops.splice(index, 0, draggedItem);
			stops.set(newStops);
			saveStops(newStops);
		}
		
		draggedIndex.set(null);
		draggedOverIndex.set(null);
	}

	function handleDragEnd() {
		draggedIndex.set(null);
		draggedOverIndex.set(null);
	}

	// Touch event handlers for mobile
	function handleTouchStart(e: TouchEvent, index: number) {
		if (!$reorderMode) return;
		
		const touchY = e.touches[0].clientY;
		draggedIndex.set(index);
	}

	function handleTouchMove(e: TouchEvent, index: number) {
		if (!$reorderMode) return;
		
		e.preventDefault();
		const touchY = e.touches[0].clientY;
		const touchX = e.touches[0].clientX;
		
		// Get all card elements and find the one under the touch
		const cards = document.querySelectorAll('[data-stop-index]');
		let targetIndex = $draggedIndex;
		
		for (let i = 0; i < cards.length; i++) {
			const card = cards[i] as HTMLElement;
			const rect = card.getBoundingClientRect();
			
			// Check if touch is within the card bounds (both X and Y)
			if (touchX >= rect.left && touchX <= rect.right && 
				touchY >= rect.top && touchY <= rect.bottom) {
				targetIndex = parseInt(card.getAttribute('data-stop-index') || '0');
				break;
			}
		}
		
		if (targetIndex !== $draggedOverIndex) {
			draggedOverIndex.set(targetIndex);
		}
	}

	function handleTouchEnd(e: TouchEvent, index: number) {
		if (!$reorderMode) return;
		
		if ($draggedIndex !== null && $draggedOverIndex !== null && $draggedIndex !== $draggedOverIndex) {
			const newStops = [...$stops];
			const [draggedItem] = newStops.splice($draggedIndex, 1);
			newStops.splice($draggedOverIndex, 0, draggedItem);
			stops.set(newStops);
			saveStops(newStops);
		}
		
		draggedIndex.set(null);
		draggedOverIndex.set(null);
	}

	// Route ignoring functions
	function toggleRouteIgnore(stopCode: string, routeId: string) {
		const updatedStops = $stops.map(stop => {
			if (stop.code === stopCode) {
				const ignoredRoutes = stop.ignoredRoutes || [];
				const isIgnored = ignoredRoutes.includes(routeId);
				
				if (isIgnored) {
					// Remove from ignored routes
					const newIgnoredRoutes = ignoredRoutes.filter(id => id !== routeId);
					return {
						...stop,
						ignoredRoutes: newIgnoredRoutes.length > 0 ? newIgnoredRoutes : undefined
					};
				} else {
					// Add to ignored routes
					return {
						...stop,
						ignoredRoutes: [...ignoredRoutes, routeId]
					};
				}
			}
			return stop;
		});
		stops.set(updatedStops);
		saveStops(updatedStops);
		
		// Update selectedStop to reflect the changes immediately
		if ($selectedStop && $selectedStop.code === stopCode) {
			const updatedStop = updatedStops.find(s => s.code === stopCode);
			if (updatedStop) {
				selectedStop.set(updatedStop);
			}
		}
	}

	// Import/Export functions
	function exportState() {
		const jsonString = JSON.stringify($stops);
		exportData.set(jsonString);
		showExportData.set(true);
	}

	function importState() {
		if (!$importData) {
			importError.set('Please enter data to import');
			return;
		}

		try {
			// Parse the JSON
			const importedStops = JSON.parse($importData);
			
			// Validate the structure
			if (!Array.isArray(importedStops)) {
				throw new Error('Invalid data format: expected array of stops');
			}

			// Merge the imported stops with existing stops (avoiding duplicates)
			const existingStopCodes = new Set($stops.map(stop => stop.code));
			const newStops = importedStops.filter((stop: any) => !existingStopCodes.has(stop.code));
			
			if (newStops.length === 0) {
				importError.set('No new stops to import (all stops already exist)');
				return;
			}

			// Add the new stops
			const updatedStops = [...$stops, ...newStops];
			stops.set(updatedStops);
			saveStops(updatedStops);

			// Start auto-refresh if we have stops and it's not already running
			if (updatedStops.length > 0 && !$autoRefreshInterval) {
				startAutoRefresh();
			}

			// Clear the form
			importData.set('');
			importError.set('');
			
			// Close the modal
			showSettingsModal.set(false);
		} catch (err) {
			importError.set(`Import failed: ${err instanceof Error ? err.message : 'Invalid data'}`);
		}
	}

	function clearImportForm() {
		importData.set('');
		importError.set('');
	}

	function closeExportData() {
		showExportData.set(false);
		exportData.set('');
	}

	// Callback when stop is added
	function onStopAdded() {
		// Start auto-refresh if this is the first stop
		if ($stops.length === 1) {
			startAutoRefresh();
		}
	}

	// Update refresh interval
	function updateRefreshInterval() {
		if ($stops.length > 0) {
			startAutoRefresh();
		}
	}
</script>

<svelte:head>
	<title>Simple Muni Tracker</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-4xl mx-auto px-4 py-8">
		<!-- Header with Settings Gear and Map Icon -->
		<header class="text-center mb-8 md:mb-12 relative px-4">
			<!-- Settings Gear -->
			<button
				on:click={openSettingsModal}
				class="absolute left-0 top-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
				title="Settings"
			>
				<Settings class="w-5 h-5 md:w-6 md:h-6" />
			</button>
			
			<!-- Map Link -->
			<a
				href="/stop-map"
				class="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
				title="Browse stops on map"
			>
				<Map class="w-5 h-5 md:w-6 md:h-6" />
			</a>
			
			<h1 class="text-2xl md:text-3xl lg:text-4xl font-light text-gray-900 mb-2 leading-tight">Simple Muni Tracker</h1>
			<p class="text-sm md:text-base text-gray-600">Track your favorite MUNI stops</p>
		</header>

		<!-- Search Bar -->
		<SearchBar {onStopAdded} />

		<!-- Controls -->
		{#if $stops.length > 0}
			<div class="text-center mb-6 space-y-2">
				<button
					on:click={refreshAll}
					disabled={$loading}
					class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{$loading ? 'Refreshing...' : 'Refresh All'}
				</button>
				
				<!-- Auto-refresh status -->
				<div class="text-sm text-gray-600">
					{#if $autoRefreshInterval}
						<span class="text-green-600">🔄 Auto-refresh active ({$refreshIntervalSeconds}s)</span>
					{:else}
						<span class="text-gray-500">⏸️ Auto-refresh paused</span>
					{/if}
					{#if $lastRefreshTime}
						<span class="ml-2">• Last updated: {formatLastRefresh($lastRefreshTime)}</span>
					{/if}
				</div>

				<!-- Reorder toggle button -->
				<button
					on:click={toggleReorderMode}
					disabled={$sortByDistanceEnabled}
					class="px-4 py-2 text-sm border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed {$reorderMode ? 'bg-primary text-white border-primary hover:bg-red-700' : 'bg-white text-gray-700 hover:bg-gray-50'}"
				>
					{$reorderMode ? 'Exit Reorder Mode' : 'Reorder Tiles'}
				</button>
			</div>
		{/if}

		<!-- Stops Grid -->
		{#if $stops.length > 0}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each displayStops as stop, index (stop.code)}
					<StopCard
						{stop}
						{index}
						reorderMode={$reorderMode}
						draggedIndex={$draggedIndex}
						draggedOverIndex={$draggedOverIndex}
						onRemove={removeStop}
						onOpenModal={openModal}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						onDragEnd={handleDragEnd}
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
					/>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12">
				<p class="text-gray-600 mb-4">No stops saved yet</p>
				<p class="text-sm text-gray-500"><a href="/stop-map" class="text-primary hover:underline">Browse stops on the map</a></p>
			</div>
		{/if}
	</div>
</div>

<!-- Modals -->
<StopModal 
	onClose={closeModal}
	onToggleRouteIgnore={toggleRouteIgnore}
	onStopAdded={onStopAdded}
/>

<SettingsModal
	onUpdateRefreshInterval={updateRefreshInterval}
	onToggleDistanceSort={onToggleDistanceSort}
	onExportState={exportState}
	onImportState={importState}
	onClearImportForm={clearImportForm}
/>

<ExportModal onClose={closeExportData} />

<!-- Toast Notifications -->
<Toast />
