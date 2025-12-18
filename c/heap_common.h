#ifndef HEAP_COMMON_H
#define HEAP_COMMON_H

#include <stdint.h>
#include <stddef.h>
#include <string.h>

#define MAX_HEAP_SIZE 65536
#define MAX_BLOCKS 1000
#define MAX_LOG_ENTRIES 1000

typedef enum {
    BLOCK_FREE = 0,
    BLOCK_ALLOCATED = 1,
    BLOCK_FREED = 2
} block_state_t;

typedef struct {
    size_t offset;
    size_t size;
    block_state_t state;
    uint32_t allocation_id;
    uint32_t timestamp;
    size_t requested_size;
    uint8_t region_id;  // For heap_5
} block_info_t;

typedef struct {
    char action[32];
    uint32_t allocation_id;
    size_t size;
    size_t offset;
    uint32_t timestamp;
    int success;
    uint8_t region_id;  // Add region ID to log entries
    uint8_t flags;      // Add flags for heap_5
} log_entry_t;

typedef struct {
    size_t total_size;
    size_t allocated_bytes;
    size_t free_bytes;
    uint32_t allocation_count;
    uint32_t free_block_count;
    uint32_t next_allocation_id;
    uint32_t timestamp_counter;
    size_t largest_free_block;
    size_t smallest_free_block;
    size_t min_free_bytes;
    float external_fragmentation;
    float internal_fragmentation;
} heap_stats_t;

// Common utility functions
// Update the common_add_log function signature
static inline void common_add_log_with_region(log_entry_t* logs, int* log_count, heap_stats_t* stats,
                                  const char* action, uint32_t alloc_id, size_t size, 
                                  size_t offset, int success, uint8_t region_id, uint8_t flags) {
    if (*log_count >= MAX_LOG_ENTRIES) return;
    
    log_entry_t* entry = &logs[(*log_count)++];
    strncpy(entry->action, action, sizeof(entry->action) - 1);
    entry->action[sizeof(entry->action) - 1] = '\0';
    entry->allocation_id = alloc_id;
    entry->size = size;
    entry->offset = offset;
    entry->success = success;
    entry->timestamp = stats->timestamp_counter++;
    entry->region_id = region_id;
    entry->flags = flags;
}

static inline void common_add_log(log_entry_t* logs, int* log_count, heap_stats_t* stats,
                                  const char* action, uint32_t alloc_id, size_t size, 
                                  size_t offset, int success) {
    common_add_log_with_region(logs, log_count, stats, action, alloc_id, size, offset, success, 0, 0);
}

static inline void common_sort_blocks(block_info_t* blocks, int block_count) {
    for (int i = 0; i < block_count - 1; i++) {
        for (int j = i + 1; j < block_count; j++) {
            if (blocks[i].offset > blocks[j].offset) {
                block_info_t temp = blocks[i];
                blocks[i] = blocks[j];
                blocks[j] = temp;
            }
        }
    }
}

static inline void common_update_stats(block_info_t* blocks, int block_count, heap_stats_t* stats) {
    stats->allocated_bytes = 0;
    stats->free_bytes = 0;
    stats->allocation_count = 0;
    stats->free_block_count = 0;
    stats->largest_free_block = 0;
    stats->smallest_free_block = stats->total_size;
    
    size_t total_requested = 0;
    size_t total_allocated = 0;
    int has_free_blocks = 0;
    
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].state == BLOCK_ALLOCATED) {
            stats->allocated_bytes += blocks[i].size;
            stats->allocation_count++;
            
            if (blocks[i].requested_size > 0) {
                total_requested += blocks[i].requested_size;
                total_allocated += blocks[i].size;
            }
        } else if (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED) {
            stats->free_bytes += blocks[i].size;
            stats->free_block_count++;
            has_free_blocks = 1;
            
            if (blocks[i].size > stats->largest_free_block) {
                stats->largest_free_block = blocks[i].size;
            }
            if (blocks[i].size < stats->smallest_free_block) {
                stats->smallest_free_block = blocks[i].size;
            }
        }
    }
    
    // Calculate external fragmentation
    if (stats->free_bytes > 0 && stats->largest_free_block > 0) {
        stats->external_fragmentation = (1.0f - (float)stats->largest_free_block / (float)stats->free_bytes) * 100.0f;
    } else {
        stats->external_fragmentation = 0.0f;
    }
    
    // Calculate internal fragmentation
    if (total_allocated > 0 && total_requested > 0) {
        stats->internal_fragmentation = ((float)(total_allocated - total_requested) / (float)total_allocated) * 100.0f;
    } else {
        stats->internal_fragmentation = 0.0f;
    }
    
    // Update minimum free bytes
    if (stats->min_free_bytes == 0 || stats->free_bytes < stats->min_free_bytes) {
        stats->min_free_bytes = stats->free_bytes;
    }
    
    // If no free blocks, reset smallest
    if (!has_free_blocks) {
        stats->smallest_free_block = 0;
    }
}

#endif // HEAP_COMMON_H