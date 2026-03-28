<script lang="ts">
	import { X, Download, Upload } from 'lucide-svelte';
	import { 
		showSettingsModal, 
		refreshIntervalSeconds, 
		importData, 
		importError, 
		exportData, 
		showExportData 
	} from '$lib/stores/muniStore';
	import { saveRefreshInterval } from '$lib/utils/localStorage';

	// Props
	export let onUpdateRefreshInterval: () => void;
	export let onExportState: () => void;
	export let onImportState: () => void;
	export let onClearImportForm: () => void;

	// Close settings modal
	function closeSettingsModal() {
		showSettingsModal.set(false);
	}

	// Update refresh interval
	function updateRefreshInterval() {
		saveRefreshInterval($refreshIntervalSeconds);
		onUpdateRefreshInterval();
		closeSettingsModal();
	}
</script>

{#if $showSettingsModal}
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

			<div class="space-y-6">
				<!-- Auto-refresh interval -->
				<div>
					<label for="refresh-interval" class="block text-sm font-medium text-gray-700 mb-2">
						Auto-refresh interval (seconds)
					</label>
					<input
						id="refresh-interval"
						type="number"
						min="5"
						max="60"
						bind:value={$refreshIntervalSeconds}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
					/>
					<p class="text-xs text-gray-500 mt-1">Range: 5-60 seconds</p>
				</div>

				<!-- Import/Export section -->
				<div class="border-t pt-6">
					<h3 class="text-lg font-medium text-gray-900 mb-4">Import/Export Data</h3>
					
					<!-- Export section -->
					<div class="mb-6">
						<div class="flex items-center gap-2 mb-3">
							<Download class="w-5 h-5 text-gray-600" />
							<h4 class="font-medium text-gray-800">Export Data</h4>
						</div>
						<p class="text-sm text-gray-600 mb-3">
							Export your stops to share across devices
						</p>
						<button
							on:click={onExportState}
							class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700"
						>
							Export Data
						</button>
					</div>

					<!-- Import section -->
					<div>
						<div class="flex items-center gap-2 mb-3">
							<Upload class="w-5 h-5 text-gray-600" />
							<h4 class="font-medium text-gray-800">Import Data</h4>
						</div>
						<p class="text-sm text-gray-600 mb-3">
							Import stops from another device (will append to existing stops). Just paste a valid exported value!
						</p>
						<textarea
							bind:value={$importData}
							placeholder="Paste data here..."
							rows="4"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
						></textarea>
						{#if $importError}
							<p class="text-red-600 text-sm mt-2">{$importError}</p>
						{/if}
						<div class="flex gap-2 mt-3">
							<button
								on:click={onImportState}
								class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700"
							>
								Import Data
							</button>
							<button
								on:click={onClearImportForm}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
							>
								Clear
							</button>
						</div>
					</div>
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
