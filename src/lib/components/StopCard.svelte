<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { Stop, Route } from '$lib/types/muni';
	import { formatMinutes, getNextPrediction } from '$lib/utils/formatters';
	import { saveStops } from '$lib/utils/localStorage';
	import { stops } from '$lib/stores/muniStore';

	// Props
	export let stop: Stop;
	export let index: number;
	export let reorderMode: boolean;
	export let draggedIndex: number | null;
	export let draggedOverIndex: number | null;
	export let onRemove: (code: string) => void;
	export let onOpenModal: (stop: Stop) => void;
	export let onDragStart: (e: DragEvent, index: number) => void;
	export let onDragOver: (e: DragEvent, index: number) => void;
	export let onDragLeave: () => void;
	export let onDrop: (e: DragEvent, index: number) => void;
	export let onDragEnd: () => void;
	export let onTouchStart: (e: TouchEvent, index: number) => void;
	export let onTouchMove: (e: TouchEvent, index: number) => void;
	export let onTouchEnd: (e: TouchEvent, index: number) => void;

	// Check if route is ignored
	function isRouteIgnored(stopCode: string, routeId: string): boolean {
		const currentStop = $stops.find(s => s.code === stopCode);
		return currentStop?.ignoredRoutes?.includes(routeId) || false;
	}

	// Get visible routes (filtered and sorted)
	function getVisibleRoutes(stop: Stop): Route[] {
		const visibleRoutes = stop.routes.filter(route => !isRouteIgnored(stop.code, route.id));
		
		// Sort routes by soonest arrival time
		return visibleRoutes.sort((a, b) => {
			// Get the earliest prediction for each route
			const aEarliest = a.predictions.length > 0 ? Math.min(...a.predictions.map(p => p.minutes)) : Infinity;
			const bEarliest = b.predictions.length > 0 ? Math.min(...b.predictions.map(p => p.minutes)) : Infinity;
			
			// "Now" (0 minutes) should be considered earliest
			return aEarliest - bEarliest;
		});
	}

	// Remove stop
	function removeStop(code: string) {
		onRemove(code);
	}
</script>

<div 
	class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer relative {reorderMode ? 'cursor-grab active:cursor-grabbing' : ''} {draggedIndex === index ? 'opacity-50 scale-95 shadow-lg' : ''} {draggedOverIndex === index ? 'border-primary border-2' : ''}"
	on:click={() => !reorderMode && onOpenModal(stop)}
	on:keydown={(e) => e.key === 'Enter' && !reorderMode && onOpenModal(stop)}
	role="button"
	tabindex="0"
	draggable={reorderMode}
	on:dragstart={(e) => onDragStart(e, index)}
	on:dragover={(e) => onDragOver(e, index)}
	on:dragleave={onDragLeave}
	on:drop={(e) => onDrop(e, index)}
	on:dragend={onDragEnd}
	on:touchstart={(e) => onTouchStart(e, index)}
	on:touchmove={(e) => onTouchMove(e, index)}
	on:touchend={(e) => onTouchEnd(e, index)}
	data-stop-index={index}
>
	<div class="flex justify-between items-start mb-4">
		<div>
			<h3 class="font-medium text-gray-900">
				{stop.nickname || stop.name}
				{#if stop.nickname}
					<span class="text-sm text-gray-500 ml-1">({stop.name})</span>
				{/if}
			</h3>
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
		{#each getVisibleRoutes(stop) as route}
			{@const nextPrediction = getNextPrediction(route.predictions)}
			{#if nextPrediction}
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium text-gray-900">{route.id}</p>
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
