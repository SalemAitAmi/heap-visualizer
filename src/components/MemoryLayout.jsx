import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
    Box, 
    Typography, 
    Chip, 
    IconButton, 
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Stack,
    Divider
} from '@mui/material';
import { 
    Info, 
    PlayArrow, 
    Pause, 
    SkipPrevious, 
    SkipNext, 
    Refresh 
} from '@mui/icons-material';
import * as d3 from 'd3';

const BLOCK_STATES = {
    0: { name: 'Free', color: '#4CAF50', label: 'Free Memory' },
    1: { name: 'Allocated', color: '#f44336', label: 'Allocated Block' },
    2: { name: 'Freed', color: '#FF9800', label: 'Freed Block' }
};

const REGION_COLORS = {
    0: { border: '#6366f1', bg: 'rgba(99,102,241,0.05)', name: 'FAST', description: 'High-speed cache-friendly memory for frequently accessed data' },
    1: { border: '#ec4899', bg: 'rgba(236,72,153,0.05)', name: 'DMA', description: 'DMA-capable memory for hardware buffer transfers' },
    2: { border: '#3b82f6', bg: 'rgba(59,130,246,0.05)', name: 'UNCACHED', description: 'Uncached memory for bulk data storage' }
};

// Embedded Controls Component
const EmbeddedControls = ({
    availableHeaps,
    currentHeap,
    onHeapChange,
    onAllocate,
    onSimulationChange,
    isPlaying,
    playbackSpeed,
    onPlay,
    onPause,
    onStepForward,
    onStepBackward,
    onReset,
    onSpeedChange,
    currentStep,
    totalSteps,
    simulation
}) => {
    const [allocSize, setAllocSize] = useState(64);
    const [allocCount, setAllocCount] = useState(1);
    const [allocRegion, setAllocRegion] = useState(0);
    const [selectedSimulation, setSelectedSimulation] = useState('');

    useEffect(() => {
        setSelectedSimulation(simulation || '');
    }, [simulation]);

    const handleAllocate = () => {
        if (currentHeap === 5) {
            onAllocate(allocSize, allocCount, allocRegion);
        } else {
            onAllocate(allocSize, allocCount);
        }
    };

    const handleSimulationChange = (event) => {
        const sim = event.target.value;
        setSelectedSimulation(sim);
        onSimulationChange(sim);
    };

    const speedOptions = [0.5, 1, 1.5, 2, 3, 4];

    return (
        <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 1.5, 
            alignItems: 'center',
            p: 1.5,
            background: 'rgba(0,0,0,0.02)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
        }}>
            {/* Heap Selection */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel sx={{ fontSize: '0.8rem' }}>Heap</InputLabel>
                <Select
                    value={currentHeap}
                    onChange={(e) => onHeapChange(e.target.value)}
                    label="Heap"
                    sx={{ fontSize: '0.8rem' }}
                >
                    {availableHeaps.map(heap => (
                        <MenuItem key={heap.type} value={heap.type} disabled={!heap.available}>
                            Heap {heap.type}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Divider orientation="vertical" flexItem />

            {/* Manual Allocation */}
            <Stack direction="row" spacing={0.5} alignItems="center">
                <TextField
                    label="Size"
                    type="number"
                    value={allocSize}
                    onChange={(e) => setAllocSize(parseInt(e.target.value) || 0)}
                    size="small"
                    sx={{ width: 70, '& input': { fontSize: '0.8rem' } }}
                    inputProps={{ min: 1 }}
                />
                <TextField
                    label="Count"
                    type="number"
                    value={allocCount}
                    onChange={(e) => setAllocCount(parseInt(e.target.value) || 0)}
                    size="small"
                    sx={{ width: 60, '& input': { fontSize: '0.8rem' } }}
                    inputProps={{ min: 1, max: 100 }}
                />
                {currentHeap === 5 && (
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                        <InputLabel sx={{ fontSize: '0.75rem' }}>Region</InputLabel>
                        <Select
                            value={allocRegion}
                            onChange={(e) => setAllocRegion(e.target.value)}
                            label="Region"
                            sx={{ fontSize: '0.8rem' }}
                        >
                            <MenuItem value={0}>FAST</MenuItem>
                            <MenuItem value={1}>DMA</MenuItem>
                            <MenuItem value={2}>UNCACHED</MenuItem>
                            <MenuItem value={255}>Any</MenuItem>
                        </Select>
                    </FormControl>
                )}
                <Button
                    variant="contained"
                    onClick={handleAllocate}
                    disabled={allocSize <= 0 || allocCount <= 0}
                    size="small"
                    sx={{ minWidth: 70, fontSize: '0.75rem', py: 0.75 }}
                >
                    Allocate
                </Button>
            </Stack>

            <Divider orientation="vertical" flexItem />

            {/* Simulation */}
            <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel sx={{ fontSize: '0.8rem' }}>Simulation</InputLabel>
                <Select
                    value={selectedSimulation}
                    onChange={handleSimulationChange}
                    label="Simulation"
                    sx={{ fontSize: '0.8rem' }}
                >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="growth">Growth</MenuItem>
                    <MenuItem value="mixed">Mixed</MenuItem>
                    <MenuItem value="fragmentation">Fragmentation</MenuItem>
                    <MenuItem value="coalescing">Coalescing</MenuItem>
                    {currentHeap === 5 && <MenuItem value="regionSpecific">Regions</MenuItem>}
                </Select>
            </FormControl>

            {/* Playback Controls */}
            <Stack direction="row" spacing={0.25} alignItems="center">
                <Tooltip title="Step Backward">
                    <span>
                        <IconButton 
                            onClick={onStepBackward} 
                            disabled={currentStep === 0 || !selectedSimulation} 
                            size="small"
                        >
                            <SkipPrevious fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title={isPlaying ? "Pause" : "Play"}>
                    <span>
                        <IconButton 
                            onClick={isPlaying ? onPause : onPlay}
                            disabled={!selectedSimulation || currentStep >= totalSteps}
                            size="small"
                            sx={{ 
                                bgcolor: 'primary.main',
                                color: 'white',
                                '&:hover': { bgcolor: 'primary.dark' },
                                '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
                            }}
                        >
                            {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Step Forward">
                    <span>
                        <IconButton 
                            onClick={onStepForward}
                            disabled={currentStep >= totalSteps || !selectedSimulation}
                            size="small"
                        >
                            <SkipNext fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Reset">
                    <IconButton onClick={onReset} size="small">
                        <Refresh fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <FormControl size="small" sx={{ minWidth: 60 }}>
                <InputLabel sx={{ fontSize: '0.7rem' }}>Speed</InputLabel>
                <Select
                    value={playbackSpeed}
                    onChange={(e) => onSpeedChange(e.target.value)}
                    label="Speed"
                    disabled={!selectedSimulation}
                    sx={{ fontSize: '0.75rem' }}
                >
                    {speedOptions.map(speed => (
                        <MenuItem key={speed} value={speed}>{speed}x</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {selectedSimulation && (
                <Chip 
                    label={`${currentStep}/${totalSteps}`}
                    size="small"
                    color={currentStep >= totalSteps ? 'success' : 'primary'}
                    sx={{ fontSize: '0.7rem', height: 24 }}
                />
            )}
        </Box>
    );
};

const MemoryLayout = ({ 
    blocks, 
    totalSize, 
    heapOffset, 
    activeBlock, 
    onBlockClick, 
    resetZoom, 
    onFreeBlock,
    // Control props
    availableHeaps,
    currentHeap,
    onHeapChange,
    onAllocate,
    onSimulationChange,
    isPlaying,
    playbackSpeed,
    onPlay,
    onPause,
    onStepForward,
    onStepBackward,
    onReset,
    onSpeedChange,
    currentStep,
    totalSteps,
    simulation
}) => {
    const containerRef = useRef();
    const [dimensions, setDim] = useState({ width: 800, height: 300 });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const tooltipRef = useRef(null);
    const hoverTooltipRef = useRef(null);

    const isHeap5 = blocks.some(b => b.regionId !== undefined && b.regionId > 0);
    
    const blocksByRegion = isHeap5 ? blocks.reduce((acc, block) => {
        const regionId = block.regionId || 0;
        if (!acc[regionId]) acc[regionId] = [];
        acc[regionId].push(block);
        return acc;
    }, {}) : { 0: blocks };

    const regionIds = Object.keys(blocksByRegion).map(Number).sort();

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const { clientWidth } = containerRef.current;
                const height = isHeap5 ? 550 : 280;
                
                setDim({ 
                    width: clientWidth - 40, 
                    height: height
                });
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [isHeap5]);

    useEffect(() => {
        return () => {
            if (tooltipRef.current) {
                tooltipRef.current.remove();
                tooltipRef.current = null;
            }
            if (hoverTooltipRef.current) {
                hoverTooltipRef.current.remove();
                hoverTooltipRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!selectedBlock && tooltipRef.current) {
            tooltipRef.current.remove();
            tooltipRef.current = null;
        }
    }, [selectedBlock]);

    useEffect(() => {
        if (selectedBlock) {
            const stillExists = blocks.some(b => 
                b.offset === selectedBlock.offset && 
                b.allocationId === selectedBlock.allocationId &&
                b.regionId === selectedBlock.regionId
            );
            if (!stillExists) {
                setSelectedBlock(null);
                onBlockClick(null);
                if (tooltipRef.current) {
                    tooltipRef.current.remove();
                    tooltipRef.current = null;
                }
            }
        }
    }, [blocks, selectedBlock, onBlockClick]);

    const formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    const handleBlockClick = (block) => {
        if (selectedBlock?.allocationId === block?.allocationId && selectedBlock?.offset === block?.offset) {
            setSelectedBlock(null);
            onBlockClick(null);
        } else {
            setSelectedBlock(block);
            onBlockClick(block);
        }
    };

    const instructionText = isHeap5
        ? `Each region shown separately. Mouse wheel to zoom, click and drag to pan. Click blocks to select them.`
        : `Mouse wheel to zoom, click and drag to pan. Click blocks to select them.`;

    return (
        <Box ref={containerRef} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header with Controls */}
            <Box sx={{ mb: 1.5 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Memory Layout</Typography>
                    <Tooltip title={instructionText} placement="top" arrow>
                        <IconButton size="small" sx={{ color: 'text.secondary' }}>
                            <Info fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
                
                {/* Embedded Controls */}
                {availableHeaps && (
                    <EmbeddedControls
                        availableHeaps={availableHeaps}
                        currentHeap={currentHeap}
                        onHeapChange={onHeapChange}
                        onAllocate={onAllocate}
                        onSimulationChange={onSimulationChange}
                        isPlaying={isPlaying}
                        playbackSpeed={playbackSpeed}
                        onPlay={onPlay}
                        onPause={onPause}
                        onStepForward={onStepForward}
                        onStepBackward={onStepBackward}
                        onReset={onReset}
                        onSpeedChange={onSpeedChange}
                        currentStep={currentStep}
                        totalSteps={totalSteps}
                        simulation={simulation}
                    />
                )}
            </Box>

            {/* Graph Area */}
            <Box sx={{ 
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {isHeap5 ? (
                    <Heap5Layout
                        blocksByRegion={blocksByRegion}
                        regionIds={regionIds}
                        dimensions={dimensions}
                        selectedBlock={selectedBlock}
                        onBlockClick={handleBlockClick}
                        tooltipRef={tooltipRef}
                        hoverTooltipRef={hoverTooltipRef}
                        resetZoom={resetZoom}
                        onFreeBlock={onFreeBlock}
                        formatBytes={formatBytes}
                    />
                ) : (
                    <SingleHeapLayout
                        blocks={blocks}
                        totalSize={totalSize}
                        heapOffset={heapOffset}
                        dimensions={dimensions}
                        selectedBlock={selectedBlock}
                        onBlockClick={handleBlockClick}
                        tooltipRef={tooltipRef}
                        hoverTooltipRef={hoverTooltipRef}
                        resetZoom={resetZoom}
                        onFreeBlock={onFreeBlock}
                        formatBytes={formatBytes}
                    />
                )}
            </Box>

            {/* Legend */}
            <Box 
                display="flex" 
                gap={1} 
                mt={1.5} 
                pt={1.5} 
                borderTop="1px solid rgba(0,0,0,0.1)" 
                flexWrap="wrap" 
                justifyContent="center"
                alignItems="center"
            >
                {Object.values(BLOCK_STATES).map(state => (
                    <Chip
                        key={state.name}
                        label={state.label}
                        sx={{
                            backgroundColor: state.color,
                            color: 'white',
                            opacity: state.name === 'Free' ? 0.7 : 1,
                            '& .MuiChip-label': { fontWeight: 'bold', fontSize: '0.75rem' }
                        }}
                        size="small"
                    />
                ))}
                
                {isHeap5 && (
                    <>
                        <Box sx={{ width: '1px', height: '20px', bgcolor: 'rgba(0,0,0,0.2)', mx: 1 }} />
                        {Object.entries(REGION_COLORS).map(([id, region]) => (
                            <Tooltip key={id} title={region.description} placement="top" arrow>
                                <Chip
                                    label={region.name}
                                    size="small"
                                    sx={{
                                        borderColor: region.border,
                                        backgroundColor: region.bg,
                                        color: region.border,
                                        fontWeight: 'bold',
                                        cursor: 'help',
                                        fontSize: '0.7rem',
                                        '&:hover': { backgroundColor: `${region.border}22` }
                                    }}
                                    variant="outlined"
                                    icon={<Info sx={{ fontSize: '12px !important', color: `${region.border} !important`, ml: 0.5 }} />}
                                />
                            </Tooltip>
                        ))}
                    </>
                )}
            </Box>
        </Box>
    );
};

const Heap5Layout = ({ blocksByRegion, regionIds, dimensions, selectedBlock, onBlockClick, tooltipRef, hoverTooltipRef, resetZoom, onFreeBlock, formatBytes }) => {
    const svgRefs = useRef({});
    const zoomRefs = useRef({});
    const transformRefs = useRef({});
    const lastZoomLevelRef = useRef({});

    const regionNames = ['FAST', 'DMA', 'UNCACHED'];
    const totalRegionHeight = dimensions.height - 40;
    const regionHeight = Math.floor((totalRegionHeight - 20) / 3);

    useEffect(() => {
        if (resetZoom) {
            regionIds.forEach(regionId => {
                if (zoomRefs.current[regionId]) {
                    const svg = d3.select(svgRefs.current[regionId]);
                    transformRefs.current[regionId] = d3.zoomIdentity;
                    lastZoomLevelRef.current[regionId] = 1;
                    svg.transition().duration(300).call(
                        zoomRefs.current[regionId].transform,
                        d3.zoomIdentity
                    );
                }
            });
        }
    }, [resetZoom, regionIds]);

    useEffect(() => {
        regionIds.forEach(regionId => {
            drawRegionLayout(regionId);
        });
    }, [blocksByRegion, dimensions, regionIds, selectedBlock]);

    const hideHoverTooltip = () => {
        if (hoverTooltipRef.current) {
            hoverTooltipRef.current.remove();
            hoverTooltipRef.current = null;
        }
    };

    const showHoverTooltip = (event, block) => {
        if (selectedBlock && selectedBlock.offset === block.offset && selectedBlock.regionId === block.regionId) {
            return;
        }

        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');
        const regionName = regionNames[block.regionId] || `Region ${block.regionId}`;

        hoverTooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip-hover')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '10px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '9999')
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
            .style('border', '1px solid rgba(255,255,255,0.1)')
            .style('opacity', 0);

        const content = `
            <div>
                <div style="font-weight: bold; margin-bottom: 4px; color: #60a5fa;">Region: ${regionName}</div>
                <div><strong>ID:</strong> ${idText}</div>
                <div><strong>State:</strong> ${stateName}</div>
                <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
                <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
            </div>
        `;

        hoverTooltipRef.current.html(content)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px')
            .transition()
            .duration(150)
            .style('opacity', 1);
    };

    const showPersistentTooltip = (event, block) => {
        if (tooltipRef.current) {
            tooltipRef.current.remove();
        }
        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');
        const regionName = regionNames[block.regionId] || `Region ${block.regionId}`;

        tooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.95)')
            .style('color', 'white')
            .style('padding', '12px')
            .style('border-radius', '8px')
            .style('font-size', '13px')
            .style('pointer-events', 'auto')
            .style('z-index', '10000')
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
            .style('border', '1px solid rgba(255,255,255,0.1)')
            .style('opacity', 0);

        const content = `
            <div style="margin-bottom: 8px;">
                <div style="font-weight: bold; margin-bottom: 6px; color: #60a5fa;">Region: ${regionName}</div>
                <div><strong>ID:</strong> ${idText}</div>
                <div><strong>State:</strong> ${stateName}</div>
                <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
                <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
                <div><strong>End:</strong> 0x${(block.offset + block.size).toString(16).padStart(4, '0')}</div>
                ${block.requestedSize ? `<div><strong>Requested:</strong> ${formatBytes(block.requestedSize)}</div>` : ''}
                ${block.timestamp ? `<div style="color: #9ca3af; font-size: 11px; margin-top: 4px;">Timestamp: ${block.timestamp}</div>` : ''}
            </div>
            ${block.state === 1 ? '<div id="tooltip-free-btn" style="margin-top: 8px; padding: 6px 12px; background: #ef4444; border-radius: 4px; text-align: center; cursor: pointer; font-weight: bold; user-select: none;">Free Block</div>' : ''}
        `;

        tooltipRef.current.html(content)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px')
            .transition()
            .duration(200)
            .style('opacity', 1);

        if (block.state === 1) {
            tooltipRef.current.select('#tooltip-free-btn')
                .on('click', (e) => {
                    e.stopPropagation();
                    if (onFreeBlock) onFreeBlock(block);
                    if (tooltipRef.current) {
                        tooltipRef.current.remove();
                        tooltipRef.current = null;
                    }
                    onBlockClick(null);
                })
                .on('mouseover', function() { d3.select(this).style('background', '#dc2626'); })
                .on('mouseout', function() { d3.select(this).style('background', '#ef4444'); });
        }
    };

    const drawRegionLayout = (regionId) => {
        const regionBlocks = blocksByRegion[regionId] || [];
        if (regionBlocks.length === 0) return;

        const totalSize = Math.max(...regionBlocks.map(b => b.offset + b.size));
        const svg = d3.select(svgRefs.current[regionId]);
        
        const currentTransform = transformRefs.current[regionId];
        const isInitialDraw = !currentTransform || currentTransform.k === 1;
        
        svg.selectAll('*').remove();

        const { width } = dimensions;
        const margin = { top: 15, right: 20, bottom: 45, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = regionHeight - margin.top - margin.bottom;

        const xScale = d3.scaleLinear()
            .domain([0, totalSize])
            .range([0, innerWidth]);

        svg.append('defs')
            .append('clipPath')
            .attr('id', `clip-region-${regionId}`)
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', innerHeight);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const zoom = d3.zoom()
            .scaleExtent([1, 50])
            .on('zoom', (event) => {
                const { transform } = event;
                
                // Log zoom level only when it changes
                const currentZoom = transform.k;
                if (Math.abs(currentZoom - (lastZoomLevelRef.current[regionId] || 1)) > 0.01) {
                    console.log(`Region ${regionId} (${regionNames[regionId]}) zoom: ${currentZoom.toFixed(2)}`);
                    lastZoomLevelRef.current[regionId] = currentZoom;
                }
                
                transformRefs.current[regionId] = transform;
                const newXScale = transform.rescaleX(xScale);
                
                // Clamp domain
                let [d0, d1] = newXScale.domain();
                if (d0 < 0) {
                    const shift = -d0;
                    d0 = 0;
                    d1 = d1 + shift;
                }
                if (d1 > totalSize) {
                    const shift = d1 - totalSize;
                    d1 = totalSize;
                    d0 = Math.max(0, d0 - shift);
                }
                
                const clampedScale = d3.scaleLinear().domain([d0, d1]).range([0, innerWidth]);
                
                // Update blocks
                g.selectAll('.block-rect')
                    .attr('x', d => clampedScale(d.offset))
                    .attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                
                g.selectAll('.block-text')
                    .attr('x', d => clampedScale(d.offset) + (clampedScale(d.offset + d.size) - clampedScale(d.offset)) / 2)
                    .style('display', d => (clampedScale(d.offset + d.size) - clampedScale(d.offset)) > 30 ? 'block' : 'none');
                
                // Update selection overlay
                g.selectAll('.block-selection-overlay')
                    .attr('x', d => clampedScale(d.offset))
                    .attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                
                updateAxis(g, clampedScale, totalSize, regionBlocks, innerHeight, transform.k);
            });

        // Set up zoom with center-based scaling
        svg.call(zoom)
            .on('wheel.zoom', function(event) {
                event.preventDefault();
                const currentTransform = transformRefs.current[regionId] || d3.zoomIdentity;
                const pointer = d3.pointer(event, g.node());
                const k = currentTransform.k * Math.pow(2, -event.deltaY * 0.002);
                const newK = Math.max(1, Math.min(50, k));
                
                // Calculate new transform centered on mouse position
                const currentXScale = currentTransform.rescaleX(xScale);
                const mouseX = pointer[0];
                const dataX = currentXScale.invert(mouseX);
                
                const newXScale = d3.scaleLinear()
                    .domain([0, totalSize])
                    .range([0, innerWidth * newK]);
                
                let tx = mouseX - newXScale(dataX);
                
                // Clamp translation
                const maxTx = 0;
                const minTx = innerWidth - innerWidth * newK;
                tx = Math.max(minTx, Math.min(maxTx, tx));
                
                const newTransform = d3.zoomIdentity.translate(tx, 0).scale(newK);
                svg.call(zoom.transform, newTransform);
            });
        
        zoomRefs.current[regionId] = zoom;

        if (currentTransform && !isInitialDraw) {
            svg.call(zoom.transform, currentTransform);
        } else {
            transformRefs.current[regionId] = d3.zoomIdentity;
            lastZoomLevelRef.current[regionId] = 1;
        }

        const regionColor = REGION_COLORS[regionId] || REGION_COLORS[0];
        g.append('rect')
            .attr('class', 'heap-boundary')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', regionColor.bg)
            .attr('stroke', regionColor.border)
            .attr('stroke-width', 2);

        const currentXScale = (currentTransform && !isInitialDraw) ? currentTransform.rescaleX(xScale) : xScale;
        const currentZoomLevel = (currentTransform && !isInitialDraw) ? currentTransform.k : 1;

        if (regionBlocks.length > 0) {
            const blockGroup = g.append('g')
                .attr('clip-path', `url(#clip-region-${regionId})`);

            const sortedBlocks = [...regionBlocks].sort((a, b) => a.offset - b.offset);

            const blockGroups = blockGroup.selectAll('.block')
                .data(sortedBlocks)
                .enter()
                .append('g')
                .attr('class', 'block');

            blockGroups.append('rect')
                .attr('class', 'block-rect')
                .attr('x', d => currentXScale(d.offset))
                .attr('y', 0)
                .attr('width', d => Math.max(1, currentXScale(d.offset + d.size) - currentXScale(d.offset)))
                .attr('height', innerHeight)
                .attr('fill', d => BLOCK_STATES[d.state]?.color || '#999')
                .attr('opacity', d => d.state === 0 ? 0.5 : 1.0)
                .attr('stroke', 'rgba(255,255,255,0.3)')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseenter', function(event, d) {
                    showHoverTooltip(event, d);
                    if (!(selectedBlock && selectedBlock.offset === d.offset && selectedBlock.regionId === d.regionId)) {
                        d3.select(this)
                            .attr('stroke', '#000')
                            .attr('stroke-width', 2);
                    }
                })
                .on('mousemove', function(event) {
                    if (hoverTooltipRef.current) {
                        hoverTooltipRef.current
                            .style('left', (event.pageX + 15) + 'px')
                            .style('top', (event.pageY - 15) + 'px');
                    }
                })
                .on('mouseleave', function(event, d) {
                    hideHoverTooltip();
                    if (!(selectedBlock && selectedBlock.offset === d.offset && selectedBlock.regionId === d.regionId)) {
                        d3.select(this)
                            .attr('stroke', 'rgba(255,255,255,0.3)')
                            .attr('stroke-width', 1);
                    }
                })
                .on('click', function(event, d) {
                    event.stopPropagation();
                    onBlockClick(d);
                    showPersistentTooltip(event, d);
                });

            // Selection overlay
            if (selectedBlock) {
                const selectedBlockData = sortedBlocks.find(b => 
                    b.offset === selectedBlock.offset && b.regionId === selectedBlock.regionId
                );
                if (selectedBlockData) {
                    blockGroup.append('rect')
                        .datum(selectedBlockData)
                        .attr('class', 'block-selection-overlay')
                        .attr('x', currentXScale(selectedBlockData.offset))
                        .attr('y', 0)
                        .attr('width', Math.max(1, currentXScale(selectedBlockData.offset + selectedBlockData.size) - currentXScale(selectedBlockData.offset)))
                        .attr('height', innerHeight)
                        .attr('fill', 'none')
                        .attr('stroke', '#000')
                        .attr('stroke-width', 3)
                        .style('pointer-events', 'none');
                }
            }

            blockGroups.append('text')
                .attr('class', 'block-text')
                .attr('x', d => currentXScale(d.offset) + (currentXScale(d.offset + d.size) - currentXScale(d.offset)) / 2)
                .attr('y', innerHeight / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .attr('fill', 'white')
                .attr('font-size', '11px')
                .attr('font-weight', 'bold')
                .style('pointer-events', 'none')
                .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
                .style('display', d => (currentXScale(d.offset + d.size) - currentXScale(d.offset)) > 30 ? 'block' : 'none')
                .text(d => {
                    if (d.state === 1 && d.allocationId > 0) return `#${d.allocationId}`;
                    if (d.state === 0 && d.size > 500) return 'FREE';
                    if (d.state === 2) return 'FREED';
                    return '';
                });
        }

        updateAxis(g, currentXScale, totalSize, regionBlocks, innerHeight, currentZoomLevel);

        svg.on('click', () => {
            onBlockClick(null);
            hideHoverTooltip();
        });
    };

    const updateAxis = (g, xScale, totalSize, blocks, innerHeight, zoomLevel) => {
        g.select('.x-axis').remove();
        g.select('.allocation-markers').remove();
        
        const tickInterval = Math.max(1024, totalSize / 8);
        const regularTicks = d3.range(0, totalSize + 1, tickInterval);
        const mainTicks = [...new Set([0, ...regularTicks, totalSize])].sort((a, b) => a - b);
        
        const xAxis = d3.axisBottom(xScale)
            .tickValues(mainTicks)
            .tickFormat(d => `0x${Math.round(d).toString(16).padStart(4, '0')}`);

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerHeight + 5})`)
            .call(xAxis)
            .selectAll('text')
            .style('fill', '#000')
            .style('font-size', '9px');

        const mainTickSet = new Set(mainTicks.map(t => Math.round(t)));

        // Use same threshold for markers and labels (zoomLevel > 4)
        const markerThreshold = 4;
        
        if (zoomLevel > markerThreshold) {
            const markerGroup = g.append('g').attr('class', 'allocation-markers');
            const allocatedBlocks = blocks.filter(b => b.state === 1);
            const startAddresses = new Set(allocatedBlocks.map(b => b.offset));
            
            allocatedBlocks.forEach(block => {
                const startX = xScale(block.offset);
                const endX = xScale(block.offset + block.size);
                const width = endX - startX;
                const endAddress = block.offset + block.size;
                
                if (width > 40) {
                    const startOverlapsMainTick = mainTickSet.has(block.offset);
                    const showStart = !startOverlapsMainTick;
                    const endIsStartOfAnother = startAddresses.has(endAddress);
                    const showEnd = !endIsStartOfAnother;
                    
                    if (showStart && startX >= 0) {
                        markerGroup.append('line')
                            .attr('x1', startX).attr('x2', startX)
                            .attr('y1', innerHeight + 5).attr('y2', innerHeight + 12)
                            .attr('stroke', '#000').attr('stroke-width', 1.5);
                        
                        if (width > 60) {
                            markerGroup.append('text')
                                .attr('x', startX).attr('y', innerHeight + 24)
                                .attr('text-anchor', 'middle')
                                .attr('font-size', '8px').attr('fill', '#000')
                                .text(`0x${block.offset.toString(16).padStart(4, '0')}`);
                        }
                    }
                    
                    if (showEnd) {
                        markerGroup.append('line')
                            .attr('x1', endX).attr('x2', endX)
                            .attr('y1', innerHeight + 5).attr('y2', innerHeight + 12)
                            .attr('stroke', '#000').attr('stroke-width', 1.5);
                        
                        if (width > 60) {
                            markerGroup.append('text')
                                .attr('x', endX).attr('y', innerHeight + 24)
                                .attr('text-anchor', 'middle')
                                .attr('font-size', '8px').attr('fill', '#000')
                                .text(`0x${endAddress.toString(16).padStart(4, '0')}`);
                        }
                    }
                }
            });
        }
    };

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {regionIds.map((regionId, idx) => {
                const regionColor = REGION_COLORS[regionId] || REGION_COLORS[0];
                return (
                    <Box key={regionId} mb={idx < regionIds.length - 1 ? 1 : 0} sx={{ flexShrink: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: regionColor.border, mb: 0.25, display: 'block' }}>
                            Region {regionId}: {regionNames[regionId]}
                        </Typography>
                        <svg
                            ref={el => svgRefs.current[regionId] = el}
                            width={dimensions.width}
                            height={regionHeight}
                            style={{ border: `2px solid ${regionColor.border}`, borderRadius: '4px', display: 'block', background: regionColor.bg }}
                        />
                    </Box>
                );
            })}
        </Box>
    );
};

const SingleHeapLayout = ({ blocks, totalSize, heapOffset, dimensions, selectedBlock, onBlockClick, tooltipRef, hoverTooltipRef, resetZoom, onFreeBlock, formatBytes }) => {
    const svgRef = useRef();
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);
    const lastZoomLevelRef = useRef(1);

    useEffect(() => {
        if (resetZoom && zoomRef.current) {
            const svg = d3.select(svgRef.current);
            transformRef.current = d3.zoomIdentity;
            lastZoomLevelRef.current = 1;
            svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
        }
    }, [resetZoom]);

    const hideHoverTooltip = () => {
        if (hoverTooltipRef.current) {
            hoverTooltipRef.current.remove();
            hoverTooltipRef.current = null;
        }
    };

    const showHoverTooltip = (event, block) => {
        if (selectedBlock && selectedBlock.offset === block.offset) return;

        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');

        hoverTooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip-hover')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '10px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '9999')
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
            .style('opacity', 0);

        hoverTooltipRef.current.html(`
            <div>
                <div><strong>ID:</strong> ${idText}</div>
                <div><strong>State:</strong> ${stateName}</div>
                <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
                <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
            </div>
        `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px')
            .transition().duration(150).style('opacity', 1);
    };

    const showPersistentTooltip = (event, block) => {
        if (tooltipRef.current) tooltipRef.current.remove();
        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');

        tooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.95)')
            .style('color', 'white')
            .style('padding', '12px')
            .style('border-radius', '8px')
            .style('font-size', '13px')
            .style('pointer-events', 'auto')
            .style('z-index', '10000')
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
            .style('opacity', 0);

        tooltipRef.current.html(`
            <div style="margin-bottom: 8px;">
                <div><strong>ID:</strong> ${idText}</div>
                <div><strong>State:</strong> ${stateName}</div>
                <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
                <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
                <div><strong>End:</strong> 0x${(block.offset + block.size).toString(16).padStart(4, '0')}</div>
                ${block.requestedSize ? `<div><strong>Requested:</strong> ${formatBytes(block.requestedSize)}</div>` : ''}
                ${block.timestamp ? `<div style="color: #9ca3af; font-size: 11px; margin-top: 4px;">Timestamp: ${block.timestamp}</div>` : ''}
            </div>
            ${block.state === 1 ? '<div id="tooltip-free-btn" style="margin-top: 8px; padding: 6px 12px; background: #ef4444; border-radius: 4px; text-align: center; cursor: pointer; font-weight: bold; user-select: none;">Free Block</div>' : ''}
        `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 15) + 'px')
            .transition().duration(200).style('opacity', 1);

        if (block.state === 1) {
            tooltipRef.current.select('#tooltip-free-btn')
                .on('click', (e) => {
                    e.stopPropagation();
                    if (onFreeBlock) onFreeBlock(block);
                    if (tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; }
                    onBlockClick(null);
                })
                .on('mouseover', function() { d3.select(this).style('background', '#dc2626'); })
                .on('mouseout', function() { d3.select(this).style('background', '#ef4444'); });
        }
    };

    const updateAxis = (g, xScale, totalSize, blocks, innerHeight, zoomLevel) => {
        g.select('.x-axis').remove();
        g.select('.allocation-markers').remove();
        
        const tickInterval = Math.max(4096, totalSize / 8);
        const regularTicks = d3.range(0, totalSize + 1, tickInterval);
        const mainTicks = [...new Set([0, ...regularTicks, totalSize])].sort((a, b) => a - b);

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerHeight + 5})`)
            .call(d3.axisBottom(xScale).tickValues(mainTicks).tickFormat(d => `0x${Math.round(d).toString(16).padStart(4, '0')}`))
            .selectAll('text').style('fill', '#000').style('font-size', '9px');

        const mainTickSet = new Set(mainTicks.map(t => Math.round(t)));
        const markerThreshold = 4;

        if (zoomLevel > markerThreshold) {
            const markerGroup = g.append('g').attr('class', 'allocation-markers');
            const allocatedBlocks = blocks.filter(b => b.state === 1);
            const startAddresses = new Set(allocatedBlocks.map(b => b.offset));
            
            allocatedBlocks.forEach(block => {
                const startX = xScale(block.offset);
                const endX = xScale(block.offset + block.size);
                const width = endX - startX;
                const endAddress = block.offset + block.size;
                
                if (width > 40) {
                    const showStart = !mainTickSet.has(block.offset);
                    const showEnd = !startAddresses.has(endAddress);
                    
                    if (showStart && startX >= 0) {
                        markerGroup.append('line').attr('x1', startX).attr('x2', startX).attr('y1', innerHeight + 5).attr('y2', innerHeight + 12).attr('stroke', '#000').attr('stroke-width', 1.5);
                        if (width > 60) markerGroup.append('text').attr('x', startX).attr('y', innerHeight + 24).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#000').text(`0x${block.offset.toString(16).padStart(4, '0')}`);
                    }
                    if (showEnd) {
                        markerGroup.append('line').attr('x1', endX).attr('x2', endX).attr('y1', innerHeight + 5).attr('y2', innerHeight + 12).attr('stroke', '#000').attr('stroke-width', 1.5);
                        if (width > 60) markerGroup.append('text').attr('x', endX).attr('y', innerHeight + 24).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#000').text(`0x${endAddress.toString(16).padStart(4, '0')}`);
                    }
                }
            });
        }
    };

    useEffect(() => {
        if (!totalSize) return;

        const svg = d3.select(svgRef.current);
        const currentTransform = transformRef.current;
        const isInitialDraw = !currentTransform || currentTransform.k === 1;
        
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const margin = { top: 15, right: 20, bottom: 50, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const xScale = d3.scaleLinear().domain([0, totalSize]).range([0, innerWidth]);

        svg.append('defs').append('clipPath').attr('id', 'clip-main')
            .append('rect').attr('x', 0).attr('y', 0).attr('width', innerWidth).attr('height', innerHeight);

        const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        const zoom = d3.zoom()
            .scaleExtent([1, 50])
            .on('zoom', (event) => {
                const { transform } = event;
                
                if (Math.abs(transform.k - lastZoomLevelRef.current) > 0.01) {
                    console.log(`Heap zoom: ${transform.k.toFixed(2)}`);
                    lastZoomLevelRef.current = transform.k;
                }
                
                transformRef.current = transform;
                const newXScale = transform.rescaleX(xScale);
                
                let [d0, d1] = newXScale.domain();
                if (d0 < 0) { const s = -d0; d0 = 0; d1 += s; }
                if (d1 > totalSize) { const s = d1 - totalSize; d1 = totalSize; d0 = Math.max(0, d0 - s); }
                
                const clampedScale = d3.scaleLinear().domain([d0, d1]).range([0, innerWidth]);
                
                g.selectAll('.block-rect')
                    .attr('x', d => clampedScale(d.offset))
                    .attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                
                g.selectAll('.block-text')
                    .attr('x', d => clampedScale(d.offset) + (clampedScale(d.offset + d.size) - clampedScale(d.offset)) / 2)
                    .style('display', d => (clampedScale(d.offset + d.size) - clampedScale(d.offset)) > 30 ? 'block' : 'none');
                
                g.selectAll('.block-selection-overlay')
                    .attr('x', d => clampedScale(d.offset))
                    .attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                
                updateAxis(g, clampedScale, totalSize, blocks, innerHeight, transform.k);
            });

        svg.call(zoom)
            .on('wheel.zoom', function(event) {
                event.preventDefault();
                const ct = transformRef.current || d3.zoomIdentity;
                const pointer = d3.pointer(event, g.node());
                const k = ct.k * Math.pow(2, -event.deltaY * 0.002);
                const newK = Math.max(1, Math.min(50, k));
                
                const currentXScale = ct.rescaleX(xScale);
                const mouseX = pointer[0];
                const dataX = currentXScale.invert(mouseX);
                
                const newXScale = d3.scaleLinear().domain([0, totalSize]).range([0, innerWidth * newK]);
                let tx = mouseX - newXScale(dataX);
                tx = Math.max(innerWidth - innerWidth * newK, Math.min(0, tx));
                
                svg.call(zoom.transform, d3.zoomIdentity.translate(tx, 0).scale(newK));
            });
        
        zoomRef.current = zoom;

        if (currentTransform && !isInitialDraw) {
            svg.call(zoom.transform, currentTransform);
        } else {
            transformRef.current = d3.zoomIdentity;
            lastZoomLevelRef.current = 1;
        }

        g.append('rect').attr('class', 'heap-boundary')
            .attr('x', 0).attr('y', 0).attr('width', innerWidth).attr('height', innerHeight)
            .attr('fill', 'none').attr('stroke', '#333').attr('stroke-width', 2);

        const currentXScale = (currentTransform && !isInitialDraw) ? currentTransform.rescaleX(xScale) : xScale;
        const currentZoomLevel = (currentTransform && !isInitialDraw) ? currentTransform.k : 1;

        if (blocks && blocks.length > 0) {
            const blockGroup = g.append('g').attr('clip-path', 'url(#clip-main)');
            const sortedBlocks = [...blocks].sort((a, b) => a.offset - b.offset);

            const blockGroups = blockGroup.selectAll('.block').data(sortedBlocks).enter().append('g').attr('class', 'block');

            blockGroups.append('rect')
                .attr('class', 'block-rect')
                .attr('x', d => currentXScale(d.offset))
                .attr('y', 0)
                .attr('width', d => Math.max(1, currentXScale(d.offset + d.size) - currentXScale(d.offset)))
                .attr('height', innerHeight)
                .attr('fill', d => BLOCK_STATES[d.state]?.color || '#999')
                .attr('opacity', d => d.state === 0 ? 0.5 : 1.0)
                .attr('stroke', 'rgba(255,255,255,0.3)')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseenter', function(event, d) {
                    showHoverTooltip(event, d);
                    if (!(selectedBlock && selectedBlock.offset === d.offset)) {
                        d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);
                    }
                })
                .on('mousemove', function(event) {
                    if (hoverTooltipRef.current) {
                        hoverTooltipRef.current.style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px');
                    }
                })
                .on('mouseleave', function(event, d) {
                    hideHoverTooltip();
                    if (!(selectedBlock && selectedBlock.offset === d.offset)) {
                        d3.select(this).attr('stroke', 'rgba(255,255,255,0.3)').attr('stroke-width', 1);
                    }
                })
                .on('click', function(event, d) {
                    event.stopPropagation();
                    onBlockClick(d);
                    showPersistentTooltip(event, d);
                });

            if (selectedBlock) {
                const sbd = sortedBlocks.find(b => b.offset === selectedBlock.offset);
                if (sbd) {
                    blockGroup.append('rect')
                        .datum(sbd)
                        .attr('class', 'block-selection-overlay')
                        .attr('x', currentXScale(sbd.offset))
                        .attr('y', 0)
                        .attr('width', Math.max(1, currentXScale(sbd.offset + sbd.size) - currentXScale(sbd.offset)))
                        .attr('height', innerHeight)
                        .attr('fill', 'none')
                        .attr('stroke', '#000')
                        .attr('stroke-width', 3)
                        .style('pointer-events', 'none');
                }
            }

            blockGroups.append('text')
                .attr('class', 'block-text')
                .attr('x', d => currentXScale(d.offset) + (currentXScale(d.offset + d.size) - currentXScale(d.offset)) / 2)
                .attr('y', innerHeight / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .attr('fill', 'white')
                .attr('font-size', '11px')
                .attr('font-weight', 'bold')
                .style('pointer-events', 'none')
                .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
                .style('display', d => (currentXScale(d.offset + d.size) - currentXScale(d.offset)) > 30 ? 'block' : 'none')
                .text(d => {
                    if (d.state === 1 && d.allocationId > 0) return `#${d.allocationId}`;
                    if (d.state === 0 && d.size > 1000) return 'FREE';
                    if (d.state === 2) return 'FREED';
                    return '';
                });
        }

        updateAxis(g, currentXScale, totalSize, blocks, innerHeight, currentZoomLevel);
        svg.on('click', () => { onBlockClick(null); hideHoverTooltip(); });

    }, [blocks, totalSize, dimensions, selectedBlock, onBlockClick]);

    return (
        <Box sx={{ flex: 1, minHeight: 0 }}>
            <svg ref={svgRef} width={dimensions.width} height={dimensions.height}
                style={{ border: '1px solid #ccc', borderRadius: '4px', display: 'block' }} />
        </Box>
    );
};

export default MemoryLayout;
