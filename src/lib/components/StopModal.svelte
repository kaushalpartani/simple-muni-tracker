<script lang="ts">
	import { X, Clock, Users, Edit, Eye, EyeOff } from 'lucide-svelte';
	import type { Stop } from '$lib/types/muni';
	import { formatMinutes } from '$lib/utils/formatters';
	import { 
		showModal, 
		selectedStop, 
		editingNickname, 
		nicknameInput,
		stops,
		toastMessage,
		toastVisible,
		toastType
	} from '$lib/stores/muniStore';
	import { saveStops } from '$lib/utils/localStorage';

	// Props
	export let onClose: () => void;
	export let onToggleRouteIgnore: (stopCode: string, routeId: string) => void;
	export let onStopAdded: (() => void) | undefined = undefined;
	
	// Check if the current stop is already added
	$: isStopAdded = $selectedStop ? $stops.some(stop => stop.code === $selectedStop!.code) : false;
	
	function addStop() {
		if (!$selectedStop || isStopAdded) return;
		
		const newStops = [...$stops, $selectedStop];
		stops.set(newStops);
		saveStops(newStops);
		
		// Show success toast
		const stopName = $selectedStop.nickname || $selectedStop.name;
		toastMessage.set(`Added "${stopName}" to your stops`);
		toastType.set('success');
		toastVisible.set(true);
		
		// Call the callback if provided
		if (onStopAdded) {
			onStopAdded();
		}
		
		// Close the modal
		onClose();
	}

	// Check if route is ignored
	function isRouteIgnored(stopCode: string, routeId: string): boolean {
		const currentStop = $stops.find(s => s.code === stopCode);
		return currentStop?.ignoredRoutes?.includes(routeId) || false;
	}

	// Nickname editing functions
	function startEditingNickname(stopCode: string) {
		const stop = $stops.find(s => s.code === stopCode);
		if (stop) {
			editingNickname.set(stopCode);
			nicknameInput.set(stop.nickname || '');
		}
	}

	function saveNickname() {
		if ($editingNickname) {
			const updatedStops = $stops.map(stop => 
				stop.code === $editingNickname 
					? { ...stop, nickname: $nicknameInput.trim() || undefined }
					: stop
			);
			stops.set(updatedStops);
			saveStops(updatedStops);
			
			// Update selectedStop to reflect the changes immediately
			if ($selectedStop && $selectedStop.code === $editingNickname) {
				const updatedStop = updatedStops.find(s => s.code === $editingNickname);
				if (updatedStop) {
					selectedStop.set(updatedStop);
				}
			}
			
			editingNickname.set(null);
			nicknameInput.set('');
		}
	}

	function cancelNicknameEdit() {
		editingNickname.set(null);
		nicknameInput.set('');
	}

	function removeNickname(stopCode: string) {
		const updatedStops = $stops.map(stop => 
			stop.code === stopCode 
				? { ...stop, nickname: undefined }
				: stop
		);
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

	// Close modal
	function closeModal() {
		showModal.set(false);
		selectedStop.set(null);
		onClose();
	}
</script>

{#if $showModal && $selectedStop}
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
								<div class="flex-1">
				{#if $editingNickname === $selectedStop.code}
					<div class="space-y-3">
						<input
							type="text"
							bind:value={$nicknameInput}
							placeholder="Enter nickname"
							class="w-full px-3 py-2 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
							on:keydown={(e) => {
								if (e.key === 'Enter') saveNickname();
								if (e.key === 'Escape') cancelNicknameEdit();
							}}
							on:blur={saveNickname}
						/>
						<div class="flex gap-2">
							<button
								on:click={saveNickname}
								class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700"
							>
								Save
							</button>
							<button
								on:click={cancelNicknameEdit}
								class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<div>
						<h2 class="text-2xl font-medium text-gray-900">
							{$selectedStop.nickname || $selectedStop.name}
							{#if $selectedStop.nickname}
								<span class="text-lg text-gray-500 ml-2">({$selectedStop.name})</span>
							{/if}
						</h2>
						<p class="text-gray-600">Stop {$selectedStop.code}</p>
						{#if isStopAdded}
							<div class="flex items-center gap-3 mt-3">
								<button
									on:click={() => startEditingNickname($selectedStop.code)}
									class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
									title="Edit nickname"
								>
									<Edit class="w-4 h-4" />
									{$selectedStop?.nickname ? 'Edit' : 'Add'} Nickname
								</button>
								{#if $selectedStop?.nickname}
									<button
										on:click={() => removeNickname($selectedStop.code)}
										class="text-sm text-red-600 hover:text-red-800"
										title="Remove nickname"
									>
										Remove Nickname
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<div class="flex items-center space-x-2">
				{#if !isStopAdded}
					<button
						on:click={addStop}
						class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
					>
						Add
					</button>
				{:else}
					<button
						disabled
						class="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
					>
						Added
					</button>
				{/if}
				<button on:click={closeModal} class="text-gray-400 hover:text-gray-600">
					<X class="w-6 h-6" />
				</button>
			</div>
				</div>

				<div class="space-y-6">
					{#each $selectedStop.routes as route}
						{@const isIgnored = isRouteIgnored($selectedStop.code, route.id)}
						<div class="border border-gray-200 rounded-lg p-4 {isIgnored ? 'bg-gray-50 opacity-75' : ''}">
							<div class="flex justify-between items-start mb-4">
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<h3 class="font-medium text-lg text-gray-900">{route.id}</h3>
										{#if isIgnored}
											<span class="text-xs bg-gray-300 text-gray-600 px-2 py-1 rounded">Ignored</span>
										{/if}
									</div>
									<p class="text-sm text-gray-600">{route.title}</p>
									<p class="text-xs text-gray-500 mt-1">{route.description}</p>
								</div>
								<button
									on:click={() => onToggleRouteIgnore($selectedStop.code, route.id)}
									class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
									title={isIgnored ? 'Show route' : 'Hide route'}
								>
									{#if isIgnored}
										<EyeOff class="w-4 h-4" />
									{:else}
										<Eye class="w-4 h-4" />
									{/if}
								</button>
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
