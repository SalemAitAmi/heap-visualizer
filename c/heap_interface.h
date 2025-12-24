#ifndef HEAP_INTERFACE_H
#define HEAP_INTERFACE_H

#include <stdint.h>
#include <stddef.h>

#define MAX_HEAP_SIZE 65536
#define MAX_ALLOCATIONS 1000
#define MAX_LOG_ENTRIES 10000

typedef enum {
    HEAP_1 = 1,
    HEAP_2 = 2,
    HEAP_3 = 3,
    HEAP_4 = 4,
    HEAP_5 = 5
} heap_type_t;

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
} block_info_t;

typedef struct {
    char action[64];
    uint32_t allocation_id;
    size_t size;
    size_t offset;
    uint32_t timestamp;
    int success;
} log_entry_t;

typedef struct {
    size_t total_size;
    size_t allocated_bytes;
    size_t free_bytes;
    uint32_t allocation_count;
    uint32_t free_block_count;
    uint32_t freed_block_count;  // New: count of freed blocks
    uint32_t next_allocation_id;
    uint32_t timestamp_counter;
    size_t largest_free_block;   // New metric
    size_t smallest_free_block;  // New metric  
    size_t min_free_bytes;       // New: minimum free bytes since startup
    float external_fragmentation; // New: as percentage
    float internal_fragmentation; // New: as percentage
    size_t total_internal_waste;  // New: total wasted bytes
} heap_stats_t;

// Shared global variables (declared in heap_interface.c)
extern uint8_t heap_memory[MAX_HEAP_SIZE];
extern block_info_t blocks[MAX_ALLOCATIONS];
extern heap_stats_t stats;
extern int block_count;

// Interface functions
void heap_init(heap_type_t type, size_t size);
void* heap_malloc(size_t size);
void heap_free(void* ptr);
void heap_reset(void);

// Query functions for JavaScript
heap_stats_t* get_heap_stats(void);
int get_block_count(void);
block_info_t* get_block_info(int index);
int get_log_count(void);
log_entry_t* get_log_entry(int index);
void clear_log(void);

// Heap-specific implementations
void* heap1_malloc(size_t size);
void heap1_free(void* ptr);
void heap1_init(size_t size);

void* heap2_malloc(size_t size);
void heap2_free(void* ptr);
void heap2_init(size_t size);

void* heap3_malloc(size_t size);
void heap3_free(void* ptr);
void heap3_init(size_t size);

void* heap4_malloc(size_t size);
void heap4_free(void* ptr);
void heap4_init(size_t size);

void* heap5_malloc(size_t size);
void heap5_free(void* ptr);
void heap5_init(size_t size);

#endif