import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    LinearProgress, 
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

    const externalFragTooltip = "External fragmentation: free memory broken into small, non-contiguous blocks.";
    const internalFragTooltip = "Internal fragmentation: wasted space within allocated blocks due to alignment.";

    useEffect(() => {
        if (currentHeap === 5 && heapModule) {
            const regions = {};
            const regionCount = heapModule.getRegionCount();
            for (let i = 0; i < regionCount; i++) {
                const info = heapModule.getRegionInfo(i);
                if (info) regions[i] = info;
            }
            setRegionInfo(regions);
            
            if (selectedRegion === 'all') {
                setDisplayStats(stats);
            } else {
                const regionStats = heapModule.getRegionStats(parseInt(selectedRegion));
                setDisplayStats(regionStats || stats);
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

    const StatBox = ({ icon, label, value, color, subValue }) => (
        <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            p: 1,
            borderRadius: 1,
            background: 'rgba(0,0,0,0.02)',
            minWidth: 100
        }}>
            {icon}
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block', lineHeight: 1.2 }}>
                    {label}
                </Typography>
                <Typography variant="body2" fontWeight="bold" sx={{ color: color || 'text.primary', lineHeight: 1.2 }}>
                    {value}
                </Typography>
                {subValue && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                        {subValue}
                    </Typography>
                )}
            </Box>
        </Box>
    );

    const ProgressStat = ({ label, value, percent, color, bgcolor }) => (
        <Box sx={{ minWidth: 120 }}>
            <Box display="flex" justifyContent="space-between" alignItems="baseline">
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{label}</Typography>
                <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.7rem' }}>{value}</Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={percent}
                sx={{ 
                    height: 4, 
                    borderRadius: 2,
                    backgroundColor: bgcolor,
                    '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 2 }
                }}
            />
        </Box>
    );

    const FragStat = ({ label, value, tooltip }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={tooltip} placement="top" arrow>
                <IconButton size="small" sx={{ p: 0 }}>
                    <HelpIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                </IconButton>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{label}:</Typography>
            <Typography variant="body2" fontWeight="bold" sx={{ color: getFragColor(value), fontSize: '0.8rem' }}>
                {value.toFixed(1)}%
            </Typography>
        </Box>
    );

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
            {/* Region Selector for heap_5 */}
            {showRegionSelector && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LayersIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value={0}>FAST</MenuItem>
                            <MenuItem value={1}>DMA</MenuItem>
                            <MenuItem value={2}>UNCACHED</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            )}

            {/* Memory Usage */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MemoryIcon fontSize="small" sx={{ color: 'primary.main' }} />
                <ProgressStat 
                    label="Allocated" 
                    value={`${formatBytes(allocatedBytes)} (${allocatedPercent.toFixed(0)}%)`}
                    percent={allocatedPercent}
                    color="#ef4444"
                    bgcolor="rgba(239,68,68,0.1)"
                />
                <ProgressStat 
                    label="Free" 
                    value={`${formatBytes(freeBytes)} (${freePercent.toFixed(0)}%)`}
                    percent={freePercent}
                    color="#10b981"
                    bgcolor="rgba(16,185,129,0.1)"
                />
            </Box>

            {/* Block Stats */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StorageIcon fontSize="small" sx={{ color: 'primary.main' }} />
                <Chip 
                    label={`${allocationCount} alloc`} 
                    size="small" 
                    sx={{ 
                        bgcolor: 'rgba(99,102,241,0.1)', 
                        color: 'primary.main',
                        fontWeight: 'bold',
                        fontSize: '0.7rem'
                    }} 
                />
                <Chip 
                    label={`${freeBlockCount} free`} 
                    size="small" 
                    sx={{ 
                        bgcolor: 'rgba(16,185,129,0.1)', 
                        color: '#10b981',
                        fontWeight: 'bold',
                        fontSize: '0.7rem'
                    }} 
                />
                <Chip 
                    label={formatBytes(totalSize)} 
                    size="small" 
                    sx={{ 
                        bgcolor: 'rgba(59,130,246,0.1)', 
                        color: '#3b82f6',
                        fontWeight: 'bold',
                        fontSize: '0.7rem'
                    }} 
                />
            </Box>

            {/* Additional Stats */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Largest: <strong>{formatBytes(largestFreeBlock)}</strong>
                </Typography>
                {showMinHistoric && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        Min: <strong>{formatBytes(minFreeBytes)}</strong>
                    </Typography>
                )}
            </Box>

            {/* Fragmentation */}
            {showFragmentation && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
                    <FragmentIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    <FragStat label="Ext" value={externalFragmentation} tooltip={externalFragTooltip} />
                    <FragStat label="Int" value={internalFragmentation} tooltip={internalFragTooltip} />
                </Box>
            )}

            {/* Heap Type Info */}
            {currentHeap === 1 && (
                <Chip label="Bump Allocator" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
            )}
            {currentHeap === 3 && (
                <Chip label="Thread-Safe" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
            )}
        </Box>
    );
};

export default Statistics;
