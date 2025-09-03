<script lang="ts">
	import { CheckCircle, AlertCircle, Info, X } from 'lucide-svelte';
	import { toastMessage, toastVisible, toastType } from '$lib/stores/muniStore';
	import { onMount } from 'svelte';

	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	// Auto-hide toast after 3 seconds
	$effect(() => {
		if ($toastVisible) {
			if (toastTimeout) {
				clearTimeout(toastTimeout);
			}
			toastTimeout = setTimeout(() => {
				hideToast();
			}, 3000);
		}
	});

	function hideToast() {
		toastVisible.set(false);
		if (toastTimeout) {
			clearTimeout(toastTimeout);
			toastTimeout = null;
		}
	}

	// Show toast function (can be called from other components)
	export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
		toastMessage.set(message);
		toastType.set(type);
		toastVisible.set(true);
	}

	// Get color classes based on toast type
	function getColorClasses(type: string) {
		switch (type) {
			case 'success':
				return 'bg-green-50 border-green-200 text-green-800';
			case 'error':
				return 'bg-red-50 border-red-200 text-red-800';
			case 'info':
				return 'bg-blue-50 border-blue-200 text-blue-800';
			default:
				return 'bg-green-50 border-green-200 text-green-800';
		}
	}
</script>

{#if $toastVisible}
	<div class="fixed top-4 right-4 z-50 max-w-sm w-full">
		<div 
			class="rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out {getColorClasses($toastType)}"
			role="alert"
		>
			<div class="flex items-start">
				<div class="flex-shrink-0">
					{#if $toastType === 'success'}
						<CheckCircle class="w-5 h-5 text-green-500" />
					{:else if $toastType === 'error'}
						<AlertCircle class="w-5 h-5 text-red-500" />
					{:else if $toastType === 'info'}
						<Info class="w-5 h-5 text-blue-500" />
					{:else}
						<CheckCircle class="w-5 h-5 text-green-500" />
					{/if}
				</div>
				<div class="ml-3 flex-1">
					<p class="text-sm font-medium">
						{$toastMessage}
					</p>
				</div>
				<div class="ml-4 flex-shrink-0">
					<button
						onclick={hideToast}
						class="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
						aria-label="Close notification"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
