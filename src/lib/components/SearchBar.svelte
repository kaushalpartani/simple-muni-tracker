<script lang="ts">
	import { Search } from 'lucide-svelte';
	import { error, loading, stops } from '$lib/stores/muniStore';
	import { fetchStopData, transformApiData } from '$lib/utils/muniApi';
	import { saveStops } from '$lib/utils/localStorage';

	// Props
	export let onStopAdded: () => void;

	// Local state
	let searchInput = '';

	// Add a new stop
	async function addStop() {
		if (!searchInput.trim()) return;

		const stopCode = searchInput.trim();
		
		if ($stops.find(stop => stop.code === stopCode)) {
			error.set('Stop already saved');
			return;
		}

		loading.set(true);
		error.set('');

		try {
			const data = await fetchStopData(stopCode);
			const newStop = transformApiData(stopCode, data);

			const updatedStops = [...$stops, newStop];
			stops.set(updatedStops);
			saveStops(updatedStops);
			searchInput = '';
			
			// Notify parent component
			onStopAdded();
		} catch (err) {
			error.set(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			loading.set(false);
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
				on:keydown={(e) => e.key === 'Enter' && addStop()}
			/>
		</div>
		<button
			on:click={addStop}
			disabled={$loading || !searchInput.trim()}
			class="px-6 py-3 bg-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
		>
			{$loading ? 'Adding...' : 'Add Stop'}
		</button>
	</div>
	{#if $error}
		<p class="text-red-600 text-sm mt-2">{$error}</p>
	{/if}
</div>
