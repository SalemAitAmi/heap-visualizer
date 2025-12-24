#include "heap_common.h"
#include <stdlib.h>
#include <pthread.h>

// Thread safety mutex
static pthread_mutex_t heap_mutex = PTHREAD_MUTEX_INITIALIZER;

// Allocation tracking for visualization
typedef struct allocation_node {
    void* ptr;
    size_t size;
    size_t requested_size;
    uint32_t id;
    uint32_t timestamp;
    struct allocation_node* next;
} allocation_node_t;

// Global state
static allocation_node_t* allocation_list = NULL;
static block_info_t blocks[MAX_BLOCKS];
static log_entry_t logs[MAX_LOG_ENTRIES];
static heap_stats_t stats;
static int block_count = 0;
static int log_count = 0;

// Use common utility functions
#define add_log(action, alloc_id, size, offset, success) \
    common_add_log(logs, &log_count, &stats, action, alloc_id, size, offset, success)

static void update_stats(void) {
    common_update_stats(blocks, block_count, &stats);
}

static allocation_node_t* find_allocation(void* ptr) {
    allocation_node_t* current = allocation_list;
    while (current) {
        if (current->ptr == ptr) {
            return current;
        }
        current = current->next;
    }
    return NULL;
}

static void remove_allocation(void* ptr) {
    allocation_node_t** current = &allocation_list;
    while (*current) {
        if ((*current)->ptr == ptr) {
            allocation_node_t* to_remove = *current;
            *current = (*current)->next;
            free(to_remove);
            return;
        }
        current = &(*current)->next;
    }
}

void heap_init(size_t size) {
    pthread_mutex_lock(&heap_mutex);
    
    memset(&stats, 0, sizeof(stats));
    stats.total_size = size;
    stats.next_allocation_id = 1;
    stats.min_free_bytes = stats.total_size;
    
    // Clear previous allocations
    while (allocation_list) {
        allocation_node_t* temp = allocation_list;
        allocation_list = allocation_list->next;
        free(temp->ptr);
        free(temp);
    }
    
    block_count = 1;
    blocks[0].offset = 0;
    blocks[0].size = stats.total_size;
    blocks[0].state = BLOCK_FREE;
    blocks[0].allocation_id = 0;
    blocks[0].timestamp = stats.timestamp_counter++;
    blocks[0].requested_size = 0;
    blocks[0].region_id = 0;
    
    log_count = 0;
    stats.free_block_count = 1;
    stats.free_bytes = stats.total_size;
    update_stats();
    add_log("INIT", 0, size, 0, 1);
    
    pthread_mutex_unlock(&heap_mutex);
}

void* heap_malloc(size_t size) {
    pthread_mutex_lock(&heap_mutex);
    
    size_t requested_size = size;
    size_t aligned_size = (size + 7) & ~7;
    
    // Thread-safe wrapper: call system malloc
    void* ptr = malloc(aligned_size);
    
    if (ptr) {
        uint32_t id = stats.next_allocation_id++;
        
        // Track allocation in linked list
        allocation_node_t* node = (allocation_node_t*)malloc(sizeof(allocation_node_t));
        if (node) {
            node->ptr = ptr;
            node->size = aligned_size;
            node->requested_size = requested_size;
            node->id = id;
            node->timestamp = stats.timestamp_counter++;
            node->next = allocation_list;
            allocation_list = node;
        }
        
        // Update blocks for visualization (simulate memory layout)
        int free_idx = -1;
        for (int i = 0; i < block_count; i++) {
            if (blocks[i].state == BLOCK_FREE && blocks[i].size >= aligned_size) {
                free_idx = i;
                break;
            }
        }
        
        if (free_idx >= 0 && block_count < MAX_BLOCKS) {
            size_t original_size = blocks[free_idx].size;
            size_t original_offset = blocks[free_idx].offset;
            
            // Create allocated block
            blocks[free_idx].size = aligned_size;
            blocks[free_idx].state = BLOCK_ALLOCATED;
            blocks[free_idx].allocation_id = id;
            blocks[free_idx].timestamp = stats.timestamp_counter++;
            blocks[free_idx].requested_size = requested_size;
            
            // Create remainder free block if significant space left
            if (original_size > aligned_size + 64 && block_count < MAX_BLOCKS - 1) {
                blocks[block_count].offset = original_offset + aligned_size;
                blocks[block_count].size = original_size - aligned_size;
                blocks[block_count].state = BLOCK_FREE;
                blocks[block_count].allocation_id = 0;
                blocks[block_count].timestamp = stats.timestamp_counter++;
                blocks[block_count].requested_size = 0;
                blocks[block_count].region_id = 0;
                block_count++;
            }
        }
        
        add_log("MALLOC", id, size, (size_t)ptr & 0xFFFF, 1);
    } else {
        add_log("MALLOC", stats.next_allocation_id, size, 0, 0);
    }
    
    common_sort_blocks(blocks, block_count);
    update_stats();
    
    pthread_mutex_unlock(&heap_mutex);
    return ptr;
}

void heap_free(void* ptr) {
    if (!ptr) return;
    
    pthread_mutex_lock(&heap_mutex);
    
    // Find allocation info
    allocation_node_t* node = find_allocation(ptr);
    uint32_t id = 0;
    
    if (node) {
        id = node->id;
        
        // Update blocks for visualization
        for (int i = 0; i < block_count; i++) {
            if (blocks[i].allocation_id == id && blocks[i].state == BLOCK_ALLOCATED) {
                blocks[i].state = BLOCK_FREED;
                blocks[i].allocation_id = 0;
                blocks[i].requested_size = 0;
                stats.free_block_count++;
                break;
            }
        }
        
        remove_allocation(ptr);
    }
    
    // Thread-safe wrapper: call system free
    free(ptr);
    
    add_log("FREE", id, 0, (size_t)ptr & 0xFFFF, 1);
    update_stats();
    
    pthread_mutex_unlock(&heap_mutex);
}

void heap_reset() {
    heap_init(stats.total_size);
}

// Query functions
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