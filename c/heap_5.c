#include "heap_common.h"
#include <stdbool.h>

// Configuration flag - set at compile time
#ifndef USE_PHYSICAL_MEM
#define USE_PHYSICAL_MEM 0
#endif

#define MAX_REGIONS 8
#define FRAGMENTATION_THRESHOLD 30.0f

// Region flags
#define REGION_FLAG_FAST     0x01
#define REGION_FLAG_DMA      0x02
#define REGION_FLAG_UNCACHED 0x04
#define REGION_FLAG_PINNED   0x08

// Region structure
typedef struct {
    uint8_t* start;
    size_t size;
    uint8_t region_id;
    uint8_t flags;
    const char* name;
    
    // Per-region statistics
    size_t allocated_bytes;
    size_t free_bytes;
    uint32_t allocation_count;
    uint32_t free_block_count;
    size_t largest_free_block;
    size_t smallest_free_block;
    size_t min_free_bytes;
    float external_fragmentation;
    float internal_fragmentation;
} heap_region_t;

// Free block structure
typedef struct free_block {
    size_t size;
    uint8_t region_id;
    struct free_block* next;
} free_block_t;

#if USE_PHYSICAL_MEM
    // External symbols from linker script - generic region naming
    extern uint8_t __heap_region_0_start[];
    extern uint8_t __heap_region_0_size[];
    extern uint8_t __heap_region_1_start[];
    extern uint8_t __heap_region_1_size[];
    extern uint8_t __heap_region_2_start[];
    extern uint8_t __heap_region_2_size[];
    extern uint32_t __heap_region_count;
#else
    // Separate static arrays for software simulation - generic naming
    #define REGION_0_SIZE 10240  // 10KB
    #define REGION_1_SIZE 13312  // 13KB
    #define REGION_2_SIZE 9216   // 9KB
    
    static uint8_t heap_region_0[REGION_0_SIZE];
    static uint8_t heap_region_1[REGION_1_SIZE];
    static uint8_t heap_region_2[REGION_2_SIZE];
#endif

// Global state
static block_info_t blocks[MAX_BLOCKS];
static log_entry_t logs[MAX_LOG_ENTRIES];
static heap_stats_t stats;
static heap_region_t regions[MAX_REGIONS];
static free_block_t* free_lists[MAX_REGIONS];
static int region_count = 0;
static int block_count = 0;
static int log_count = 0;
static bool initialized = false;
static int coalesce_pending = 0;

// Forward declarations
static void update_region_stats(uint8_t region_id);
static void update_global_stats(void);
static uint8_t get_region_for_ptr(void* ptr);
static size_t get_offset_in_region(void* ptr, uint8_t region_id);
static void immediate_neighbor_coalesce(size_t local_offset, uint8_t region_id);
static void full_coalesce(void);
void* heap_malloc_flags(size_t size, uint8_t flags);

// Use common utility functions
#define add_log(action, alloc_id, size, offset, success) \
    common_add_log_with_region(logs, &log_count, &stats, action, alloc_id, size, offset, success, 0, 0)

#define add_log_with_region(action, alloc_id, size, offset, success, region_id, flags) \
    common_add_log_with_region(logs, &log_count, &stats, action, alloc_id, size, offset, success, region_id, flags)

#define sort_blocks() common_sort_blocks(blocks, block_count)

// Region configuration - developers customize names and flags
typedef struct {
    const char* name;
    uint8_t flags;
} region_config_t;

static const region_config_t region_configs[] = {
    { "FAST", REGION_FLAG_FAST },
    { "DMA", REGION_FLAG_DMA },
    { "UNCACHED", REGION_FLAG_UNCACHED }
};

// Initialize regions based on compilation mode
static bool heap_define_regions(void) {
#if USE_PHYSICAL_MEM
    // Use linker script symbols for physical memory
    region_count = (int)&__heap_region_count;
    if (region_count > MAX_REGIONS) region_count = MAX_REGIONS;
    if (region_count > 3) region_count = 3; // We only have 3 configs
    
    // Region 0
    if (region_count > 0) {
        regions[0].start = __heap_region_0_start;
        regions[0].size = (size_t)__heap_region_0_size;
        regions[0].region_id = 0;
        regions[0].flags = region_configs[0].flags;
        regions[0].name = region_configs[0].name;
    }
    
    // Region 1
    if (region_count > 1) {
        regions[1].start = __heap_region_1_start;
        regions[1].size = (size_t)__heap_region_1_size;
        regions[1].region_id = 1;
        regions[1].flags = region_configs[1].flags;
        regions[1].name = region_configs[1].name;
    }
    
    // Region 2
    if (region_count > 2) {
        regions[2].start = __heap_region_2_start;
        regions[2].size = (size_t)__heap_region_2_size;
        regions[2].region_id = 2;
        regions[2].flags = region_configs[2].flags;
        regions[2].name = region_configs[2].name;
    }
    
#else
    // Use separate static arrays for software simulation
    region_count = 3;
    
    // Region 0
    regions[0].start = heap_region_0;
    regions[0].size = REGION_0_SIZE;
    regions[0].region_id = 0;
    regions[0].flags = region_configs[0].flags;
    regions[0].name = region_configs[0].name;
    
    // Region 1
    regions[1].start = heap_region_1;
    regions[1].size = REGION_1_SIZE;
    regions[1].region_id = 1;
    regions[1].flags = region_configs[1].flags;
    regions[1].name = region_configs[1].name;
    
    // Region 2
    regions[2].start = heap_region_2;
    regions[2].size = REGION_2_SIZE;
    regions[2].region_id = 2;
    regions[2].flags = region_configs[2].flags;
    regions[2].name = region_configs[2].name;
#endif
    
    // Initialize per-region state and free lists
    for (int i = 0; i < region_count; i++) {
        // Initialize region stats
        regions[i].allocated_bytes = 0;
        regions[i].free_bytes = regions[i].size;
        regions[i].allocation_count = 0;
        regions[i].free_block_count = 1;
        regions[i].largest_free_block = regions[i].size;
        regions[i].smallest_free_block = regions[i].size;
        regions[i].min_free_bytes = regions[i].size;
        regions[i].external_fragmentation = 0.0f;
        regions[i].internal_fragmentation = 0.0f;
        
        // Initialize free list
        free_lists[i] = (free_block_t*)regions[i].start;
        free_lists[i]->size = regions[i].size;
        free_lists[i]->region_id = i;
        free_lists[i]->next = NULL;
        
        // Add block for visualization - use region-local offset
        if (block_count < MAX_BLOCKS) {
            blocks[block_count].offset = 0; // Region-local offset
            blocks[block_count].size = regions[i].size;
            blocks[block_count].state = BLOCK_FREE;
            blocks[block_count].allocation_id = 0;
            blocks[block_count].timestamp = stats.timestamp_counter++;
            blocks[block_count].requested_size = 0;
            blocks[block_count].region_id = i;
            block_count++;
        }
    }
    
    return true;
}

static uint8_t get_region_for_ptr(void* ptr) {
    uint8_t* byte_ptr = (uint8_t*)ptr;
    for (int i = 0; i < region_count; i++) {
        if (byte_ptr >= regions[i].start && 
            byte_ptr < regions[i].start + regions[i].size) {
            return regions[i].region_id;
        }
    }
    return 0;
}

static size_t get_offset_in_region(void* ptr, uint8_t region_id) {
    if (region_id >= region_count) return 0;
    uint8_t* byte_ptr = (uint8_t*)ptr;
    return byte_ptr - regions[region_id].start;
}

static void update_region_stats(uint8_t region_id) {
    if (region_id >= region_count) return;
    
    heap_region_t* region = &regions[region_id];
    
    // Reset stats
    region->allocated_bytes = 0;
    region->free_bytes = 0;
    region->allocation_count = 0;
    region->free_block_count = 0;
    region->largest_free_block = 0;
    region->smallest_free_block = region->size;
    
    size_t total_requested = 0;
    size_t total_allocated = 0;
    int has_free_blocks = 0;
    
    // Calculate from blocks
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].region_id != region_id) continue;
        
        if (blocks[i].state == BLOCK_ALLOCATED) {
            region->allocated_bytes += blocks[i].size;
            region->allocation_count++;
            
            if (blocks[i].requested_size > 0) {
                total_requested += blocks[i].requested_size;
                total_allocated += blocks[i].size;
            }
        } else if (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED) {
            region->free_bytes += blocks[i].size;
            region->free_block_count++;
            has_free_blocks = 1;
            
            if (blocks[i].size > region->largest_free_block) {
                region->largest_free_block = blocks[i].size;
            }
            if (blocks[i].size < region->smallest_free_block) {
                region->smallest_free_block = blocks[i].size;
            }
        }
    }
    
    // Calculate external fragmentation
    if (region->free_bytes > 0 && region->largest_free_block > 0) {
        region->external_fragmentation = (1.0f - (float)region->largest_free_block / (float)region->free_bytes) * 100.0f;
    } else {
        region->external_fragmentation = 0.0f;
    }
    
    // Calculate internal fragmentation
    if (total_allocated > 0 && total_requested > 0) {
        region->internal_fragmentation = ((float)(total_allocated - total_requested) / (float)total_allocated) * 100.0f;
    } else {
        region->internal_fragmentation = 0.0f;
    }
    
    if (!has_free_blocks) {
        region->smallest_free_block = 0;
    }
    
    // Update minimum free bytes
    if (region->min_free_bytes == 0 || region->free_bytes < region->min_free_bytes) {
        region->min_free_bytes = region->free_bytes;
    }
}

static void update_global_stats(void) {
    // Update per-region stats first
    for (int i = 0; i < region_count; i++) {
        update_region_stats(i);
    }
    
    // Aggregate stats from all regions
    stats.allocated_bytes = 0;
    stats.free_bytes = 0;
    stats.allocation_count = 0;
    stats.free_block_count = 0;
    stats.largest_free_block = 0;
    stats.smallest_free_block = stats.total_size;
    
    float total_external_frag = 0;
    float total_internal_frag = 0;
    int regions_contributing = 0;
    
    for (int i = 0; i < region_count; i++) {
        stats.allocated_bytes += regions[i].allocated_bytes;
        stats.free_bytes += regions[i].free_bytes;
        stats.allocation_count += regions[i].allocation_count;
        stats.free_block_count += regions[i].free_block_count;
        
        if (regions[i].largest_free_block > stats.largest_free_block) {
            stats.largest_free_block = regions[i].largest_free_block;
        }
        if (regions[i].smallest_free_block < stats.smallest_free_block && regions[i].free_block_count > 0) {
            stats.smallest_free_block = regions[i].smallest_free_block;
        }
        
        if (regions[i].free_bytes > 0) {
            total_external_frag += regions[i].external_fragmentation;
            total_internal_frag += regions[i].internal_fragmentation;
            regions_contributing++;
        }
    }
    
    // Calculate average fragmentation
    if (regions_contributing > 0) {
        stats.external_fragmentation = total_external_frag / (float)regions_contributing;
        stats.internal_fragmentation = total_internal_frag / (float)regions_contributing;
    } else {
        stats.external_fragmentation = 0.0f;
        stats.internal_fragmentation = 0.0f;
    }
    
    // Update minimum free bytes
    if (stats.min_free_bytes == 0 || stats.free_bytes < stats.min_free_bytes) {
        stats.min_free_bytes = stats.free_bytes;
    }
    
    if (stats.free_block_count == 0) {
        stats.smallest_free_block = 0;
    }
}

static void immediate_neighbor_coalesce(size_t local_offset, uint8_t region_id) {
    sort_blocks();
    
    int freed_idx = -1;
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == local_offset && blocks[i].region_id == region_id) {
            freed_idx = i;
            break;
        }
    }
    
    if (freed_idx == -1) return;
    
    int coalesced = 0;
    
    // Check left neighbor (same region only)
    if (freed_idx > 0 && 
        blocks[freed_idx - 1].region_id == region_id &&
        (blocks[freed_idx - 1].state == BLOCK_FREE || blocks[freed_idx - 1].state == BLOCK_FREED) &&
        blocks[freed_idx - 1].offset + blocks[freed_idx - 1].size == blocks[freed_idx].offset) {
        
        blocks[freed_idx - 1].size += blocks[freed_idx].size;
        blocks[freed_idx - 1].state = BLOCK_FREE;
        
        for (int i = freed_idx; i < block_count - 1; i++) {
            blocks[i] = blocks[i + 1];
        }
        block_count--;
        freed_idx--;
        coalesced = 1;
    }
    
    // Check right neighbor (same region only)
    if (freed_idx >= 0 && freed_idx < block_count - 1 &&
        blocks[freed_idx + 1].region_id == region_id &&
        (blocks[freed_idx + 1].state == BLOCK_FREE || blocks[freed_idx + 1].state == BLOCK_FREED) &&
        blocks[freed_idx].offset + blocks[freed_idx].size == blocks[freed_idx + 1].offset) {
        
        blocks[freed_idx].size += blocks[freed_idx + 1].size;
        blocks[freed_idx].state = BLOCK_FREE;
        
        for (int i = freed_idx + 1; i < block_count - 1; i++) {
            blocks[i] = blocks[i + 1];
        }
        block_count--;
        coalesced = 1;
    }
    
    if (coalesced) {
        add_log("COALESCE", 0, 0, local_offset, 1);
    }
}

static void full_coalesce(void) {
    sort_blocks();
    
    int write_idx = 0;
    int coalesce_count = 0;
    
    for (int i = 0; i < block_count; i++) {
        blocks[write_idx] = blocks[i];
        
        if (blocks[write_idx].state == BLOCK_FREED) {
            blocks[write_idx].state = BLOCK_FREE;
            blocks[write_idx].allocation_id = 0;
        }
        
        // Coalesce only within the same region
        while (i + 1 < block_count && 
               blocks[write_idx].state == BLOCK_FREE &&
               (blocks[i + 1].state == BLOCK_FREE || blocks[i + 1].state == BLOCK_FREED) &&
               blocks[write_idx].region_id == blocks[i + 1].region_id &&
               blocks[write_idx].offset + blocks[write_idx].size == blocks[i + 1].offset) {
            
            blocks[write_idx].size += blocks[i + 1].size;
            blocks[write_idx].state = BLOCK_FREE;
            blocks[write_idx].allocation_id = 0;
            i++;
            coalesce_count++;
        }
        write_idx++;
    }
    
    if (coalesce_count > 0) {
        block_count = write_idx;
        add_log("FULL_COALESCE", 0, coalesce_count, 0, 1);
    }
    
    // Rebuild free lists
    for (int r = 0; r < region_count; r++) {
        free_lists[r] = NULL;
    }
    
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].state == BLOCK_FREE) {
            uint8_t rid = blocks[i].region_id;
            size_t local_offset = blocks[i].offset;
            
            free_block_t* fb = (free_block_t*)(regions[rid].start + local_offset);
            fb->size = blocks[i].size;
            fb->region_id = rid;
            fb->next = free_lists[rid];
            free_lists[rid] = fb;
        }
    }
    
    coalesce_pending = 0;
}

void heap_init(size_t size) {
    memset(&stats, 0, sizeof(stats));
    
    block_count = 0;
    log_count = 0;
    coalesce_pending = 0;
    
    if (!initialized) {
        heap_define_regions();
        initialized = true;
    }
    
    // Calculate total size from all regions
    stats.total_size = 0;
    for (int i = 0; i < region_count; i++) {
        stats.total_size += regions[i].size;
    }
    
    stats.next_allocation_id = 1;
    stats.min_free_bytes = stats.total_size;
    
    update_global_stats();
    add_log("INIT", 0, stats.total_size, 0, 1);
}

void* heap_malloc_flags(size_t size, uint8_t flags) {
    if (!initialized) return NULL;
    
    size_t requested_size = size;
    size_t aligned_size = (size + 7) & ~7;
    size_t total_size = aligned_size + sizeof(size_t);
    
    // Find best region based on flags
    free_block_t* best_fit = NULL;
    free_block_t** best_prev = NULL;
    uint8_t best_region = 0;
    
    for (int r = 0; r < region_count; r++) {
        // Skip regions that don't match required flags
        if (flags && !(regions[r].flags & flags)) continue;
        
        free_block_t** current = &free_lists[r];
        while (*current) {
            if ((*current)->size >= total_size) {
                if (!best_fit || (*current)->size < best_fit->size) {
                    best_fit = *current;
                    best_prev = current;
                    best_region = r;
                }
            }
            current = &((*current)->next);
        }
    }
    
    if (!best_fit) {
        add_log_with_region("MALLOC", stats.next_allocation_id, size, 0, 0, 0xFF, flags);
        return NULL;
    }
    
    // Remove from free list
    *best_prev = best_fit->next;
    
    *(size_t*)best_fit = aligned_size;
    void* user_ptr = (uint8_t*)best_fit + sizeof(size_t);
    
    size_t local_offset = get_offset_in_region(best_fit, best_region);
    
    // Update block tracking
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].region_id == best_region && blocks[i].offset == local_offset &&
            (blocks[i].state == BLOCK_FREE || blocks[i].state == BLOCK_FREED)) {
            
            size_t original_size = blocks[i].size;
            
            // Split if remainder is large enough
            if (original_size > total_size + sizeof(free_block_t) + 16) {
                if (block_count < MAX_BLOCKS) {
                    blocks[block_count].offset = local_offset + total_size;
                    blocks[block_count].size = original_size - total_size;
                    blocks[block_count].state = blocks[i].state;
                    blocks[block_count].allocation_id = 0;
                    blocks[block_count].timestamp = stats.timestamp_counter++;
                    blocks[block_count].requested_size = 0;
                    blocks[block_count].region_id = best_region;
                    
                    free_block_t* remainder = (free_block_t*)((uint8_t*)best_fit + total_size);
                    remainder->size = blocks[block_count].size;
                    remainder->region_id = best_region;
                    remainder->next = free_lists[best_region];
                    free_lists[best_region] = remainder;
                    
                    block_count++;
                    blocks[i].size = total_size;
                }
            }
            
            blocks[i].state = BLOCK_ALLOCATED;
            blocks[i].allocation_id = stats.next_allocation_id;
            blocks[i].timestamp = stats.timestamp_counter++;
            blocks[i].requested_size = requested_size;
            break;
        }
    }
    
    add_log_with_region("MALLOC", stats.next_allocation_id, size, local_offset, 1, best_region, flags);
    stats.next_allocation_id++;
    
    sort_blocks();
    update_global_stats();
    return user_ptr;
}

void* heap_malloc(size_t size) {
    return heap_malloc_flags(size, 0);
}

void heap_free(void* ptr) {
    if (!ptr || !initialized) return;
    
    size_t* block_start = (size_t*)ptr - 1;
    size_t user_size = *block_start;
    size_t total_size = user_size + sizeof(size_t);
    
    // Find region
    uint8_t region_id = get_region_for_ptr(block_start);
    size_t local_offset = get_offset_in_region(block_start, region_id);
    
    uint32_t alloc_id = 0;
    
    // Update block tracking
    for (int i = 0; i < block_count; i++) {
        if (blocks[i].offset == local_offset && 
            blocks[i].region_id == region_id && 
            blocks[i].state == BLOCK_ALLOCATED) {
            blocks[i].state = BLOCK_FREED;
            alloc_id = blocks[i].allocation_id;
            blocks[i].allocation_id = 0;
            blocks[i].requested_size = 0;
            break;
        }
    }
    
    // Add to region's free list
    free_block_t* free_block = (free_block_t*)block_start;
    free_block->size = total_size;
    free_block->region_id = region_id;
    free_block->next = free_lists[region_id];
    free_lists[region_id] = free_block;
    
    immediate_neighbor_coalesce(local_offset, region_id);
    coalesce_pending = 1;
    
    add_log_with_region("FREE", alloc_id, 0, local_offset, 1, region_id, 0);
    sort_blocks();
    update_global_stats();
}

void heap_reset() {
    initialized = false;
    heap_init(stats.total_size);
}

// Get region-specific stats
heap_stats_t* get_region_stats(uint8_t region_id) {
    static heap_stats_t region_stats;
    
    if (region_id >= region_count) return NULL;
    
    update_region_stats(region_id);
    
    heap_region_t* region = &regions[region_id];
    
    memset(&region_stats, 0, sizeof(heap_stats_t));
    region_stats.total_size = region->size;
    region_stats.allocated_bytes = region->allocated_bytes;
    region_stats.free_bytes = region->free_bytes;
    region_stats.allocation_count = region->allocation_count;
    region_stats.free_block_count = region->free_block_count;
    region_stats.largest_free_block = region->largest_free_block;
    region_stats.smallest_free_block = region->smallest_free_block;
    region_stats.external_fragmentation = region->external_fragmentation;
    region_stats.internal_fragmentation = region->internal_fragmentation;
    region_stats.next_allocation_id = stats.next_allocation_id;
    region_stats.timestamp_counter = stats.timestamp_counter;
    region_stats.min_free_bytes = region->min_free_bytes;
    
    return &region_stats;
}

heap_stats_t* get_heap_stats() {
    update_global_stats();
    return &stats;
}

const char* get_region_name(uint8_t region_id) {
    if (region_id >= region_count) return "UNKNOWN";
    return regions[region_id].name;
}

uint8_t get_region_flags(uint8_t region_id) {
    if (region_id >= region_count) return 0;
    return regions[region_id].flags;
}

size_t get_region_size(uint8_t region_id) {
    if (region_id >= region_count) return 0;
    return regions[region_id].size;
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

int get_region_count() {
    return region_count;
}