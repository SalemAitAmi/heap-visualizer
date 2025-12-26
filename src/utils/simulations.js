// src/utils/simulations.js
export const getSimulations = () => ({
    basic: {
        name: "Basic Allocation",
        description: "Simple sequence of allocations and frees",
        steps: [
            { action: 'allocate', size: 64 },      // 0
            { action: 'allocate', size: 128 },     // 1
            { action: 'allocate', size: 32 },      // 2
            { action: 'allocate', size: 256 },     // 3
            { action: 'free', ptrIndex: 1 },       // Free 128-byte
            { action: 'allocate', size: 96 },      // 4
            { action: 'allocate', size: 64 },      // 5
            { action: 'free', ptrIndex: 2 },       // Free 32-byte
            { action: 'allocate', size: 48 },      // 6
            { action: 'free', ptrIndex: 0 },       // Free first 64-byte
            { action: 'allocate', size: 32 },      // 7
            { action: 'allocate', size: 128 },     // 8
            { action: 'free', ptrIndex: 3 },       // Free 256-byte
            { action: 'allocate', size: 200 },     // 9
            { action: 'free', ptrIndex: 4 },       // Free 96-byte
            { action: 'allocate', size: 80 },      // 10
            { action: 'free', ptrIndex: 5 },       // Free 64-byte
            { action: 'allocate', size: 112 }      // 11
        ]
    },
    
    growth: {
        name: "Growth Pattern",
        description: "Shows heap growth with increasing sizes",
        steps: [
            { action: 'allocate', size: 16 },      // 0
            { action: 'allocate', size: 32 },      // 1
            { action: 'allocate', size: 64 },      // 2
            { action: 'allocate', size: 128 },     // 3
            { action: 'allocate', size: 256 },     // 4
            { action: 'allocate', size: 512 },     // 5
            { action: 'free', ptrIndex: 2 },       // Free 64-byte
            { action: 'allocate', size: 48 },      // 6
            { action: 'allocate', size: 1024 },    // 7
            { action: 'free', ptrIndex: 1 },       // Free 32-byte
            { action: 'allocate', size: 24 },      // 8
            { action: 'allocate', size: 2048 },    // 9
            { action: 'free', ptrIndex: 4 },       // Free 256-byte
            { action: 'allocate', size: 200 },     // 10
            { action: 'allocate', size: 4096 },    // 11
            { action: 'free', ptrIndex: 0 },       // Free 16-byte
            { action: 'allocate', size: 8 },       // 12
            { action: 'allocate', size: 8192 }     // 13
        ]
    },

    mixed: {
        name: "Mixed Sizes",
        description: "Random allocation sizes with strategic frees",
        steps: [
            { action: 'allocate', size: 100 },     // 0
            { action: 'allocate', size: 50 },      // 1
            { action: 'allocate', size: 200 },     // 2
            { action: 'free', ptrIndex: 0 },       // Free 100
            { action: 'allocate', size: 75 },      // 3
            { action: 'allocate', size: 300 },     // 4
            { action: 'free', ptrIndex: 2 },       // Free 200
            { action: 'allocate', size: 25 },      // 5
            { action: 'allocate', size: 150 },     // 6
            { action: 'free', ptrIndex: 1 },       // Free 50
            { action: 'allocate', size: 80 },      // 7
            { action: 'allocate', size: 400 },     // 8
            { action: 'free', ptrIndex: 3 },       // Free 75
            { action: 'allocate', size: 60 },      // 9
            { action: 'allocate', size: 120 },     // 10
            { action: 'free', ptrIndex: 4 },       // Free 300
            { action: 'allocate', size: 250 },     // 11
            { action: 'free', ptrIndex: 5 },       // Free 25
            { action: 'allocate', size: 35 },      // 12
            { action: 'allocate', size: 90 },      // 13
            { action: 'free', ptrIndex: 6 },       // Free 150
            { action: 'allocate', size: 110 }      // 14
        ]
    },

    fragmentation: {
        name: "Fragmentation Demo",
        description: "Creates and demonstrates memory fragmentation patterns",
        steps: [
            { action: 'allocate', size: 100 },     // 0
            { action: 'allocate', size: 100 },     // 1  
            { action: 'allocate', size: 100 },     // 2
            { action: 'allocate', size: 100 },     // 3
            { action: 'allocate', size: 100 },     // 4
            { action: 'allocate', size: 100 },     // 5
            { action: 'free', ptrIndex: 0 },       // Free first
            { action: 'free', ptrIndex: 2 },       // Free third (creates gap)
            { action: 'free', ptrIndex: 4 },       // Free fifth (creates another gap)
            { action: 'allocate', size: 150 },     // 6 - Won't fit in 100-byte gaps
            { action: 'allocate', size: 50 },      // 7 - Fits in first gap
            { action: 'allocate', size: 50 },      // 8 - Fits in second gap
            { action: 'allocate', size: 50 },      // 9 - Fits in third gap
            { action: 'free', ptrIndex: 1 },       // Free second original
            { action: 'free', ptrIndex: 3 },       // Free fourth original
            { action: 'allocate', size: 80 },      // 10 - Fits
            { action: 'allocate', size: 80 },      // 11 - Fits
            { action: 'free', ptrIndex: 7 },       // Free a 50-byte
            { action: 'free', ptrIndex: 8 },       // Free another 50-byte
            { action: 'allocate', size: 90 },      // 12 - May or may not fit depending on coalescing
            { action: 'free', ptrIndex: 5 },       // Free last original 100
            { action: 'allocate', size: 95 }       // 13 - Fits in freed space
        ]
    },

    coalescing: {
        name: "Coalescing Demo",
        description: "Demonstrates block coalescing in heap 4 and 5",
        steps: [
            { action: 'allocate', size: 200 },     // 0
            { action: 'allocate', size: 200 },     // 1
            { action: 'allocate', size: 200 },     // 2
            { action: 'allocate', size: 200 },     // 3
            { action: 'allocate', size: 200 },     // 4
            { action: 'free', ptrIndex: 0 },       // Free first
            { action: 'free', ptrIndex: 1 },       // Free second (should coalesce with first)
            { action: 'allocate', size: 350 },     // 5 - Should fit in coalesced space
            { action: 'free', ptrIndex: 2 },       // Free third
            { action: 'free', ptrIndex: 3 },       // Free fourth (should coalesce with third)
            { action: 'allocate', size: 380 },     // 6 - Should fit in coalesced space
            { action: 'allocate', size: 100 },     // 7
            { action: 'allocate', size: 100 },     // 8
            { action: 'free', ptrIndex: 4 },       // Free last original
            { action: 'free', ptrIndex: 7 },       // Free 100-byte
            { action: 'free', ptrIndex: 8 },       // Free another 100-byte
            { action: 'allocate', size: 150 },     // 9
            { action: 'allocate', size: 250 },     // 10
            { action: 'free', ptrIndex: 5 },       // Free 350-byte
            { action: 'free', ptrIndex: 6 },       // Free 380-byte
            { action: 'allocate', size: 700 },     // 11 - Large allocation after coalescing
            { action: 'allocate', size: 50 }       // 12 - Small allocation
        ]
    },

    regionSpecific: {
        name: "Region-Specific Allocation",
        description: "Demonstrates heap_5 region-based allocation with flags",
        steps: [
            // Allocate to FAST region (small, hot data)
            { action: 'allocate', size: 64, flags: 0x01 },      // 0 - FAST
            { action: 'allocate', size: 32, flags: 0x01 },      // 1 - FAST
            { action: 'allocate', size: 128, flags: 0x01 },     // 2 - FAST
            
            // Allocate to DMA region (hardware buffers)
            { action: 'allocate', size: 512, flags: 0x02 },     // 3 - DMA
            { action: 'allocate', size: 256, flags: 0x02 },     // 4 - DMA
            { action: 'allocate', size: 1024, flags: 0x02 },    // 5 - DMA
            
            // Allocate to UNCACHED region (bulk data)
            { action: 'allocate', size: 2048, flags: 0x04 },    // 6 - UNCACHED
            { action: 'allocate', size: 4096, flags: 0x04 },    // 7 - UNCACHED
            
            // Free some from FAST region
            { action: 'free', ptrIndex: 1 },                    // Free 32B from FAST
            { action: 'allocate', size: 48, flags: 0x01 },      // 8 - Should fit in FAST
            
            // Free from DMA region
            { action: 'free', ptrIndex: 4 },                    // Free 256B from DMA
            { action: 'allocate', size: 200, flags: 0x02 },     // 9 - DMA
            
            // Create fragmentation in FAST region
            { action: 'free', ptrIndex: 0 },                    // Free 64B
            { action: 'allocate', size: 96, flags: 0x01 },      // 10 - FAST
            
            // Free and reallocate in UNCACHED
            { action: 'free', ptrIndex: 6 },                    // Free 2KB
            { action: 'allocate', size: 1500, flags: 0x04 },    // 11 - UNCACHED
            
            // Mixed allocations without flags (any region)
            { action: 'allocate', size: 100 },                  // 12 - Any available
            { action: 'allocate', size: 200 },                  // 13 - Any available
            
            // Free multiple from DMA
            { action: 'free', ptrIndex: 3 },                    // Free 512B
            { action: 'free', ptrIndex: 5 },                    // Free 1KB
            
            // Large allocation to DMA (should coalesce)
            { action: 'allocate', size: 1400, flags: 0x02 },    // 14 - DMA (needs coalescing)
            
            // Cleanup some allocations
            { action: 'free', ptrIndex: 2 },                    // Free FAST
            { action: 'free', ptrIndex: 7 },                    // Free UNCACHED
            { action: 'free', ptrIndex: 12 },                   // Free mixed
            
            // Final allocations to show state
            { action: 'allocate', size: 80, flags: 0x01 },      // 15 - FAST
            { action: 'allocate', size: 300, flags: 0x02 },     // 16 - DMA
            { action: 'allocate', size: 1000, flags: 0x04 }     // 17 - UNCACHED
        ]
    }
});