import { writable } from 'svelte/store';
import type { Stop } from '$lib/types/muni';

// Main application state
export const stops = writable<Stop[]>([]);
export const loading = writable(false);
export const error = writable('');
export const lastRefreshTime = writable(new Date());
export const refreshIntervalSeconds = writable(10);

// Modal states
export const showModal = writable(false);
export const showSettingsModal = writable(false);
export const selectedStop = writable<Stop | null>(null);

// Reorder mode state
export const reorderMode = writable(false);

// Nickname editing state
export const editingNickname = writable<string | null>(null);
export const nicknameInput = writable('');

// Drag and drop state
export const draggedIndex = writable<number | null>(null);
export const draggedOverIndex = writable<number | null>(null);
export const isDragging = writable(false);
export const touchStartY = writable(0);
export const touchStartIndex = writable(-1);

// Import/Export state
export const importData = writable('');
export const importError = writable('');
export const exportData = writable('');
export const showExportData = writable(false);

// Auto-refresh interval reference
export const autoRefreshInterval = writable<ReturnType<typeof setInterval> | null>(null);
