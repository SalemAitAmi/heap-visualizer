#include "heap_common.h"

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

static void add_log(const char* action, uint32_t alloc_id, size_t size, size_t offset, int success) {
    if (log_count >= MAX_LOG_ENTRIES) return;
    
    log_entry_t* entry = &logs[log_count++];
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
    stats.largest_free_block = 0;
    stats.smallest_free_block = stats.total_size;
    
    size_t total_requested = 0;
    size_t total_allocated = 0;
    int has_free_blocks = 0;
    
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].state == BLOCK_ALLOCATED) {
            stats.allocated_bytes += blocks[i].size;
            stats.allocation_count++;
            
            // Track for internal fragmentation
            if (blocks[i].requested_size > 0) {
                total_requested += blocks[i].requested_size;
                total_allocated += blocks[i].size;
            }
        } else if (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED) {
            // Both FREE and FREED count as free memory
            stats.free_bytes += blocks[i].size;
            stats.free_block_count++;
            has_free_blocks = 1;
            
            if (blocks[i].size > stats.largest_free_block) {
                stats.largest_free_block = blocks[i].size;
            }
            if (blocks[i].size < stats.smallest_free_block) {
                stats.smallest_free_block = blocks[i].size;
            }
        }
    }
    
    // Calculate external fragmentation
    if (stats.free_bytes > 0 && stats.largest_free_block > 0) {
        stats.external_fragmentation = (1.0f - (float)stats.largest_free_block / (float)stats.free_bytes) * 100.0f;
    } else {
        stats.external_fragmentation = 0.0f;
    }
    
    // Calculate internal fragmentation
    if (total_allocated > 0 && total_requested > 0) {
        stats.internal_fragmentation = ((float)(total_allocated - total_requested) / (float)total_allocated) * 100.0f;
    } else {
        stats.internal_fragmentation = 0.0f;
    }
    
    // Update minimum free bytes
    if (stats.min_free_bytes == 0 || stats.free_bytes < stats.min_free_bytes) {
        stats.min_free_bytes = stats.free_bytes;
    }
    
    // If no free blocks, reset smallest
    if (!has_free_blocks) {
        stats.smallest_free_block = 0;
    }
}

static void sort_blocks() {
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

// Exported functions
void heap_init(size_t size) {
    memset(&stats, 0, sizeof(stats));
    stats.total_size = size > MAX_HEAP_SIZE ? MAX_HEAP_SIZE : size;
    stats.next_allocation_id = 1;
    stats.min_free_bytes = stats.total_size;
    
    // Initialize with one large free block
    free_list = (free_block_t*)heap_memory;
    free_list->size = stats.total_size;
    free_list->next = NULL;
    
    // Initialize block tracking
    block_count = 1;
    blocks[0].offset = 0;
    blocks[0].size = stats.total_size;
    blocks[0].state = BLOCK_FREE;
    blocks[0].allocation_id = 0;
    blocks[0].timestamp = stats.timestamp_counter++;
    blocks[0].requested_size = 0;
    
    log_count = 0;
    update_stats();
    add_log("INIT", 0, size, 0, 1);
}

void* heap_malloc(size_t size) {
    size_t requested_size = size;
    
    // Align to 8 bytes and add header size
    size_t aligned_size = (size + 7) & ~7;
    size_t total_size = aligned_size + sizeof(size_t);
    
    // Find best fit
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
    
    if (!best_fit) {
        add_log("MALLOC", stats.next_allocation_id, size, 0, 0);
        return NULL;
    }
    
    // Remove from free list
    *best_prev = best_fit->next;
    
    // Store allocation size at the beginning
    *(size_t*)best_fit = aligned_size;
    void* user_ptr = (uint8_t*)best_fit + sizeof(size_t);
    
    size_t offset = (uint8_t*)best_fit - heap_memory;
    
    // Update block tracking
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == offset && (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED)) {
            size_t original_block_size = blocks[i].size;
            
            // Only split if remainder is large enough to be useful
            if (original_block_size > total_size + sizeof(free_block_t) + 16) {
                // Split the block
                if (block_count < MAX_BLOCKS) {
                    blocks[block_count].offset = offset + total_size;
                    blocks[block_count].size = original_block_size - total_size;
                    blocks[block_count].state = blocks[i].state; // Preserve FREE or FREED state
                    blocks[block_count].allocation_id = 0;
                    blocks[block_count].timestamp = stats.timestamp_counter++;
                    blocks[block_count].requested_size = 0;
                    
                    // Add remainder to free list
                    free_block_t* remainder = (free_block_t*)(heap_memory + offset + total_size);
                    remainder->size = blocks[block_count].size;
                    remainder->next = free_list;
                    free_list = remainder;
                    
                    block_count++;
                    
                    // Update current block to exact size
                    blocks[i].size = total_size;
                }
            }
            // If not splitting, allocate the ENTIRE block (no else needed, size stays original)
            
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
    
    // Get the actual block start and size
    size_t* block_start = (size_t*)ptr - 1;
    size_t user_size = *block_start;
    size_t total_size = user_size + sizeof(size_t);
    size_t offset = (uint8_t*)block_start - heap_memory;
    
    uint32_t alloc_id = 0;
    
    // Find and update block - mark as FREED not FREE
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == offset && blocks[i].state == BLOCK_ALLOCATED) {
            blocks[i].state = BLOCK_FREED;  // Mark as FREED for visualization
            alloc_id = blocks[i].allocation_id;
            blocks[i].allocation_id = 0;
            blocks[i].requested_size = 0;  // Clear requested size
            break;
        }
    }
    
    // Add to free list (heap_2 doesn't coalesce)
    free_block_t* free_block = (free_block_t*)block_start;
    free_block->size = total_size;
    free_block->next = free_list;
    free_list = free_block;
    
    add_log("FREE", alloc_id, 0, offset, 1);
    sort_blocks();
    update_stats();
}

void heap_reset() {
    heap_init(stats.total_size);
}

// Query functions for JavaScript
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