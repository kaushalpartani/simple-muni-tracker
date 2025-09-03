<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { stops, loading, showModal, selectedStop } from '$lib/stores/muniStore';
	import { fetchStopData, transformApiData } from '$lib/utils/muniApi';

	// Props
	export let onStopAdded: () => void;

	// Local state
	let searchInput = '';

	let searchLoading = false;
	let searchError = '';

	// Search for a stop and open modal
	async function searchStop() {
		if (!searchInput.trim()) return;

		const stopCode = searchInput.trim();
		
		searchLoading = true;
		searchError = '';

		try {
			const data = await fetchStopData(stopCode);
			const stopData = transformApiData(stopCode, data);

			// Open the modal with the fetched stop data
			selectedStop.set(stopData);
			showModal.set(true);
			searchInput = '';
		} catch (err) {
			searchError = err instanceof Error ? err.message : 'Failed to fetch stop data';
		} finally {
			searchLoading = false;
		}
	}
</script>

<div class="max-w-md mx-auto mb-8">
	<div class="flex gap-2">
		<div class="relative flex-1">
			<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
			<input
				type="text"
				bind:value={searchInput}
				placeholder="Enter stop code (e.g., 15247)"
				class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
				on:keydown={(e) => e.key === 'Enter' && searchStop()}
			/>
		</div>
		<button
			on:click={searchStop}
			disabled={searchLoading || !searchInput.trim()}
			class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
		>
			{searchLoading ? 'Searching...' : 'Search Stop'}
		</button>
	</div>
	{#if searchError}
		<p class="text-red-600 text-sm mt-2">{searchError}</p>
	{/if}
</div>
