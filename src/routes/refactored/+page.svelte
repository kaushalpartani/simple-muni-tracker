<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Settings, HelpCircle } from 'lucide-svelte';
	
	// Import components
	import SearchBar from '$lib/components/SearchBar.svelte';
	import StopCard from '$lib/components/StopCard.svelte';
	import StopModal from '$lib/components/StopModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ExportModal from '$lib/components/ExportModal.svelte';
	
	// Import stores
	import { 
		stops, 
		loading, 
		lastRefreshTime, 
		refreshIntervalSeconds, 
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
		autoRefreshInterval
	} from '$lib/stores/muniStore';
	
	// Import utilities
	import { loadStops, loadRefreshInterval, saveStops } from '$lib/utils/localStorage';
	import { refreshAllStops } from '$lib/utils/muniApi';
	import { formatLastRefresh } from '$lib/utils/formatters';
	import { disableScroll, enableScroll } from '$lib/utils/scrollManager';

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
		
		// Load saved refresh interval
		const savedInterval = loadRefreshInterval();
		refreshIntervalSeconds.set(savedInterval);
		
		// Start auto-refresh if there are stops
		if (savedStops.length > 0) {
			startAutoRefresh();
		}
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
		// Convert to base64 for easy copying
		const base64 = btoa(jsonString);
		exportData.set(base64);
		showExportData.set(true);
	}

	function importState() {
		if (!$importData.trim()) {
			importError.set('Please enter data to import');
			return;
		}

		try {
			// Decode from base64 first
			const decoded = atob($importData.trim());
			
			// Parse the JSON
			const importedStops = JSON.parse(decoded);
			
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
			importError.set(`Import failed: ${err instanceof Error ? err.message : 'Invalid base64 data'}`);
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
		<!-- Header with Settings Gear and Help Icon -->
		<header class="text-center mb-8 md:mb-12 relative px-4">
			<!-- Settings Gear -->
			<button
				on:click={openSettingsModal}
				class="absolute left-0 top-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
				title="Settings"
			>
				<Settings class="w-5 h-5 md:w-6 md:h-6" />
			</button>
			
			<!-- Help Icon -->
			<a
				href="https://www.sfmta.com/find-a-stop"
				target="_blank"
				rel="noopener noreferrer"
				class="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
				title="Find stop codes"
			>
				<HelpCircle class="w-5 h-5 md:w-6 md:h-6" />
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
					class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors {$reorderMode ? 'bg-primary text-white border-primary hover:bg-red-700' : 'bg-white text-gray-700'}"
				>
					{$reorderMode ? 'Exit Reorder Mode' : 'Reorder Tiles'}
				</button>
			</div>
		{/if}

		<!-- Stops Grid -->
		{#if $stops.length > 0}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each $stops as stop, index (stop.code)}
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
				<p class="text-sm text-gray-500">Add a stop code to get started</p>
			</div>
		{/if}
	</div>
</div>

<!-- Modals -->
<StopModal 
	onClose={closeModal}
	onToggleRouteIgnore={toggleRouteIgnore}
/>

<SettingsModal
	onUpdateRefreshInterval={updateRefreshInterval}
	onExportState={exportState}
	onImportState={importState}
	onClearImportForm={clearImportForm}
/>

<ExportModal onClose={closeExportData} />
