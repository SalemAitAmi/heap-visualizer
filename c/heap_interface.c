#include "heap_interface.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// Global variables (non-static so they can be accessed by heap implementations)
uint8_t heap_memory[MAX_HEAP_SIZE];
block_info_t blocks[MAX_ALLOCATIONS];
heap_stats_t stats;
int block_count = 0;

// Static variables (only used in this file)
static log_entry_t log_entries[MAX_LOG_ENTRIES];
static heap_type_t current_heap_type = HEAP_1;
static int log_count = 0;

static void add_log_entry(const char* action, uint32_t alloc_id, size_t size, size_t offset, int success) {
    if (log_count >= MAX_LOG_ENTRIES) return;
    
    log_entry_t* entry = &log_entries[log_count++];
    strncpy(entry->action, action, sizeof(entry->action) - 1);
    entry->action[sizeof(entry->action) - 1] = '\0';
    entry->allocation_id = alloc_id;
    entry->size = size;
    entry->offset = offset;
    entry->success = success;
    entry->timestamp = stats.timestamp_counter++;
}

static void update_stats() {
    stats.allocated_bytes = 0;
    stats.free_bytes = 0;
    stats.allocation_count = 0;
    stats.free_block_count = 0;
    
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].state == BLOCK_ALLOCATED) {
            stats.allocated_bytes += blocks[i].size;
            stats.allocation_count++;
        } else if (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED) {
            stats.free_bytes += blocks[i].size;
            if (blocks[i].state == BLOCK_FREE) {
                stats.free_block_count++;
            }
        }
    }
}

void heap_init(heap_type_t type, size_t size) {
    current_heap_type = type;
    memset(&stats, 0, sizeof(stats));
    stats.total_size = size > MAX_HEAP_SIZE ? MAX_HEAP_SIZE : size;
    block_count = 0;
    log_count = 0;
    
    // Initialize with one large free block
    blocks[0].offset = 0;
    blocks[0].size = stats.total_size;
    blocks[0].state = BLOCK_FREE;
    blocks[0].allocation_id = 0;
    blocks[0].timestamp = stats.timestamp_counter++;
    block_count = 1;
    
    switch (type) {
        case HEAP_1: heap1_init(stats.total_size); break;
        case HEAP_2: heap2_init(stats.total_size); break;
        case HEAP_3: heap3_init(stats.total_size); break;
        case HEAP_4: heap4_init(stats.total_size); break;
        case HEAP_5: heap5_init(stats.total_size); break;
    }
    
    update_stats();
    add_log_entry("INIT", 0, size, 0, 1);
}

void* heap_malloc(size_t size) {
    void* ptr = NULL;
    
    switch (current_heap_type) {
        case HEAP_1: ptr = heap1_malloc(size); break;
        case HEAP_2: ptr = heap2_malloc(size); break;
        case HEAP_3: ptr = heap3_malloc(size); break;
        case HEAP_4: ptr = heap4_malloc(size); break;
        case HEAP_5: ptr = heap5_malloc(size); break;
    }
    
    size_t offset = ptr ? (size_t)((uint8_t*)ptr - heap_memory) : 0;
    add_log_entry("MALLOC", stats.next_allocation_id, size, offset, ptr != NULL);
    
    if (ptr) {
        stats.next_allocation_id++;
    }
    
    update_stats();
    return ptr;
}

void heap_free(void* ptr) {
    if (!ptr) return;
    
    size_t offset = (size_t)((uint8_t*)ptr - heap_memory);
    uint32_t alloc_id = 0;
    
    // Find the allocation ID
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == offset && blocks[i].state == BLOCK_ALLOCATED) {
            alloc_id = blocks[i].allocation_id;
            break;
        }
    }
    
    switch (current_heap_type) {
        case HEAP_1: heap1_free(ptr); break;
        case HEAP_2: heap2_free(ptr); break;
        case HEAP_3: heap3_free(ptr); break;
        case HEAP_4: heap4_free(ptr); break;
        case HEAP_5: heap5_free(ptr); break;
    }
    
    add_log_entry("FREE", alloc_id, 0, offset, 1);
    update_stats();
}

void heap_reset(void) {
    heap_init(current_heap_type, stats.total_size);
}

heap_stats_t* get_heap_stats(void) {
    return &stats;
}

int get_block_count(void) {
    return block_count;
}

block_info_t* get_block_info(int index) {
    if (index >= 0 && index < block_count) {
        return &blocks[index];
    }
    return NULL;
}

int get_log_count(void) {
    return log_count;
}

log_entry_t* get_log_entry(int index) {
    if (index >= 0 && index < log_count) {
        return &log_entries[index];
    }
    return NULL;
}

void clear_log(void) {
    log_count = 0;
}