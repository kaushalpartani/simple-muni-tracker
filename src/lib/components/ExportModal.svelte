<script lang="ts">
	import { X } from 'lucide-svelte';
	import { showExportData, exportData } from '$lib/stores/muniStore';

	// Props
	export let onClose: () => void;

	// Copy to clipboard
	function copyToClipboard() {
		if ($exportData) {
			navigator.clipboard.writeText($exportData).then(() => {
				// Could add a toast notification here
				console.log('Copied to clipboard');
			}).catch(err => {
				console.error('Failed to copy to clipboard:', err);
			});
		}
	}

	// Close export data modal
	function closeExportData() {
		showExportData.set(false);
		onClose();
	}
</script>

{#if $showExportData}
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" 
		on:click={closeExportData}
		on:keydown={(e) => e.key === 'Escape' && closeExportData()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div 
			class="bg-white rounded-lg max-w-2xl w-full p-6" 
			on:click|stopPropagation
			role="document"
		>
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-medium text-gray-900">Export Data</h2>
				<button on:click={closeExportData} class="text-gray-400 hover:text-gray-600">
					<X class="w-6 h-6" />
				</button>
			</div>

			<div class="space-y-4">
				<p class="text-sm text-gray-600">
					Copy this base64 encoded data to share your stops across devices:
				</p>
				
				<div class="relative">
					<textarea
						readonly
						value={$exportData}
						rows="8"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm resize-none"
					></textarea>
					<button
						on:click={copyToClipboard}
						class="absolute top-2 right-2 px-3 py-1 bg-primary text-white text-xs rounded hover:bg-red-700"
					>
						Copy
					</button>
				</div>

				<div class="flex justify-end">
					<button
						on:click={closeExportData}
						class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
