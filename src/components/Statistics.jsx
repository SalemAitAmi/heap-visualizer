import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    LinearProgress, 
    Divider, 
    Grid,
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

const Statistics = ({ stats, currentHeap, blocks, heapModule }) => {
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [displayStats, setDisplayStats] = useState(stats);
    const [regionInfo, setRegionInfo] = useState({});

    // Fragmentation explanations
    const externalFragTooltip = "External fragmentation occurs when free memory is broken into small, non-contiguous blocks. Measured as 1 - (largest free block / total free memory). High values indicate memory is scattered in small chunks.";
    
    const internalFragTooltip = "Internal fragmentation is wasted space within allocated blocks due to alignment and padding requirements. Measured as (allocated - requested) / allocated. This represents memory that's allocated but not actually used.";

    // Fetch region-specific stats when needed
    useEffect(() => {
        if (currentHeap === 5 && heapModule) {
            // Get region information
            const regions = {};
            const regionCount = heapModule.getRegionCount();
            
            for (let i = 0; i < regionCount; i++) {
                const info = heapModule.getRegionInfo(i);
                if (info) {
                    regions[i] = info;
                }
            }
            setRegionInfo(regions);
            
            // Get appropriate stats
            if (selectedRegion === 'all') {
                setDisplayStats(stats);
            } else {
                const regionStats = heapModule.getRegionStats(parseInt(selectedRegion));
                if (regionStats) {
                    setDisplayStats(regionStats);
                } else {
                    setDisplayStats(stats);
                }
            }
        } else {
            setDisplayStats(stats);
            setRegionInfo({});
        }
    }, [selectedRegion, stats, currentHeap, heapModule]);

    const {
        totalSize = 0,
        allocatedBytes = 0,
        freeBytes = 0,
        allocationCount = 0,
        freeBlockCount = 0,
        largestFreeBlock = 0,
        smallestFreeBlock = 0,
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

    const getFragmentationColor = (value) => {
        if (value < 10) return '#10b981';
        if (value < 30) return '#f59e0b';
        return '#ef4444';
    };

    const showFragmentation = (currentHeap === 2 || currentHeap === 4 || currentHeap === 5);
    const showRegionSelector = currentHeap === 5;
    const showMinHistoric = currentHeap !== 1 && selectedRegion === 'all';

    const getRegionName = (regionId) => {
        if (regionInfo[regionId]) {
            return `${regionInfo[regionId].name}`;
        }
        return `Region ${regionId}`;
    };

    return (
        <Box sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1.5,
            overflow: 'visible'
        }}>
            {/* Region Selector for heap_5 */}
            {showRegionSelector && (
                <Box sx={{ 
                    p: 1.5, 
                    background: 'rgba(99,102,241,0.05)',
                    borderRadius: 2,
                    border: '1px solid rgba(99,102,241,0.1)',
                    flexShrink: 0
                }}>
                    <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <LayersIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
                            Region View
                        </Typography>
                    </Box>
                    <FormControl fullWidth size="small">
                        <Select
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            sx={{ 
                                background: 'white',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'primary.light'
                                }
                            }}
                        >
                            <MenuItem value="all">All Regions (Aggregated)</MenuItem>
                            <MenuItem value={0}>Region 0 - FAST</MenuItem>
                            <MenuItem value={1}>Region 1 - DMA</MenuItem>
                            <MenuItem value={2}>Region 2 - UNCACHED</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Memory Usage */}
            <Box sx={{ flexShrink: 0 }}>
                <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                    <MemoryIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
                        Memory Usage
                        {selectedRegion !== 'all' && ` - ${getRegionName(selectedRegion)}`}
                    </Typography>
                </Box>
                
                <Grid container spacing={1}>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                            Allocated
                        </Typography>
                        <Typography variant="body2" fontWeight="600" color="text.primary" noWrap>
                            {formatBytes(allocatedBytes)} ({allocatedPercent.toFixed(1)}%)
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={allocatedPercent}
                            sx={{ 
                                height: 6, 
                                borderRadius: 3,
                                backgroundColor: 'rgba(239,68,68,0.1)',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#ef4444',
                                    borderRadius: 3
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                            Free
                        </Typography>
                        <Typography variant="body2" fontWeight="600" color="text.primary" noWrap>
                            {formatBytes(freeBytes)} ({freePercent.toFixed(1)}%)
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={freePercent}
                            sx={{ 
                                height: 6, 
                                borderRadius: 3,
                                backgroundColor: 'rgba(16,185,129,0.1)',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#10b981',
                                    borderRadius: 3
                                }
                            }}
                        />
                    </Grid>
                </Grid>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />

            {/* Block Statistics */}
            <Box sx={{ flexShrink: 0 }}>
                <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                    <StorageIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
                        Block Statistics
                    </Typography>
                </Box>
                
                <Grid container spacing={1}>
                    <Grid item xs={4}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            p: 0.75, 
                            borderRadius: 2,
                            background: 'rgba(99,102,241,0.05)',
                            border: '1px solid rgba(99,102,241,0.1)'
                        }}>
                            <Typography variant="h6" fontWeight="bold" color="primary.main">
                                {allocationCount}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                Allocations
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={4}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            p: 0.75, 
                            borderRadius: 2,
                            background: 'rgba(16,185,129,0.05)',
                            border: '1px solid rgba(16,185,129,0.1)'
                        }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#10b981' }}>
                                {freeBlockCount}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                Free Blocks
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={4}>
                        <Box sx={{ 
                            textAlign: 'center', 
                            p: 0.75, 
                            borderRadius: 2,
                            background: 'rgba(59,130,246,0.05)',
                            border: '1px solid rgba(59,130,246,0.1)'
                        }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: '#3b82f6' }}>
                                {formatBytes(totalSize)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                {selectedRegion !== 'all' ? 'Region' : 'Total'}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    <Grid item xs={6}>
                        <Box sx={{ 
                            p: 0.75, 
                            borderRadius: 1,
                            background: 'rgba(0,0,0,0.02)'
                        }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                Largest Free Block
                            </Typography>
                            <Typography variant="body2" fontWeight="600" noWrap>
                                {formatBytes(largestFreeBlock)}
                            </Typography>
                        </Box>
                    </Grid>
                    {showMinHistoric && (
                        <Grid item xs={6}>
                            <Box sx={{ 
                                p: 0.75, 
                                borderRadius: 1,
                                background: 'rgba(0,0,0,0.02)'
                            }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                    Historical Minimum
                                </Typography>
                                <Typography variant="body2" fontWeight="600" noWrap>
                                    {formatBytes(minFreeBytes)}
                                </Typography>
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </Box>

            {/* Fragmentation Analysis */}
            {showFragmentation && (
                <>
                    <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
                    <Box sx={{ flexShrink: 0 }}>
                        <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                            <FragmentIcon fontSize="small" sx={{ color: 'primary.main' }} />
                            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" noWrap>
                                Fragmentation
                                {selectedRegion !== 'all' && ` - ${getRegionName(selectedRegion)}`}
                            </Typography>
                        </Box>
                        
                        <Grid container spacing={1}>
                            <Grid item xs={6}>
                                <Box>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                            External
                                        </Typography>
                                        <Tooltip title={externalFragTooltip} placement="top" arrow>
                                            <IconButton size="small" sx={{ p: 0 }}>
                                                <HelpIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography 
                                        variant="body1" 
                                        fontWeight="bold"
                                        sx={{ color: getFragmentationColor(externalFragmentation) }}
                                    >
                                        {externalFragmentation.toFixed(1)}%
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(externalFragmentation, 100)}
                                        sx={{ 
                                            height: 4, 
                                            borderRadius: 2,
                                            backgroundColor: 'rgba(0,0,0,0.05)',
                                            '& .MuiLinearProgress-bar': {
                                                backgroundColor: getFragmentationColor(externalFragmentation),
                                                borderRadius: 2
                                            }
                                        }}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box>
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                            Internal
                                        </Typography>
                                        <Tooltip title={internalFragTooltip} placement="top" arrow>
                                            <IconButton size="small" sx={{ p: 0 }}>
                                                <HelpIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography 
                                        variant="body1" 
                                        fontWeight="bold"
                                        sx={{ color: getFragmentationColor(internalFragmentation) }}
                                    >
                                        {internalFragmentation.toFixed(1)}%
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min(internalFragmentation, 100)}
                                        sx={{ 
                                            height: 4, 
                                            borderRadius: 2,
                                            backgroundColor: 'rgba(0,0,0,0.05)',
                                            '& .MuiLinearProgress-bar': {
                                                backgroundColor: getFragmentationColor(internalFragmentation),
                                                borderRadius: 2
                                            }
                                        }}
                                    />
                                </Box>
                            </Grid>
                        </Grid>

                        <Box mt={0.5}>
                            <Chip 
                                size="small" 
                                label={
                                    selectedRegion === 'all' ? "Averaged across all regions" :
                                    externalFragmentation > 30 ? "High fragmentation" :
                                    externalFragmentation > 10 ? "Moderate fragmentation" :
                                    "Low fragmentation"
                                }
                                sx={{
                                    height: '20px',
                                    fontSize: '0.65rem',
                                    backgroundColor: externalFragmentation > 30 ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)',
                                    borderColor: externalFragmentation > 30 ? '#f59e0b' : 'transparent',
                                    fontWeight: 500
                                }}
                                variant="outlined"
                            />
                        </Box>
                    </Box>
                </>
            )}

            {/* Heap-specific info - pushed to bottom */}
            <Box sx={{ flexGrow: 1 }} />
            
            {currentHeap === 1 && (
                <Box 
                    p={1} 
                    sx={{ 
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.08) 100%)',
                        borderRadius: 2,
                        border: '1px solid rgba(99,102,241,0.1)',
                        flexShrink: 0
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        <strong style={{ color: '#6366f1' }}>Bump Allocator:</strong> Simple linear allocation, no free support, zero fragmentation
                    </Typography>
                </Box>
            )}
            
            {currentHeap === 3 && (
                <Box 
                    p={1} 
                    sx={{ 
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.08) 100%)',
                        borderRadius: 2,
                        border: '1px solid rgba(99,102,241,0.1)',
                        flexShrink: 0
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        <strong style={{ color: '#6366f1' }}>Thread-Safe Wrapper:</strong> Uses system malloc/free with mutex protection
                    </Typography>
                </Box>
            )}
            
            {currentHeap === 5 && (
                <Box 
                    p={1} 
                    sx={{ 
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.08) 100%)',
                        borderRadius: 2,
                        border: '1px solid rgba(99,102,241,0.1)',
                        flexShrink: 0
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        <strong style={{ color: '#6366f1' }}>Multi-Region Heap:</strong> 
                        {selectedRegion === 'all' 
                            ? ' Supports FAST, DMA, and UNCACHED memory regions'
                            : ` ${getRegionName(selectedRegion)} - ${
                                selectedRegion == 0 ? 'High-speed cache-friendly memory' :
                                selectedRegion == 1 ? 'DMA-capable hardware buffers' :
                                'Uncached bulk storage'
                              }`
                        }
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default Statistics;
