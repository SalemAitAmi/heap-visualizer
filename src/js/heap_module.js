import Heap1Module from './heap1.js';
import Heap2Module from './heap2.js';
import Heap3Module from './heap3.js';
import Heap4Module from './heap4.js';
import Heap5Module from './heap5.js';

const HEAP_MODULES = {
    1: { module: Heap1Module, name: 'Heap 1 - Bump Allocator', hasOffset: true },
    2: { module: Heap2Module, name: 'Heap 2 - Best Fit', hasOffset: false },
    3: { module: Heap3Module, name: 'Heap 3 - Thread Safe', hasOffset: false },
    4: { module: Heap4Module, name: 'Heap 4 - Coalescing', hasOffset: false },
    5: { module: Heap5Module, name: 'Heap 5 - Multi-Region', hasOffset: false }
};

class HeapWrapper {
    constructor() {
        this.modules = {};
        this.currentHeap = 1;
        this.currentModule = null;
        this.initialized = false;
    }

    async init() {
        try {
            console.log('Initializing all heap modules...');
            
            // Initialize all available heap modules
            for (const [heapType, config] of Object.entries(HEAP_MODULES)) {
                console.log(`Loading ${config.name}...`);
                this.modules[heapType] = await config.module();
                console.log(`${config.name} loaded successfully`);
            }
            
            this.currentModule = this.modules[this.currentHeap];
            this.initialized = true;
            console.log('All heap modules initialized successfully');
        } catch (error) {
            console.error('Failed to initialize heap modules:', error);
            throw error;
        }
    }

    switchHeap(heapType) {
        if (!this.initialized) throw new Error('Module not initialized');
        if (!this.modules[heapType]) throw new Error(`Heap ${heapType} not available`);
        
        this.currentHeap = heapType;
        this.currentModule = this.modules[heapType];
        console.log(`Switched to ${HEAP_MODULES[heapType].name}`);
    }

    getCurrentHeapInfo() {
        return HEAP_MODULES[this.currentHeap];
    }

    getAvailableHeaps() {
        return Object.entries(HEAP_MODULES).map(([type, config]) => ({
            type: parseInt(type),
            name: config.name,
            available: !!this.modules[type]
        }));
    }

    initHeap(size) {
        if (!this.initialized) throw new Error('Module not initialized');
        console.log(`Initializing ${HEAP_MODULES[this.currentHeap].name} with size: ${size}`);
        this.currentModule._heap_init(size);
    }

    malloc(size) {
        if (!this.initialized) throw new Error('Module not initialized');
        const ptr = this.currentModule._heap_malloc(size);
        console.log(`malloc(${size}) = ${ptr}`);
        return ptr;
    }

    mallocFlags(size, flags) {
        if (!this.initialized) throw new Error('Module not initialized');
        if (this.currentHeap !== 5) {
            // Fall back to regular malloc for non-heap5
            return this.malloc(size);
        }
        
        // Call heap_malloc_flags for heap_5
        if (this.currentModule._heap_malloc_flags) {
            const ptr = this.currentModule._heap_malloc_flags(size, flags);
            console.log(`malloc_flags(${size}, 0x${flags.toString(16)}) = ${ptr}`);
            return ptr;
        }
        
        return this.malloc(size);
    }

    free(ptr) {
        if (!this.initialized) throw new Error('Module not initialized');
        console.log(`free(${ptr})`);
        this.currentModule._heap_free(ptr);
    }

    reset() {
        if (!this.initialized) throw new Error('Module not initialized');
        console.log('Resetting heap');
        this.currentModule._heap_reset();
    }

    getStats() {
        if (!this.initialized) throw new Error('Module not initialized');
        
        try {
            const statsPtr = this.currentModule._get_heap_stats();
            if (!statsPtr) return {};

            const HEAPU32 = this.currentModule.HEAPU32;
            const HEAPF32 = this.currentModule.HEAPF32;
            const idx = statsPtr >> 2;
            
            // Read heap_stats_t structure
            // typedef struct {
            //     size_t total_size;              // idx + 0
            //     size_t allocated_bytes;         // idx + 1
            //     size_t free_bytes;              // idx + 2
            //     uint32_t allocation_count;      // idx + 3
            //     uint32_t free_block_count;      // idx + 4
            //     uint32_t next_allocation_id;    // idx + 5
            //     uint32_t timestamp_counter;     // idx + 6
            //     size_t largest_free_block;      // idx + 7
            //     size_t smallest_free_block;     // idx + 8
            //     size_t min_free_bytes;          // idx + 9
            //     float external_fragmentation;   // idx + 10
            //     float internal_fragmentation;   // idx + 11
            // } heap_stats_t;
            
            const stats = {
                totalSize: HEAPU32[idx],
                allocatedBytes: HEAPU32[idx + 1],
                freeBytes: HEAPU32[idx + 2],
                allocationCount: HEAPU32[idx + 3],
                freeBlockCount: HEAPU32[idx + 4],
                nextAllocationId: HEAPU32[idx + 5],
                timestampCounter: HEAPU32[idx + 6],
                largestFreeBlock: HEAPU32[idx + 7],
                smallestFreeBlock: HEAPU32[idx + 8],
                minFreeBytes: HEAPU32[idx + 9],
                externalFragmentation: HEAPF32[idx + 10],
                internalFragmentation: HEAPF32[idx + 11]
            };
            
            console.log('Stats read from heap:', stats);
            return stats;
        } catch (error) {
            console.error('Error reading stats:', error);
            return {};
        }
    }

    getBlocks() {
        if (!this.initialized) throw new Error('Module not initialized');
        
        try {
            let count, getBlockInfo;
            
            if (this.currentHeap === 1) {
                count = this.currentModule._get_allocation_count();
                getBlockInfo = (i) => this.currentModule._get_allocation_info(i);
            } else {
                count = this.currentModule._get_block_count();
                getBlockInfo = (i) => this.currentModule._get_block_info(i);
            }
            
            const blocks = [];
            
            for (let i = 0; i < count; i++) {
                const blockPtr = getBlockInfo(i);
                if (blockPtr) {
                    const HEAPU32 = this.currentModule.HEAPU32;
                    const HEAPU8 = this.currentModule.HEAPU8;
                    const idx = blockPtr >> 2;
                    
                    // typedef struct {
                    //     size_t offset;              // idx + 0
                    //     size_t size;                // idx + 1
                    //     block_state_t state;        // idx + 2
                    //     uint32_t allocation_id;     // idx + 3
                    //     uint32_t timestamp;         // idx + 4
                    //     size_t requested_size;      // idx + 5
                    //     uint8_t region_id;          // byte at blockPtr + 24
                    // } block_info_t;
                    
                    const block = {
                        offset: HEAPU32[idx],
                        size: HEAPU32[idx + 1],
                        state: HEAPU32[idx + 2],
                        allocationId: HEAPU32[idx + 3],
                        timestamp: HEAPU32[idx + 4],
                        requestedSize: HEAPU32[idx + 5],
                        regionId: HEAPU8[blockPtr + 24] // region_id is at byte offset 24
                    };
                    blocks.push(block);
                }
            }
            
            console.log(`Loaded ${blocks.length} blocks`);
            return blocks;
        } catch (error) {
            console.error('Error reading blocks:', error);
            return [];
        }
    }

    getRegionStats(regionId) {
        if (!this.initialized) throw new Error('Module not initialized');
        if (this.currentHeap !== 5) return null;
        
        try {
            if (this.currentModule._get_region_stats) {
                const statsPtr = this.currentModule._get_region_stats(regionId);
                if (!statsPtr) return null;

                const HEAPU32 = this.currentModule.HEAPU32;
                const HEAPF32 = this.currentModule.HEAPF32;
                const idx = statsPtr >> 2;
                
                const stats = {
                    totalSize: HEAPU32[idx],
                    allocatedBytes: HEAPU32[idx + 1],
                    freeBytes: HEAPU32[idx + 2],
                    allocationCount: HEAPU32[idx + 3],
                    freeBlockCount: HEAPU32[idx + 4],
                    nextAllocationId: HEAPU32[idx + 5],
                    timestampCounter: HEAPU32[idx + 6],
                    largestFreeBlock: HEAPU32[idx + 7],
                    smallestFreeBlock: HEAPU32[idx + 8],
                    minFreeBytes: HEAPU32[idx + 9],
                    externalFragmentation: HEAPF32[idx + 10],
                    internalFragmentation: HEAPF32[idx + 11]
                };
                
                return stats;
            }
        } catch (error) {
            console.error('Error reading region stats:', error);
        }
        return null;
    }

    getRegionInfo(regionId) {
        if (!this.initialized) throw new Error('Module not initialized');
        if (this.currentHeap !== 5) return null;
        
        try {
            const size = this.currentModule._get_region_size ? 
                this.currentModule._get_region_size(regionId) : 0;
            
            const namePtr = this.currentModule._get_region_name ? 
                this.currentModule._get_region_name(regionId) : 0;
            
            let name = 'UNKNOWN';
            if (namePtr) {
                const HEAPU8 = this.currentModule.HEAPU8;
                name = '';
                for (let i = 0; i < 32; i++) {
                    const char = HEAPU8[namePtr + i];
                    if (char === 0) break;
                    name += String.fromCharCode(char);
                }
            }
            
            const flags = this.currentModule._get_region_flags ? 
                this.currentModule._get_region_flags(regionId) : 0;
            
            return { size, name, flags };
        } catch (error) {
            console.error('Error reading region info:', error);
        }
        return null;
    }

    getRegionCount() {
        if (!this.initialized) throw new Error('Module not initialized');
        if (this.currentHeap !== 5) return 0;
        
        try {
            return this.currentModule._get_region_count ? 
                this.currentModule._get_region_count() : 0;
        } catch (error) {
            console.error('Error getting region count:', error);
        }
        return 0;
    }

    getLogs() {
        if (!this.initialized) throw new Error('Module not initialized');
        
        try {
            const count = this.currentModule._get_log_count();
            const logs = [];
            
            for (let i = 0; i < count; i++) {
                const logPtr = this.currentModule._get_log_entry(i);
                if (logPtr) {
                    const HEAPU8 = this.currentModule.HEAPU8;
                    let action = '';
                    for (let j = 0; j < 32; j++) {
                        const char = HEAPU8[logPtr + j];
                        if (char === 0) break;
                        action += String.fromCharCode(char);
                    }
                    
                    const HEAPU32 = this.currentModule.HEAPU32;
                    const HEAP32 = this.currentModule.HEAP32;
                    const idx = (logPtr + 32) >> 2;
                    
                    const log = {
                        action: action,
                        allocationId: HEAPU32[idx],
                        size: HEAPU32[idx + 1],
                        offset: HEAPU32[idx + 2],
                        timestamp: HEAPU32[idx + 3],
                        success: HEAP32[idx + 4],
                        regionId: HEAPU8[logPtr + 52],  // Read region_id (after the 52 bytes of other fields)
                        flags: HEAPU8[logPtr + 53]       // Read flags
                    };
                    
                    // Add region name for heap_5
                    if (this.currentHeap === 5 && log.regionId !== 0xFF) {
                        const regionNames = ['FAST', 'DMA', 'UNCACHED'];
                        log.regionName = regionNames[log.regionId] || `Region ${log.regionId}`;
                    }
                    
                    logs.push(log);
                }
            }
            return logs;
        } catch (error) {
            console.error('Error reading logs:', error);
            return [];
        }
    }

    getHeapOffset() {
        if (!this.initialized) throw new Error('Module not initialized');
        
        // Only heap1 has heap offset
        if (this.currentHeap === 1 && this.currentModule._get_heap_offset) {
            try {
                return this.currentModule._get_heap_offset();
            } catch (error) {
                console.error('Error getting heap offset:', error);
            }
        }
        return 0;
    }

    clearLog() {
        if (!this.initialized) throw new Error('Module not initialized');
        this.currentModule._clear_log();
    }
}

export default HeapWrapper;