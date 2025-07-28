<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { X, Search, Clock, Users, Settings } from 'lucide-svelte';

	// Types
	interface Stop {
		code: string;
		name: string;
		routes: Route[];
	}

	interface Route {
		id: string;
		title: string;
		description: string;
		predictions: Prediction[];
	}

	interface Prediction {
		minutes: number;
		direction: string;
		destination: string;
		occupancy: string;
		vehicleId: string;
	}

	// State
	let searchInput = '';
	let stops: Stop[] = [];
	let loading = false;
	let error = '';
	let selectedStop: Stop | null = null;
	let showModal = false;
	let showSettingsModal = false;
	let autoRefreshInterval: number | null = null;
	let lastRefreshTime = new Date();
	let refreshIntervalSeconds = 10;
	let reorderMode = false;

	// Drag and drop state
	let draggedIndex: number | null = null;
	let draggedOverIndex: number | null = null;
	let isDragging = false;
	let touchStartY = 0;
	let touchStartIndex = -1;

	// API configuration - using our server-side proxy
	const API_BASE = '/api/muni';

	// Scroll management
	function disableScroll() {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = 'hidden';
		}
	}

	function enableScroll() {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	}

	// Reactive statements to handle modal state changes
	$: if (showModal || showSettingsModal) {
		disableScroll();
	} else {
		enableScroll();
	}

	// Load saved stops and settings from localStorage
	onMount(() => {
		const saved = localStorage.getItem('muni-stops');
		if (saved) {
			stops = JSON.parse(saved);
		}
		
		// Load saved refresh interval
		const savedInterval = localStorage.getItem('muni-refresh-interval');
		if (savedInterval) {
			refreshIntervalSeconds = parseInt(savedInterval);
		}
		
		// Start auto-refresh if there are stops
		if (stops.length > 0) {
			startAutoRefresh();
		}
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
		}
		// Re-enable scroll when component is destroyed
		enableScroll();
	});

	// Start auto-refresh
	function startAutoRefresh() {
		if (autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
		}
		
		autoRefreshInterval = setInterval(async () => {
			if (stops.length > 0 && !loading) {
				await refreshAll();
				lastRefreshTime = new Date();
			}
		}, refreshIntervalSeconds * 1000);
	}

	// Stop auto-refresh
	function stopAutoRefresh() {
		if (autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
			autoRefreshInterval = null;
		}
	}

	// Save stops to localStorage
	function saveStops() {
		localStorage.setItem('muni-stops', JSON.stringify(stops));
	}

	// Save refresh interval to localStorage
	function saveRefreshInterval() {
		localStorage.setItem('muni-refresh-interval', refreshIntervalSeconds.toString());
	}

	// Add a new stop
	async function addStop() {
		if (!searchInput.trim()) return;

		const stopCode = searchInput.trim();
		if (stops.find(stop => stop.code === stopCode)) {
			error = 'Stop already saved';
			return;
		}

		loading = true;
		error = '';

		try {
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

			const newStop: Stop = {
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

			stops = [...stops, newStop];
			saveStops();
			searchInput = '';
			
			// Start auto-refresh if this is the first stop
			if (stops.length === 1) {
				startAutoRefresh();
			}
		} catch (err) {
			error = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			loading = false;
		}
	}

	// Remove a stop
	function removeStop(code: string) {
		stops = stops.filter(stop => stop.code !== code);
		saveStops();
		
		// Stop auto-refresh if no stops remain
		if (stops.length === 0) {
			stopAutoRefresh();
		}
	}

	// Refresh all stops
	async function refreshAll() {
		loading = true;
		for (const stop of stops) {
			try {
				const response = await fetch(`${API_BASE}/${stop.code}`);
				if (response.ok) {
					const data = await response.json();
					if (data.error) {
						console.error(`Error refreshing stop ${stop.code}:`, data.error);
						continue;
					}
					if (data.length > 0) {
						const updatedStop: Stop = {
							code: stop.code,
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
						stops = stops.map(s => s.code === stop.code ? updatedStop : s);
					}
				}
			} catch (err) {
				console.error(`Error refreshing stop ${stop.code}:`, err);
			}
		}
		saveStops();
		loading = false;
	}

	// Format minutes
	function formatMinutes(minutes: number): string {
		if (minutes === 0) return 'Now';
		if (minutes === 1) return '1 min';
		return `${minutes} min`;
	}

	// Get next prediction for a route
	function getNextPrediction(predictions: Prediction[]): Prediction | null {
		return predictions.length > 0 ? predictions[0] : null;
	}

	// Open modal
	function openModal(stop: Stop) {
		selectedStop = stop;
		showModal = true;
	}

	// Close modal
	function closeModal() {
		showModal = false;
		selectedStop = null;
	}

	// Open settings modal
	function openSettingsModal() {
		showSettingsModal = true;
	}

	// Close settings modal
	function closeSettingsModal() {
		showSettingsModal = false;
	}

	// Update refresh interval
	function updateRefreshInterval() {
		saveRefreshInterval();
		if (stops.length > 0) {
			startAutoRefresh();
		}
		closeSettingsModal();
	}

	// Format last refresh time
	function formatLastRefresh(): string {
		return lastRefreshTime.toLocaleTimeString();
	}

	// Toggle reorder mode
	function toggleReorderMode() {
		reorderMode = !reorderMode;
	}

	// Drag and drop functions
	function handleDragStart(e: DragEvent, index: number) {
		if (!reorderMode) return;
		
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
		draggedIndex = index;
		isDragging = true;
	}

	function handleDragOver(e: DragEvent, index: number) {
		if (!reorderMode) return;
		
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		draggedOverIndex = index;
	}

	function handleDragLeave() {
		draggedOverIndex = null;
	}

	function handleDrop(e: DragEvent, index: number) {
		if (!reorderMode) return;
		
		e.preventDefault();
		if (draggedIndex !== index) {
			const newStops = [...stops];
			const [draggedItem] = newStops.splice(draggedIndex, 1);
			newStops.splice(index, 0, draggedItem);
			stops = newStops;
			saveStops();
		}
		
		draggedIndex = null;
		draggedOverIndex = null;
		isDragging = false;
	}

	function handleDragEnd() {
		draggedIndex = null;
		draggedOverIndex = null;
		isDragging = false;
	}

	// Touch event handlers for mobile
	function handleTouchStart(e: TouchEvent, index: number) {
		if (!reorderMode) return;
		
		touchStartY = e.touches[0].clientY;
		touchStartIndex = index;
		draggedIndex = index;
		isDragging = true;
	}

	function handleTouchMove(e: TouchEvent, index: number) {
		if (!reorderMode || touchStartIndex === -1) return;
		
		e.preventDefault();
		const touchY = e.touches[0].clientY;
		const touchX = e.touches[0].clientX;
		const deltaY = touchY - touchStartY;
		
		// Only start dragging if moved more than 10px
		if (Math.abs(deltaY) > 10) {
			// Get all card elements and find the one under the touch
			const cards = document.querySelectorAll('[data-stop-index]');
			let targetIndex = draggedIndex; // Use draggedIndex instead of touchStartIndex
			
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
			
			if (targetIndex !== draggedOverIndex) {
				draggedOverIndex = targetIndex;
			}
		}
	}

	function handleTouchEnd(e: TouchEvent, index: number) {
		if (!reorderMode) return;
		
		if (draggedIndex !== null && draggedOverIndex !== null && draggedIndex !== draggedOverIndex) {
			const newStops = [...stops];
			const [draggedItem] = newStops.splice(draggedIndex, 1);
			newStops.splice(draggedOverIndex, 0, draggedItem);
			stops = newStops;
			saveStops();
		}
		
		draggedIndex = null;
		draggedOverIndex = null;
		isDragging = false;
		touchStartIndex = -1;
	}
</script>

<svelte:head>
	<title>Simple Muni Tracker</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-4xl mx-auto px-4 py-8">
		<!-- Header with Settings Gear -->
		<header class="text-center mb-8 md:mb-12 relative px-4">
			<!-- Settings Gear -->
			<button
				on:click={openSettingsModal}
				class="absolute left-0 top-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
				title="Settings"
			>
				<Settings class="w-5 h-5 md:w-6 md:h-6" />
			</button>
			
			<h1 class="text-2xl md:text-3xl lg:text-4xl font-light text-gray-900 mb-2 leading-tight">Simple Muni Tracker</h1>
			<p class="text-sm md:text-base text-gray-600">Track your favorite MUNI stops</p>
		</header>

		<!-- Search Bar -->
		<div class="max-w-md mx-auto mb-8">
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
					<input
						type="text"
						bind:value={searchInput}
						placeholder="Enter stop code (e.g., 15247)"
						class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
						on:keydown={(e) => e.key === 'Enter' && addStop()}
					/>
				</div>
				<button
					on:click={addStop}
					disabled={loading || !searchInput.trim()}
					class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
				>
					{loading ? 'Adding...' : 'Add Stop'}
				</button>
			</div>
			{#if error}
				<p class="text-red-600 text-sm mt-2">{error}</p>
			{/if}
		</div>

		<!-- Controls -->
		{#if stops.length > 0}
			<div class="text-center mb-6 space-y-2">
				<button
					on:click={refreshAll}
					disabled={loading}
					class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Refreshing...' : 'Refresh All'}
				</button>
				
				<!-- Auto-refresh status -->
				<div class="text-sm text-gray-600">
					{#if autoRefreshInterval}
						<span class="text-green-600">🔄 Auto-refresh active ({refreshIntervalSeconds}s)</span>
					{:else}
						<span class="text-gray-500">⏸️ Auto-refresh paused</span>
					{/if}
					{#if lastRefreshTime}
						<span class="ml-2">• Last updated: {formatLastRefresh()}</span>
					{/if}
				</div>

				<!-- Reorder toggle button -->
				<button
					on:click={toggleReorderMode}
					class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors {reorderMode ? 'bg-primary text-white border-primary hover:bg-red-700' : 'bg-white text-gray-700'}"
				>
					{reorderMode ? 'Exit Reorder Mode' : 'Reorder Tiles'}
				</button>
			</div>
		{/if}

		<!-- Stops Grid -->
		{#if stops.length > 0}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each stops as stop, index (stop.code)}
					<div 
						class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer relative {reorderMode ? 'cursor-grab active:cursor-grabbing' : ''} {draggedIndex === index ? 'opacity-50 scale-95 shadow-lg' : ''} {draggedOverIndex === index ? 'border-primary border-2' : ''}"
						on:click={() => !reorderMode && openModal(stop)}
						on:keydown={(e) => e.key === 'Enter' && !reorderMode && openModal(stop)}
						role="button"
						tabindex="0"
						draggable={reorderMode}
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
						on:touchstart={(e) => handleTouchStart(e, index)}
						on:touchmove={(e) => handleTouchMove(e, index)}
						on:touchend={(e) => handleTouchEnd(e, index)}
						data-stop-index={index}
					>
						<div class="flex justify-between items-start mb-4">
							<div>
								<h3 class="font-medium text-gray-900">{stop.name}</h3>
								<p class="text-sm text-gray-500">Stop {stop.code}</p>
							</div>
							<button
								on:click|stopPropagation={() => removeStop(stop.code)}
								class="text-gray-400 hover:text-red-500 p-1"
							>
								<X class="w-4 h-4" />
							</button>
						</div>
						
						<div class="space-y-3">
							{#each stop.routes as route}
								{@const nextPrediction = getNextPrediction(route.predictions)}
								{#if nextPrediction}
									<div class="flex items-center justify-between">
										<div>
											<p class="font-medium text-gray-900">Route {route.id}</p>
											<p class="text-sm text-gray-600">{nextPrediction.direction}</p>
										</div>
										<div class="text-right">
											<p class="font-medium text-primary">{formatMinutes(nextPrediction.minutes)}</p>
											<p class="text-xs text-gray-500">{nextPrediction.occupancy}</p>
										</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12">
				<p class="text-gray-600 mb-4">No stops saved yet</p>
				<p class="text-sm text-gray-500">Add a stop code to get started</p>
			</div>
		{/if}
	</div>
</div>

<!-- Settings Modal -->
{#if showSettingsModal}
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" 
		on:click={closeSettingsModal}
		on:keydown={(e) => e.key === 'Escape' && closeSettingsModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div 
			class="bg-white rounded-lg max-w-md w-full p-6" 
			on:click|stopPropagation
			role="document"
		>
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-medium text-gray-900">Settings</h2>
				<button on:click={closeSettingsModal} class="text-gray-400 hover:text-gray-600">
					<X class="w-6 h-6" />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="refresh-interval" class="block text-sm font-medium text-gray-700 mb-2">
						Auto-refresh interval (seconds)
					</label>
					<input
						id="refresh-interval"
						type="number"
						min="5"
						max="60"
						bind:value={refreshIntervalSeconds}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
					/>
					<p class="text-xs text-gray-500 mt-1">Range: 5-60 seconds</p>
				</div>

				<div class="flex justify-end space-x-3 pt-4">
					<button
						on:click={closeSettingsModal}
						class="px-4 py-2 text-gray-600 hover:text-gray-800"
					>
						Cancel
					</button>
					<button
						on:click={updateRefreshInterval}
						class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Stop Details Modal -->
{#if showModal && selectedStop}
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" 
		on:click={closeModal}
		on:keydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div 
			class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" 
			on:click|stopPropagation
			role="document"
		>
			<div class="p-6">
				<div class="flex justify-between items-start mb-6">
					<div>
						<h2 class="text-2xl font-medium text-gray-900">{selectedStop.name}</h2>
						<p class="text-gray-600">Stop {selectedStop.code}</p>
					</div>
					<button on:click={closeModal} class="text-gray-400 hover:text-gray-600">
						<X class="w-6 h-6" />
					</button>
				</div>

				<div class="space-y-6">
					{#each selectedStop.routes as route}
						<div class="border border-gray-200 rounded-lg p-4">
							<div class="mb-4">
								<h3 class="font-medium text-lg text-gray-900">Route {route.id}</h3>
								<p class="text-sm text-gray-600">{route.title}</p>
								<p class="text-xs text-gray-500 mt-1">{route.description}</p>
							</div>

							{#if route.predictions.length > 0}
								<div class="space-y-3">
									{#each route.predictions.slice(0, 5) as prediction}
										<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
											<div class="flex items-center space-x-3">
												<Clock class="w-4 h-4 text-gray-400" />
												<div>
													<p class="font-medium text-gray-900">{formatMinutes(prediction.minutes)}</p>
													<p class="text-sm text-gray-600">{prediction.direction}</p>
													<p class="text-xs text-gray-500">{prediction.destination}</p>
												</div>
											</div>
											<div class="text-right">
												<div class="flex items-center space-x-1">
													<Users class="w-4 h-4 text-gray-400" />
													<span class="text-sm text-gray-600">{prediction.occupancy}</span>
												</div>
												<p class="text-xs text-gray-500">#{prediction.vehicleId}</p>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-gray-500 text-center py-4">No predictions available</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
