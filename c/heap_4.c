#include "heap_common.h"

#define FRAGMENTATION_THRESHOLD 30.0f  // Trigger coalescing at 30% fragmentation

// Free block structure for linked list
typedef struct free_block {
    size_t size;
    struct free_block* next;
} free_block_t;

// Global state
static uint8_t heap_memory[MAX_HEAP_SIZE];
static block_info_t blocks[MAX_BLOCKS];
static log_entry_t logs[MAX_LOG_ENTRIES];
static heap_stats_t stats;
static free_block_t* free_list = NULL;
static int block_count = 0;
static int log_count = 0;
static int coalesce_pending = 0;

// Use common utility functions
#define add_log(action, alloc_id, size, offset, success) \
    common_add_log(logs, &log_count, &stats, action, alloc_id, size, offset, success)

#define update_stats() common_update_stats(blocks, block_count, &stats)

#define sort_blocks() common_sort_blocks(blocks, block_count)

static void immediate_neighbor_coalesce(size_t freed_offset) {
    sort_blocks();
    
    int freed_idx = -1;
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == freed_offset) {
            freed_idx = i;
            break;
        }
    }
    
    if (freed_idx == -1) return;
    
    int coalesced = 0;
    
    // Check left neighbor
    if (freed_idx > 0 && 
        (blocks[freed_idx - 1].state == BLOCK_FREE || blocks[freed_idx - 1].state == BLOCK_FREED) &&
        blocks[freed_idx - 1].offset + blocks[freed_idx - 1].size == blocks[freed_idx].offset) {
        
        blocks[freed_idx - 1].size += blocks[freed_idx].size;
        blocks[freed_idx - 1].state = BLOCK_FREE;  // Coalesced blocks become FREE
        
        for (int i = freed_idx; i < block_count - 1; i++) {
            blocks[i] = blocks[i + 1];
        }
        block_count--;
        stats.free_block_count--;  // Decrement when coalescing
        freed_idx--;
        coalesced = 1;
    }
    
    // Check right neighbor
    if (freed_idx >= 0 && freed_idx < block_count - 1 &&
        (blocks[freed_idx + 1].state == BLOCK_FREE || blocks[freed_idx + 1].state == BLOCK_FREED) &&
        blocks[freed_idx].offset + blocks[freed_idx].size == blocks[freed_idx + 1].offset) {
        
        blocks[freed_idx].size += blocks[freed_idx + 1].size;
        blocks[freed_idx].state = BLOCK_FREE;
        
        for (int i = freed_idx + 1; i < block_count - 1; i++) {
            blocks[i] = blocks[i + 1];
        }
        block_count--;
        stats.free_block_count--;  // Decrement when coalescing
        coalesced = 1;
    }
    
    if (coalesced) {
        add_log("COALESCE", 0, 0, freed_offset, 1);
    }
}

static void full_coalesce() {
    sort_blocks();
    
    int write_idx = 0;
    int coalesce_count = 0;
    
    for (int i = 0; i < block_count; i++) {
        blocks[write_idx] = blocks[i];
        
        if (blocks[write_idx].state == BLOCK_FREED) {
            blocks[write_idx].state = BLOCK_FREE;
            blocks[write_idx].allocation_id = 0;
        }
        
        while (i + 1 < block_count && 
               blocks[write_idx].state == BLOCK_FREE &&
               (blocks[i + 1].state == BLOCK_FREE || blocks[i + 1].state == BLOCK_FREED) &&
               blocks[write_idx].offset + blocks[write_idx].size == blocks[i + 1].offset) {
            
            blocks[write_idx].size += blocks[i + 1].size;
            blocks[write_idx].state = BLOCK_FREE;
            blocks[write_idx].allocation_id = 0;
            i++;
            coalesce_count++;
            stats.free_block_count--;  // Decrement for each coalesce
        }
        write_idx++;
    }
    
    if (coalesce_count > 0) {
        block_count = write_idx;
        add_log("FULL_COALESCE", 0, coalesce_count, 0, 1);
    }
    
    // Rebuild free list
    free_list = NULL;
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].state == BLOCK_FREE) {
            free_block_t* fb = (free_block_t*)(heap_memory + blocks[i].offset);
            fb->size = blocks[i].size;
            fb->next = free_list;
            free_list = fb;
        }
    }
    
    coalesce_pending = 0;
}

void heap_init(size_t size) {
    memset(&stats, 0, sizeof(stats));
    stats.total_size = size > MAX_HEAP_SIZE ? MAX_HEAP_SIZE : size;
    stats.next_allocation_id = 1;
    stats.min_free_bytes = stats.total_size;
    
    free_list = (free_block_t*)heap_memory;
    free_list->size = stats.total_size;
    free_list->next = NULL;
    
    block_count = 1;
    blocks[0].offset = 0;
    blocks[0].size = stats.total_size;
    blocks[0].state = BLOCK_FREE;
    blocks[0].allocation_id = 0;
    blocks[0].timestamp = stats.timestamp_counter++;
    blocks[0].requested_size = 0;
    blocks[0].region_id = 0;
    
    log_count = 0;
    coalesce_pending = 0;
    stats.free_block_count = 1;  // Start with 1 free block
    update_stats();
    add_log("INIT", 0, size, 0, 1);
}

void* heap_malloc(size_t size) {
    size_t requested_size = size;
    size_t aligned_size = (size + 7) & ~7;
    size_t total_size = aligned_size + sizeof(size_t);
    
    update_stats();
    if (coalesce_pending && stats.external_fragmentation > FRAGMENTATION_THRESHOLD) {
        full_coalesce();
        update_stats();
    }
    
    free_block_t** current = &free_list;
    free_block_t* best_fit = NULL;
    free_block_t** best_prev = NULL;
    
    while (*current) {
        if ((*current)->size >= total_size) {
            if (!best_fit || (*current)->size < best_fit->size) {
                best_fit = *current;
                best_prev = current;
            }
        }
        current = &((*current)->next);
    }
    
    if (!best_fit && coalesce_pending) {
        full_coalesce();
        
        current = &free_list;
        while (*current) {
            if ((*current)->size >= total_size) {
                if (!best_fit || (*current)->size < best_fit->size) {
                    best_fit = *current;
                    best_prev = current;
                }
            }
            current = &((*current)->next);
        }
    }
    
    if (!best_fit) {
        add_log("MALLOC", stats.next_allocation_id, size, 0, 0);
        return NULL;
    }
    
    *best_prev = best_fit->next;
    
    *(size_t*)best_fit = aligned_size;
    void* user_ptr = (uint8_t*)best_fit + sizeof(size_t);
    
    size_t offset = (uint8_t*)best_fit - heap_memory;
    
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == offset && (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED)) {
            size_t original_block_size = blocks[i].size;
            
            // Only split if remainder is large enough
            if (original_block_size > total_size + sizeof(free_block_t) + 16) {
                if (block_count < MAX_BLOCKS) {
                    blocks[block_count].offset = offset + total_size;
                    blocks[block_count].size = original_block_size - total_size;
                    blocks[block_count].state = blocks[i].state;
                    blocks[block_count].allocation_id = 0;
                    blocks[block_count].timestamp = stats.timestamp_counter++;
                    blocks[block_count].requested_size = 0;
                    blocks[block_count].region_id = 0;
                    
                    free_block_t* remainder = (free_block_t*)(heap_memory + offset + total_size);
                    remainder->size = blocks[block_count].size;
                    remainder->next = free_list;
                    free_list = remainder;
                    
                    block_count++;
                    
                    // Update current block to exact size when splitting
                    blocks[i].size = total_size;
                }
                // If not splitting, keep the original block size
            } else {
                // Consuming entire block
                stats.free_block_count--;
            }
            
            // Update block state
            blocks[i].state = BLOCK_ALLOCATED;
            blocks[i].allocation_id = stats.next_allocation_id;
            blocks[i].timestamp = stats.timestamp_counter++;
            blocks[i].requested_size = requested_size;
            break;
        }
    }
    
    add_log("MALLOC", stats.next_allocation_id, size, offset, 1);
    stats.next_allocation_id++;
    
    sort_blocks();
    update_stats();
    return user_ptr;
}

void heap_free(void* ptr) {
    if (!ptr) return;
    
    size_t* block_start = (size_t*)ptr - 1;
    size_t user_size = *block_start;
    size_t total_size = user_size + sizeof(size_t);
    size_t offset = (uint8_t*)block_start - heap_memory;
    
    uint32_t alloc_id = 0;
    
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == offset && blocks[i].state == BLOCK_ALLOCATED) {
            blocks[i].state = BLOCK_FREED;
            alloc_id = blocks[i].allocation_id;
            blocks[i].allocation_id = 0;
            blocks[i].requested_size = 0;
            stats.free_block_count++;  // Increment when freeing
            break;
        }
    }
    
    free_block_t* free_block = (free_block_t*)block_start;
    free_block->size = total_size;
    free_block->next = free_list;
    free_list = free_block;
    
    immediate_neighbor_coalesce(offset);
    coalesce_pending = 1;
    
    add_log("FREE", alloc_id, 0, offset, 1);
    sort_blocks();
    update_stats();
}

void heap_reset() {
    heap_init(stats.total_size);
}

heap_stats_t* get_heap_stats() {
    return &stats;
}

int get_block_count() {
    return block_count;
}

block_info_t* get_block_info(int index) {
    if (index >= 0 && index < block_count) {
        return &blocks[index];
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