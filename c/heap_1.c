#include "heap_common.h"

// Global state
static uint8_t heap_memory[MAX_HEAP_SIZE];
static block_info_t allocations[MAX_LOG_ENTRIES];
static log_entry_t logs[MAX_LOG_ENTRIES];
static heap_stats_t stats;
static size_t heap_offset = 0;
static int allocation_count = 0;
static int log_count = 0;

static void update_stats() {
    stats.allocated_bytes = heap_offset;
    stats.free_bytes = stats.total_size - heap_offset;
    stats.allocation_count = 0;
    stats.free_block_count = 0;
    
    // Count actual allocations
    for (int i = 0; i < allocation_count; i++) {
        if (allocations[i].state == BLOCK_ALLOCATED) {
            stats.allocation_count++;
        } else if (allocations[i].state == BLOCK_FREE) {
            stats.free_block_count = 1; // heap_1 has at most one free block at the end
        }
    }
    
    // For heap_1, there's only one free block at the end
    if (stats.free_bytes > 0) {
        stats.largest_free_block = stats.free_bytes;
        stats.smallest_free_block = stats.free_bytes;
        stats.external_fragmentation = 0.0f; // No fragmentation in bump allocator
    } else {
        stats.largest_free_block = 0;
        stats.smallest_free_block = 0;
        stats.external_fragmentation = 0.0f;
    }
    
    // Heap 1 has no internal fragmentation (no alignment overhead tracked)
    stats.internal_fragmentation = 0.0f;
    
    if (stats.min_free_bytes == 0 || stats.free_bytes < stats.min_free_bytes) {
        stats.min_free_bytes = stats.free_bytes;
    }
}

// Exported functions
void heap_init(size_t size) {
    memset(&stats, 0, sizeof(stats));
    stats.total_size = size > MAX_HEAP_SIZE ? MAX_HEAP_SIZE : size;
    stats.next_allocation_id = 1;
    stats.min_free_bytes = stats.total_size;
    
    heap_offset = 0;
    allocation_count = 0;
    log_count = 0;
    
    // Start with one free block representing all memory
    allocations[0].offset = 0;
    allocations[0].size = stats.total_size;
    allocations[0].state = BLOCK_FREE;
    allocations[0].allocation_id = 0;
    allocations[0].timestamp = stats.timestamp_counter++;
    allocations[0].requested_size = 0;
    allocation_count = 1;
    
    stats.free_block_count = 1; // Start with 1 free block
    update_stats();
    common_add_log(logs, &log_count, &stats, "INIT", 0, size, 0, 1);
}

void* heap_malloc(size_t size) {
    size_t requested_size = size;
    size_t aligned_size = (size + 7) & ~7;
    
    if (heap_offset + aligned_size > stats.total_size) {
        common_add_log(logs, &log_count, &stats, "MALLOC", stats.next_allocation_id, size, 0, 0);
        return NULL;
    }
    
    void* ptr = heap_memory + heap_offset;
    
    // Find the free block and split it
    int free_idx = -1;
    for (int i = 0; i < allocation_count; i++) {
        if (allocations[i].state == BLOCK_FREE) {
            free_idx = i;
            break;
        }
    }
    
    if (free_idx != -1 && allocation_count < MAX_LOG_ENTRIES - 1) {
        // Add new allocation
        allocations[allocation_count].offset = heap_offset;
        allocations[allocation_count].size = aligned_size;
        allocations[allocation_count].state = BLOCK_ALLOCATED;
        allocations[allocation_count].allocation_id = stats.next_allocation_id;
        allocations[allocation_count].timestamp = stats.timestamp_counter++;
        allocations[allocation_count].requested_size = requested_size;
        allocation_count++;
        
        // Update free block to start after this allocation
        allocations[free_idx].offset = heap_offset + aligned_size;
        allocations[free_idx].size = stats.total_size - (heap_offset + aligned_size);
        
        // If free block has no size, remove it
        if (allocations[free_idx].size == 0) {
            for (int i = free_idx; i < allocation_count - 1; i++) {
                allocations[i] = allocations[i + 1];
            }
            allocation_count--;
        }
    }
    
    common_add_log(logs, &log_count, &stats, "MALLOC", stats.next_allocation_id, size, heap_offset, 1);
    stats.next_allocation_id++;
    heap_offset += aligned_size;
    
    update_stats();
    return ptr;
}

void heap_free(void* ptr) {
    if (!ptr) return;
    
    size_t offset = (uint8_t*)ptr - heap_memory;
    common_add_log(logs, &log_count, &stats, "FREE", 0, 0, offset, 0);
    // Heap 1 doesn't support free - no state change
}

void heap_reset() {
    heap_init(stats.total_size);
}

heap_stats_t* get_heap_stats() {
    return &stats;
}

int get_allocation_count() {
    return allocation_count;
}

block_info_t* get_allocation_info(int index) {
    if (index >= 0 && index < allocation_count) {
        return &allocations[index];
    }
    return NULL;
}

int get_log_count() {
    return log_count;
}

log_entry_t* get_log_entry(int index) {
    if (index >= 0 && index < log_count) {
        return &logs[index];
    }
    return NULL;
}

void clear_log() {
    log_count = 0;
}

size_t get_heap_offset() {
    return heap_offset;
}