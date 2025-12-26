import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    LinearProgress, 
    FormControl,
    Select,
    MenuItem,
    Chip,
    Tooltip,
    IconButton
} from '@mui/material';
import { 
    Memory as MemoryIcon,
    Storage as StorageIcon,
    BrokenImage as FragmentIcon,
    Layers as LayersIcon,
    HelpOutline as HelpIcon
} from '@mui/icons-material';

// Heap implementation descriptions for tooltips
const HEAP_INFO = {
    1: {
        label: 'Bump Allocator',
        description: `Heap 1 (Bump/Linear Allocator):
• Simplest allocation strategy - just increments a pointer
• O(1) allocation time, extremely fast
• Does NOT support freeing individual blocks
• Memory can only be reclaimed by resetting the entire heap
• Zero fragmentation since memory is allocated contiguously
• Best for: scratch buffers, temporary allocations, arena allocators
• Limitation: Cannot free memory until full reset`
    },
    2: {
        label: 'Best Fit',
        description: `Heap 2 (Best Fit Allocator):
• Searches free list for smallest block that fits request
• Minimizes wasted space within allocated blocks
• O(n) allocation time where n = number of free blocks
• Supports freeing but does NOT coalesce adjacent free blocks
• Can lead to external fragmentation over time
• Best for: workloads with predictable allocation sizes
• Limitation: No coalescing means free blocks stay fragmented`
    },
    3: {
        label: 'Thread Safe',
        description: `Heap 3 (Thread-Safe Wrapper):
• Wraps the system's standard malloc/free with mutex protection
• Thread-safe for concurrent access from multiple threads
• Performance depends on underlying system allocator
• Inherits all properties of system malloc (usually optimized)
• Best for: multi-threaded applications needing standard behavior
• Limitation: Mutex overhead on every allocation/free`
    },
    4: {
        label: 'Coalescing',
        description: `Heap 4 (Coalescing Allocator):
• First-fit allocation with adjacent block coalescing
• Merges adjacent free blocks to reduce fragmentation
• O(n) allocation, O(1) free with immediate coalescing
• Better memory utilization than non-coalescing allocators
• Maintains sorted free list for efficient merging
• Best for: general purpose allocation with varied sizes
• Advantage: Significantly reduces external fragmentation`
    },
    5: {
        label: 'Multi-Region',
        description: `Heap 5 (Multi-Region Allocator):
• Manages multiple separate memory regions with different properties
• Supports region-specific allocation via flags (FAST, DMA, UNCACHED)
• Each region has independent free lists and statistics
• Coalescing within each region, no cross-region merging
• Can fall back to other regions if preferred region is full
• Best for: embedded systems with heterogeneous memory types
• Use cases: Cache-friendly hot data, DMA buffers, bulk storage`
    }
};

const Statistics = ({ stats, currentHeap, blocks, heapModule }) => {
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [displayStats, setDisplayStats] = useState(stats);

    const externalFragTooltip = "External fragmentation: free memory scattered in small non-contiguous blocks.";
    const internalFragTooltip = "Internal fragmentation: wasted space within allocated blocks due to alignment.";

    useEffect(() => {
        if (currentHeap === 5 && heapModule) {
            if (selectedRegion === 'all') {
                setDisplayStats(stats);
            } else {
                const regionStats = heapModule.getRegionStats(parseInt(selectedRegion));
                setDisplayStats(regionStats || stats);
            }
        } else {
            setDisplayStats(stats);
        }
    }, [selectedRegion, stats, currentHeap, heapModule]);

    const {
        totalSize = 0,
        allocatedBytes = 0,
        freeBytes = 0,
        allocationCount = 0,
        freeBlockCount = 0,
        largestFreeBlock = 0,
        minFreeBytes = 0,
        externalFragmentation = 0,
        internalFragmentation = 0
    } = displayStats;

    const allocatedPercent = totalSize > 0 ? (allocatedBytes / totalSize) * 100 : 0;
    const freePercent = totalSize > 0 ? (freeBytes / totalSize) * 100 : 0;

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0B';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    };

    const getFragColor = (v) => v < 10 ? '#10b981' : v < 30 ? '#f59e0b' : '#ef4444';
    const showFragmentation = currentHeap === 2 || currentHeap === 4 || currentHeap === 5;
    const showRegionSelector = currentHeap === 5;
    const showMinHistoric = currentHeap !== 1 && selectedRegion === 'all';

    const heapInfo = HEAP_INFO[currentHeap] || { label: `Heap ${currentHeap}`, description: 'No description available.' };

    return (
        <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 2, 
            alignItems: 'center',
            p: 1.5,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
        }}>
            {/* Heap Type Chip */}
            <Tooltip title={<Box sx={{ whiteSpace: 'pre-line', maxWidth: 350, fontSize: '0.85rem' }}>{heapInfo.description}</Box>} placement="bottom" arrow>
                <Chip
                    label={heapInfo.label}
                    size="medium"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 'bold', cursor: 'help', fontSize: '0.85rem', height: 32 }}
                />
            </Tooltip>

            {/* Region Selector for heap_5 */}
            {showRegionSelector && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LayersIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                        <Select
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            sx={{ fontSize: '0.85rem' }}
                        >
                            <MenuItem value="all">All Regions</MenuItem>
                            <MenuItem value={0}>FAST</MenuItem>
                            <MenuItem value={1}>DMA</MenuItem>
                            <MenuItem value={2}>UNCACHED</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Memory Usage - expanded to use more space */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 auto', minWidth: 280 }}>
                <MemoryIcon sx={{ fontSize: 22, color: 'primary.main', flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.25}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Allocated</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.85rem' }}>{formatBytes(allocatedBytes)} ({allocatedPercent.toFixed(0)}%)</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={allocatedPercent}
                        sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(239,68,68,0.15)', '& .MuiLinearProgress-bar': { backgroundColor: '#ef4444', borderRadius: 3 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.25}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Free</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.85rem' }}>{formatBytes(freeBytes)} ({freePercent.toFixed(0)}%)</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={freePercent}
                        sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(16,185,129,0.15)', '& .MuiLinearProgress-bar': { backgroundColor: '#10b981', borderRadius: 3 } }} />
                </Box>
            </Box>

            {/* Block Stats */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                <Chip label={`${allocationCount} alloc`} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.12)', color: 'primary.main', fontWeight: 'bold', fontSize: '0.8rem', height: 26 }} />
                <Chip label={`${freeBlockCount} free`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem', height: 26 }} />
                <Chip label={formatBytes(totalSize)} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 'bold', fontSize: '0.8rem', height: 26 }} />
            </Box>

            {/* Additional Stats */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    Largest: <strong>{formatBytes(largestFreeBlock)}</strong>
                </Typography>
                {showMinHistoric && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        Min: <strong>{formatBytes(minFreeBytes)}</strong>
                    </Typography>
                )}
            </Box>

            {/* Fragmentation */}
            {showFragmentation && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <FragmentIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={externalFragTooltip} placement="top" arrow>
                            <IconButton size="small" sx={{ p: 0.25 }}><HelpIcon sx={{ fontSize: 14, color: 'text.secondary' }} /></IconButton>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Ext:</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: getFragColor(externalFragmentation), fontSize: '0.9rem' }}>
                            {externalFragmentation.toFixed(0)}%
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={internalFragTooltip} placement="top" arrow>
                            <IconButton size="small" sx={{ p: 0.25 }}><HelpIcon sx={{ fontSize: 14, color: 'text.secondary' }} /></IconButton>
                        </Tooltip>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Int:</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: getFragColor(internalFragmentation), fontSize: '0.9rem' }}>
                            {internalFragmentation.toFixed(0)}%
                        </Typography>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default Statistics;
