import React, { useEffect, useRef, useState } from 'react';
import { 
    Box, 
    Typography, 
    Chip, 
    IconButton, 
    Tooltip
} from '@mui/material';
import { Info } from '@mui/icons-material';
import * as d3 from 'd3';
import { EmbeddedControls } from './Controls';

const BLOCK_STATES = {
    0: { name: 'Free', color: '#4CAF50', label: 'Free Memory' },
    1: { name: 'Allocated', color: '#f44336', label: 'Allocated Block' },
    2: { name: 'Freed', color: '#FF9800', label: 'Freed Block' }
};

// Region colors using a distinct purple/magenta/cyan theme to avoid conflict with block state colors
const REGION_COLORS = {
    0: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', name: 'FAST', description: 'High-speed cache-friendly memory for frequently accessed data' },
    1: { border: '#d946ef', bg: 'rgba(217,70,239,0.08)', name: 'DMA', description: 'DMA-capable memory for hardware buffer transfers' },
    2: { border: '#06b6d4', bg: 'rgba(6,182,212,0.08)', name: 'UNCACHED', description: 'Uncached memory for bulk data storage' },
    // Reserved for future region additions
    3: { border: '#f97316', bg: 'rgba(249,115,22,0.08)', name: 'REGION3', description: 'Reserved region 3' },
    4: { border: '#14b8a6', bg: 'rgba(20,184,166,0.08)', name: 'REGION4', description: 'Reserved region 4' },
    5: { border: '#a855f7', bg: 'rgba(168,85,247,0.08)', name: 'REGION5', description: 'Reserved region 5' }
};

const MemoryLayout = ({ 
    blocks, 
    totalSize, 
    heapOffset, 
    activeBlock, 
    onBlockClick, 
    resetZoom, 
    onFreeBlock,
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

    // Use currentHeap prop to determine if it's heap 5, not block data
    const isHeap5 = currentHeap === 5;
    
    const blocksByRegion = isHeap5 ? blocks.reduce((acc, block) => {
        const regionId = block.regionId !== undefined ? block.regionId : 0;
        if (!acc[regionId]) acc[regionId] = [];
        acc[regionId].push(block);
        return acc;
    }, {}) : { 0: blocks };

    // For heap 5, always show all 3 regions
    const regionIds = isHeap5 ? [0, 1, 2] : [0];

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const { clientWidth } = containerRef.current;
                const height = isHeap5 ? 520 : 260;
                setDim({ width: clientWidth - 40, height: height });
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [isHeap5]);

    useEffect(() => {
        return () => {
            if (tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; }
            if (hoverTooltipRef.current) { hoverTooltipRef.current.remove(); hoverTooltipRef.current = null; }
        };
    }, []);

    useEffect(() => {
        if (!selectedBlock && tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; }
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
                if (tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; }
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
        ? `Each region shown separately. Mouse wheel to zoom, drag to pan. Click blocks to select.`
        : `Mouse wheel to zoom, drag to pan. Click blocks to select.`;

    return (
        <Box ref={containerRef} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header Row with Title and Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography variant="h6" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Memory Layout</Typography>
                    <Tooltip title={instructionText} placement="top" arrow>
                        <IconButton size="small" sx={{ color: 'text.secondary', p: 0.25 }}>
                            <Info sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
                
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
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            <Box display="flex" gap={0.75} mt={1} pt={1} borderTop="1px solid rgba(0,0,0,0.1)" flexWrap="wrap" justifyContent="center" alignItems="center">
                {Object.values(BLOCK_STATES).map(state => (
                    <Chip key={state.name} label={state.label} sx={{ backgroundColor: state.color, color: 'white', opacity: state.name === 'Free' ? 0.7 : 1, '& .MuiChip-label': { fontWeight: 'bold', fontSize: '0.7rem' } }} size="small" />
                ))}
                {isHeap5 && (
                    <>
                        <Box sx={{ width: '1px', height: '18px', bgcolor: 'rgba(0,0,0,0.2)', mx: 0.5 }} />
                        {regionIds.map((id) => {
                            const region = REGION_COLORS[id];
                            return (
                                <Tooltip key={id} title={region.description} placement="top" arrow>
                                    <Chip label={region.name} size="small" sx={{ borderColor: region.border, backgroundColor: region.bg, color: region.border, fontWeight: 'bold', cursor: 'help', fontSize: '0.65rem', '&:hover': { backgroundColor: `${region.border}22` } }} variant="outlined" icon={<Info sx={{ fontSize: '10px !important', color: `${region.border} !important`, ml: 0.5 }} />} />
                                </Tooltip>
                            );
                        })}
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
    const lastDimensionsRef = useRef({});

    const regionNames = ['FAST', 'DMA', 'UNCACHED'];
    const totalRegionHeight = dimensions.height - 30;
    const regionHeight = Math.floor((totalRegionHeight - 16) / 3);
    const borderWidth = 2;

    useEffect(() => {
        if (resetZoom) {
            regionIds.forEach(regionId => {
                if (zoomRefs.current[regionId]) {
                    const svg = d3.select(svgRefs.current[regionId]);
                    transformRefs.current[regionId] = d3.zoomIdentity;
                    lastZoomLevelRef.current[regionId] = 1;
                    svg.transition().duration(300).call(zoomRefs.current[regionId].transform, d3.zoomIdentity);
                }
            });
        }
    }, [resetZoom, regionIds]);

    useEffect(() => {
        regionIds.forEach(regionId => drawRegionLayout(regionId));
    }, [blocksByRegion, dimensions, regionIds, selectedBlock]);

    const hideHoverTooltip = () => { if (hoverTooltipRef.current) { hoverTooltipRef.current.remove(); hoverTooltipRef.current = null; } };

    const showHoverTooltip = (event, block) => {
        if (selectedBlock && selectedBlock.offset === block.offset && selectedBlock.regionId === block.regionId) return;
        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');
        const regionName = regionNames[block.regionId] || `Region ${block.regionId}`;

        hoverTooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip-hover')
            .style('position', 'absolute').style('background', 'rgba(0,0,0,0.9)').style('color', 'white')
            .style('padding', '10px').style('border-radius', '6px').style('font-size', '12px')
            .style('pointer-events', 'none').style('z-index', '9999').style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)').style('opacity', 0);

        hoverTooltipRef.current.html(`
            <div style="font-weight:bold;margin-bottom:4px;color:#60a5fa;">Region: ${regionName}</div>
            <div><strong>ID:</strong> ${idText}</div>
            <div><strong>State:</strong> ${stateName}</div>
            <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
            <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
            ${block.timestamp ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px;">Timestamp: ${block.timestamp}</div>` : ''}
        `).style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px').transition().duration(150).style('opacity', 1);
    };

    const showPersistentTooltip = (event, block) => {
        if (tooltipRef.current) tooltipRef.current.remove();
        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');
        const regionName = regionNames[block.regionId] || `Region ${block.regionId}`;

        tooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip')
            .style('position', 'absolute').style('background', 'rgba(0,0,0,0.95)').style('color', 'white')
            .style('padding', '12px').style('border-radius', '8px').style('font-size', '13px')
            .style('pointer-events', 'auto').style('z-index', '10000').style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)').style('opacity', 0);

        tooltipRef.current.html(`
            <div style="margin-bottom:8px;">
                <div style="font-weight:bold;margin-bottom:6px;color:#60a5fa;">Region: ${regionName}</div>
                <div><strong>ID:</strong> ${idText}</div>
                <div><strong>State:</strong> ${stateName}</div>
                <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
                <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
                <div><strong>End:</strong> 0x${(block.offset + block.size).toString(16).padStart(4, '0')}</div>
                ${block.requestedSize ? `<div><strong>Requested:</strong> ${formatBytes(block.requestedSize)}</div>` : ''}
                ${block.timestamp ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px;">Timestamp: ${block.timestamp}</div>` : ''}
            </div>
            ${block.state === 1 ? '<div id="tooltip-free-btn" style="margin-top:8px;padding:6px 12px;background:#ef4444;border-radius:4px;text-align:center;cursor:pointer;font-weight:bold;user-select:none;">Free Block</div>' : ''}
        `).style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px').transition().duration(200).style('opacity', 1);

        if (block.state === 1) {
            tooltipRef.current.select('#tooltip-free-btn')
                .on('click', (e) => { e.stopPropagation(); if (onFreeBlock) onFreeBlock(block); if (tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; } onBlockClick(null); })
                .on('mouseover', function() { d3.select(this).style('background', '#dc2626'); })
                .on('mouseout', function() { d3.select(this).style('background', '#ef4444'); });
        }
    };

    const drawRegionLayout = (regionId) => {
        let regionBlocks = blocksByRegion[regionId] || [];
        const svg = d3.select(svgRefs.current[regionId]);
        const currentTransform = transformRefs.current[regionId];
        
        svg.selectAll('*').remove();

        const { width } = dimensions;
        const margin = { top: 12, right: 15, bottom: 40, left: 45 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = regionHeight - margin.top - margin.bottom;

        // Default region sizes for heap 5 when no blocks are present
        const defaultRegionSizes = { 0: 20480, 1: 28672, 2: 32768 };
        const defaultSize = defaultRegionSizes[regionId] || 10240;

        // Calculate totalSize for this region
        const totalSize = regionBlocks.length > 0 ? Math.max(...regionBlocks.map(b => b.offset + b.size)) : defaultSize;

        // If no blocks exist, create a synthetic free block to show the region is initialized
        if (regionBlocks.length === 0) {
            regionBlocks = [{
                offset: 0,
                size: totalSize,
                state: 0, // Free
                allocationId: 0,
                timestamp: 0,
                regionId: regionId
            }];
        }

        const xScale = d3.scaleLinear().domain([0, totalSize]).range([0, innerWidth]);

        // Clip path for blocks - exactly matches the inner area
        svg.append('defs').append('clipPath').attr('id', `clip-region-${regionId}`)
            .append('rect').attr('x', 0).attr('y', 0).attr('width', innerWidth).attr('height', innerHeight);

        const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Check if we need to reset zoom due to dimension change
        // If dimensions changed significantly, reset the transform to avoid offset issues
        const prevWidth = lastDimensionsRef.current[regionId]?.width;
        const dimensionsChanged = prevWidth && Math.abs(prevWidth - width) > 1;
        lastDimensionsRef.current[regionId] = { width };
        
        if (dimensionsChanged && currentTransform && currentTransform.k > 1) {
            console.log(`Region ${regionId}: Dimensions changed (${prevWidth} -> ${width}), resetting zoom from ${currentTransform.k.toFixed(2)}`);
            transformRefs.current[regionId] = d3.zoomIdentity;
            lastZoomLevelRef.current[regionId] = 1;
        }
        
        const activeTransform = transformRefs.current[regionId];
        const isInitialDraw = !activeTransform || activeTransform.k === 1;

        // Inset for blocks from boundary
        const blockInset = borderWidth * 0.5;
        
        // Helper to get current scale (accounts for zoom transform)
        const getCurrentScale = () => {
            const t = transformRefs.current[regionId] || d3.zoomIdentity;
            const rescaled = t.rescaleX(xScale);
            let [d0, d1] = rescaled.domain();
            if (d0 < 0) { d1 -= d0; d0 = 0; }
            if (d1 > totalSize) { d0 = Math.max(0, d0 - (d1 - totalSize)); d1 = totalSize; }
            return d3.scaleLinear().domain([d0, d1]).range([0, innerWidth]);
        };
        
        const zoom = d3.zoom()
            .scaleExtent([1, 50])
            .on('zoom', (event) => {
                const { transform } = event;
                const currentZoom = transform.k;
                if (Math.abs(currentZoom - (lastZoomLevelRef.current[regionId] || 1)) > 0.01) {
                    console.log(`Region ${regionId} (${regionNames[regionId]}) zoom: ${currentZoom.toFixed(2)}`);
                    lastZoomLevelRef.current[regionId] = currentZoom;
                }
                transformRefs.current[regionId] = transform;
                
                const newXScale = transform.rescaleX(xScale);
                let [d0, d1] = newXScale.domain();
                
                // Clamp: don't let start go below 0
                if (d0 < 0) { d1 -= d0; d0 = 0; }
                // Clamp: don't let end go beyond totalSize
                if (d1 > totalSize) { d0 = Math.max(0, d0 - (d1 - totalSize)); d1 = totalSize; }
                
                const clampedScale = d3.scaleLinear().domain([d0, d1]).range([0, innerWidth]);
                
                g.selectAll('.block-rect').attr('x', d => clampedScale(d.offset)).attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                g.selectAll('.block-text').attr('x', d => clampedScale(d.offset) + (clampedScale(d.offset + d.size) - clampedScale(d.offset)) / 2).style('display', d => (clampedScale(d.offset + d.size) - clampedScale(d.offset)) > 30 ? 'block' : 'none');
                g.selectAll('.block-selection-overlay').attr('x', d => clampedScale(d.offset)).attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                g.selectAll('.hover-overlay').attr('x', d => clampedScale(d.offset)).attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                updateAxis(g, clampedScale, totalSize, regionBlocks, innerHeight, transform.k);
            });

        svg.call(zoom)
            .on('wheel.zoom', function(event) {
                event.preventDefault();
                const ct = transformRefs.current[regionId] || d3.zoomIdentity;
                const pointer = d3.pointer(event, g.node());
                const k = ct.k * Math.pow(2, -event.deltaY * 0.002);
                const newK = Math.max(1, Math.min(50, k));
                
                const currentXScale = ct.rescaleX(xScale);
                const mouseX = Math.max(0, pointer[0]);
                const dataX = currentXScale.invert(mouseX);
                
                // Ensure dataX stays >= 0 after zoom
                const clampedDataX = Math.max(0, dataX);
                
                const newRange = totalSize / newK;
                let newD0 = clampedDataX - (mouseX / innerWidth) * newRange;
                let newD1 = newD0 + newRange;
                
                // Clamp domain
                if (newD0 < 0) { newD1 -= newD0; newD0 = 0; }
                if (newD1 > totalSize) { newD0 = Math.max(0, newD0 - (newD1 - totalSize)); newD1 = totalSize; }
                
                const newScale = d3.scaleLinear().domain([newD0, newD1]).range([0, innerWidth]);
                const tx = -newScale(0) * newK;
                
                const newTransform = d3.zoomIdentity.translate(tx, 0).scale(newK);
                svg.call(zoom.transform, newTransform);
            });
        
        zoomRefs.current[regionId] = zoom;
        if (activeTransform && !isInitialDraw) svg.call(zoom.transform, activeTransform);
        else { transformRefs.current[regionId] = d3.zoomIdentity; lastZoomLevelRef.current[regionId] = 1; }

        const regionColor = REGION_COLORS[regionId] || REGION_COLORS[0];
        const currentXScale = (activeTransform && !isInitialDraw) ? activeTransform.rescaleX(xScale) : xScale;
        const currentZoomLevel = (activeTransform && !isInitialDraw) ? activeTransform.k : 1;
        
        // 1. Draw background fill first
        g.append('rect').attr('class', 'heap-background')
            .attr('x', 0).attr('y', 0)
            .attr('width', innerWidth).attr('height', innerHeight)
            .attr('fill', regionColor.bg);

        // 2. Draw blocks with inset (clipped)
        if (regionBlocks.length > 0) {
            const blockGroup = g.append('g').attr('clip-path', `url(#clip-region-${regionId})`);
            const sortedBlocks = [...regionBlocks].sort((a, b) => a.offset - b.offset);

            const blockGroups = blockGroup.selectAll('.block').data(sortedBlocks).enter().append('g').attr('class', 'block');

            blockGroups.append('rect')
                .attr('class', 'block-rect')
                .attr('x', d => currentXScale(d.offset))
                .attr('y', blockInset)
                .attr('width', d => Math.max(1, currentXScale(d.offset + d.size) - currentXScale(d.offset)))
                .attr('height', innerHeight - blockInset * 2)
                .attr('fill', d => BLOCK_STATES[d.state]?.color || '#999')
                .attr('opacity', d => d.state === 0 ? 0.5 : 1.0)
                .attr('stroke', 'rgba(255,255,255,0.3)')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseenter', function(event, d) {
                    showHoverTooltip(event, d);
                    if (!(selectedBlock && selectedBlock.offset === d.offset && selectedBlock.regionId === d.regionId)) {
                        // Show hover overlay (unclipped, drawn on top)
                        // Use getCurrentScale() to get the live scale accounting for zoom
                        g.select('.hover-overlay').remove();
                        const liveScale = getCurrentScale();
                        const x = liveScale(d.offset);
                        const w = Math.max(1, liveScale(d.offset + d.size) - liveScale(d.offset));
                        g.append('rect')
                            .datum(d) // Store data for zoom updates
                            .attr('class', 'hover-overlay')
                            .attr('x', x).attr('y', blockInset)
                            .attr('width', w).attr('height', innerHeight - blockInset * 2)
                            .attr('fill', 'none')
                            .attr('stroke', '#000')
                            .attr('stroke-width', 2)
                            .style('pointer-events', 'none');
                    }
                })
                .on('mousemove', function(event) { if (hoverTooltipRef.current) hoverTooltipRef.current.style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px'); })
                .on('mouseleave', function() {
                    hideHoverTooltip();
                    g.select('.hover-overlay').remove();
                })
                .on('click', function(event, d) { event.stopPropagation(); onBlockClick(d); showPersistentTooltip(event, d); });

            blockGroups.append('text').attr('class', 'block-text')
                .attr('x', d => currentXScale(d.offset) + (currentXScale(d.offset + d.size) - currentXScale(d.offset)) / 2)
                .attr('y', innerHeight / 2)
                .attr('dy', '0.35em').attr('text-anchor', 'middle').attr('fill', 'white').attr('font-size', '10px').attr('font-weight', 'bold')
                .style('pointer-events', 'none').style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
                .style('display', d => (currentXScale(d.offset + d.size) - currentXScale(d.offset)) > 30 ? 'block' : 'none')
                .text(d => { if (d.state === 1 && d.allocationId > 0) return `#${d.allocationId}`; if (d.state === 0 && d.size > 500) return 'FREE'; if (d.state === 2) return 'FREED'; return ''; });
        }

        // 3. Draw boundary stroke on TOP of blocks (not filled, just stroke)
        g.append('rect').attr('class', 'heap-boundary')
            .attr('x', 0).attr('y', 0)
            .attr('width', innerWidth).attr('height', innerHeight)
            .attr('fill', 'none')
            .attr('stroke', regionColor.border)
            .attr('stroke-width', borderWidth);

        // 4. Draw selection overlay (unclipped, on top of everything)
        if (selectedBlock && regionBlocks.length > 0) {
            const sbd = regionBlocks.find(b => b.offset === selectedBlock.offset && b.regionId === selectedBlock.regionId);
            if (sbd) {
                g.append('rect').attr('class', 'block-selection-overlay')
                    .datum(sbd)
                    .attr('x', currentXScale(sbd.offset))
                    .attr('y', blockInset)
                    .attr('width', Math.max(1, currentXScale(sbd.offset + sbd.size) - currentXScale(sbd.offset)))
                    .attr('height', innerHeight - blockInset * 2)
                    .attr('fill', 'none')
                    .attr('stroke', '#000')
                    .attr('stroke-width', 3)
                    .style('pointer-events', 'none');
            }
        }

        updateAxis(g, currentXScale, totalSize, regionBlocks, innerHeight, currentZoomLevel);
        svg.on('click', () => { onBlockClick(null); hideHoverTooltip(); });
    };

    const updateAxis = (g, xScale, totalSize, blocks, innerHeight, zoomLevel) => {
        g.select('.x-axis').remove();
        g.select('.allocation-markers').remove();
        
        const tickInterval = Math.max(1024, totalSize / 6);
        const regularTicks = d3.range(0, totalSize + 1, tickInterval);
        const mainTicks = [...new Set([0, ...regularTicks, totalSize])].sort((a, b) => a - b);
        
        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${innerHeight + 4})`)
            .call(d3.axisBottom(xScale).tickValues(mainTicks).tickFormat(d => `0x${Math.round(d).toString(16).padStart(4, '0')}`))
            .selectAll('text').style('fill', '#000').style('font-size', '8px');

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
                        markerGroup.append('line').attr('x1', startX).attr('x2', startX).attr('y1', innerHeight + 4).attr('y2', innerHeight + 10).attr('stroke', '#000').attr('stroke-width', 1.5);
                        if (width > 50) markerGroup.append('text').attr('x', startX).attr('y', innerHeight + 20).attr('text-anchor', 'middle').attr('font-size', '7px').attr('fill', '#000').text(`0x${block.offset.toString(16).padStart(4, '0')}`);
                    }
                    if (showEnd) {
                        markerGroup.append('line').attr('x1', endX).attr('x2', endX).attr('y1', innerHeight + 4).attr('y2', innerHeight + 10).attr('stroke', '#000').attr('stroke-width', 1.5);
                        if (width > 50) markerGroup.append('text').attr('x', endX).attr('y', innerHeight + 20).attr('text-anchor', 'middle').attr('font-size', '7px').attr('fill', '#000').text(`0x${endAddress.toString(16).padStart(4, '0')}`);
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
                    <Box key={regionId} mb={idx < regionIds.length - 1 ? 0.75 : 0} sx={{ flexShrink: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: regionColor.border, mb: 0.25, display: 'block', fontSize: '0.7rem' }}>
                            Region {regionId}: {regionNames[regionId]}
                        </Typography>
                        <svg ref={el => svgRefs.current[regionId] = el} width={dimensions.width} height={regionHeight}
                            style={{ border: `${borderWidth}px solid ${regionColor.border}`, borderRadius: '4px', display: 'block', background: regionColor.bg }} />
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
    const lastDimensionsRef = useRef({ width: 0 });
    const borderWidth = 2;

    useEffect(() => {
        if (resetZoom && zoomRef.current) {
            const svg = d3.select(svgRef.current);
            transformRef.current = d3.zoomIdentity;
            lastZoomLevelRef.current = 1;
            svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
        }
    }, [resetZoom]);

    const hideHoverTooltip = () => { if (hoverTooltipRef.current) { hoverTooltipRef.current.remove(); hoverTooltipRef.current = null; } };

    const showHoverTooltip = (event, block) => {
        if (selectedBlock && selectedBlock.offset === block.offset) return;
        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');

        hoverTooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip-hover')
            .style('position', 'absolute').style('background', 'rgba(0,0,0,0.9)').style('color', 'white')
            .style('padding', '10px').style('border-radius', '6px').style('font-size', '12px')
            .style('pointer-events', 'none').style('z-index', '9999').style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)').style('opacity', 0);

        hoverTooltipRef.current.html(`
            <div><strong>ID:</strong> ${idText}</div>
            <div><strong>State:</strong> ${stateName}</div>
            <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
            <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
            ${block.timestamp ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px;">Timestamp: ${block.timestamp}</div>` : ''}
        `).style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px').transition().duration(150).style('opacity', 1);
    };

    const showPersistentTooltip = (event, block) => {
        if (tooltipRef.current) tooltipRef.current.remove();
        hideHoverTooltip();

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : (block.state === 0 ? 'Free Block' : 'Freed Block');

        tooltipRef.current = d3.select('body').append('div')
            .attr('class', 'memory-tooltip')
            .style('position', 'absolute').style('background', 'rgba(0,0,0,0.95)').style('color', 'white')
            .style('padding', '12px').style('border-radius', '8px').style('font-size', '13px')
            .style('pointer-events', 'auto').style('z-index', '10000').style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)').style('opacity', 0);

        tooltipRef.current.html(`
            <div style="margin-bottom:8px;">
                <div><strong>ID:</strong> ${idText}</div>
                <div><strong>State:</strong> ${stateName}</div>
                <div><strong>Size:</strong> ${formatBytes(block.size)}</div>
                <div><strong>Offset:</strong> 0x${block.offset.toString(16).padStart(4, '0')}</div>
                <div><strong>End:</strong> 0x${(block.offset + block.size).toString(16).padStart(4, '0')}</div>
                ${block.requestedSize ? `<div><strong>Requested:</strong> ${formatBytes(block.requestedSize)}</div>` : ''}
                ${block.timestamp ? `<div style="color:#9ca3af;font-size:11px;margin-top:4px;">Timestamp: ${block.timestamp}</div>` : ''}
            </div>
            ${block.state === 1 ? '<div id="tooltip-free-btn" style="margin-top:8px;padding:6px 12px;background:#ef4444;border-radius:4px;text-align:center;cursor:pointer;font-weight:bold;user-select:none;">Free Block</div>' : ''}
        `).style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px').transition().duration(200).style('opacity', 1);

        if (block.state === 1) {
            tooltipRef.current.select('#tooltip-free-btn')
                .on('click', (e) => { e.stopPropagation(); if (onFreeBlock) onFreeBlock(block); if (tooltipRef.current) { tooltipRef.current.remove(); tooltipRef.current = null; } onBlockClick(null); })
                .on('mouseover', function() { d3.select(this).style('background', '#dc2626'); })
                .on('mouseout', function() { d3.select(this).style('background', '#ef4444'); });
        }
    };

    const updateAxis = (g, xScale, totalSize, blocks, innerHeight, zoomLevel) => {
        g.select('.x-axis').remove();
        g.select('.allocation-markers').remove();
        
        const tickInterval = Math.max(4096, totalSize / 6);
        const regularTicks = d3.range(0, totalSize + 1, tickInterval);
        const mainTicks = [...new Set([0, ...regularTicks, totalSize])].sort((a, b) => a - b);

        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${innerHeight + 4})`)
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
                        markerGroup.append('line').attr('x1', startX).attr('x2', startX).attr('y1', innerHeight + 4).attr('y2', innerHeight + 10).attr('stroke', '#000').attr('stroke-width', 1.5);
                        if (width > 50) markerGroup.append('text').attr('x', startX).attr('y', innerHeight + 20).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#000').text(`0x${block.offset.toString(16).padStart(4, '0')}`);
                    }
                    if (showEnd) {
                        markerGroup.append('line').attr('x1', endX).attr('x2', endX).attr('y1', innerHeight + 4).attr('y2', innerHeight + 10).attr('stroke', '#000').attr('stroke-width', 1.5);
                        if (width > 50) markerGroup.append('text').attr('x', endX).attr('y', innerHeight + 20).attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', '#000').text(`0x${endAddress.toString(16).padStart(4, '0')}`);
                    }
                }
            });
        }
    };

    useEffect(() => {
        if (!totalSize) return;

        const svg = d3.select(svgRef.current);
        const ct = transformRef.current;
        
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const margin = { top: 12, right: 15, bottom: 45, left: 45 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const xScale = d3.scaleLinear().domain([0, totalSize]).range([0, innerWidth]);

        // Check if dimensions changed significantly - reset zoom to avoid offset issues
        const prevWidth = lastDimensionsRef.current.width;
        const dimensionsChanged = prevWidth && Math.abs(prevWidth - width) > 1;
        lastDimensionsRef.current = { width };
        
        if (dimensionsChanged && ct && ct.k > 1) {
            console.log(`SingleHeap: Dimensions changed (${prevWidth} -> ${width}), resetting zoom from ${ct.k.toFixed(2)}`);
            transformRef.current = d3.zoomIdentity;
            lastZoomLevelRef.current = 1;
        }
        
        const activeTransform = transformRef.current;
        const isInitialDraw = !activeTransform || activeTransform.k === 1;

        // Clip path for blocks
        svg.append('defs').append('clipPath').attr('id', 'clip-main')
            .append('rect').attr('x', 0).attr('y', 0).attr('width', innerWidth).attr('height', innerHeight);

        const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Inset for blocks from boundary
        const blockInset = borderWidth * 0.5;
        
        // Helper to get current scale (accounts for zoom transform)
        const getCurrentScale = () => {
            const t = transformRef.current || d3.zoomIdentity;
            const rescaled = t.rescaleX(xScale);
            let [d0, d1] = rescaled.domain();
            if (d0 < 0) { d1 -= d0; d0 = 0; }
            if (d1 > totalSize) { d0 = Math.max(0, d0 - (d1 - totalSize)); d1 = totalSize; }
            return d3.scaleLinear().domain([d0, d1]).range([0, innerWidth]);
        };

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
                if (d0 < 0) { d1 -= d0; d0 = 0; }
                if (d1 > totalSize) { d0 = Math.max(0, d0 - (d1 - totalSize)); d1 = totalSize; }
                
                const clampedScale = d3.scaleLinear().domain([d0, d1]).range([0, innerWidth]);
                
                g.selectAll('.block-rect').attr('x', d => clampedScale(d.offset)).attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                g.selectAll('.block-text').attr('x', d => clampedScale(d.offset) + (clampedScale(d.offset + d.size) - clampedScale(d.offset)) / 2).style('display', d => (clampedScale(d.offset + d.size) - clampedScale(d.offset)) > 30 ? 'block' : 'none');
                g.selectAll('.block-selection-overlay').attr('x', d => clampedScale(d.offset)).attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                g.selectAll('.hover-overlay').attr('x', d => clampedScale(d.offset)).attr('width', d => Math.max(1, clampedScale(d.offset + d.size) - clampedScale(d.offset)));
                updateAxis(g, clampedScale, totalSize, blocks, innerHeight, transform.k);
            });

        svg.call(zoom)
            .on('wheel.zoom', function(event) {
                event.preventDefault();
                const ctr = transformRef.current || d3.zoomIdentity;
                const pointer = d3.pointer(event, g.node());
                const k = ctr.k * Math.pow(2, -event.deltaY * 0.002);
                const newK = Math.max(1, Math.min(50, k));
                
                const currentXScale = ctr.rescaleX(xScale);
                const mouseX = Math.max(0, pointer[0]);
                const dataX = Math.max(0, currentXScale.invert(mouseX));
                
                const newRange = totalSize / newK;
                let newD0 = dataX - (mouseX / innerWidth) * newRange;
                let newD1 = newD0 + newRange;
                
                if (newD0 < 0) { newD1 -= newD0; newD0 = 0; }
                if (newD1 > totalSize) { newD0 = Math.max(0, newD0 - (newD1 - totalSize)); newD1 = totalSize; }
                
                const newScale = d3.scaleLinear().domain([newD0, newD1]).range([0, innerWidth]);
                const tx = -newScale(0) * newK;
                
                svg.call(zoom.transform, d3.zoomIdentity.translate(tx, 0).scale(newK));
            });
        
        zoomRef.current = zoom;
        if (activeTransform && !isInitialDraw) svg.call(zoom.transform, activeTransform);
        else { transformRef.current = d3.zoomIdentity; lastZoomLevelRef.current = 1; }

        const currentXScale = (activeTransform && !isInitialDraw) ? activeTransform.rescaleX(xScale) : xScale;
        const currentZoomLevel = (activeTransform && !isInitialDraw) ? activeTransform.k : 1;

        // 1. Draw background (the area inside the boundary)
        g.append('rect').attr('class', 'heap-background')
            .attr('x', 0).attr('y', 0)
            .attr('width', innerWidth).attr('height', innerHeight)
            .attr('fill', 'rgba(245,245,245,0.5)');

        // 2. Draw blocks with inset (clipped)
        if (blocks && blocks.length > 0) {
            const blockGroup = g.append('g').attr('clip-path', 'url(#clip-main)');
            const sortedBlocks = [...blocks].sort((a, b) => a.offset - b.offset);
            const blockGroups = blockGroup.selectAll('.block').data(sortedBlocks).enter().append('g').attr('class', 'block');

            blockGroups.append('rect')
                .attr('class', 'block-rect')
                .attr('x', d => currentXScale(d.offset))
                .attr('y', blockInset)
                .attr('width', d => Math.max(1, currentXScale(d.offset + d.size) - currentXScale(d.offset)))
                .attr('height', innerHeight - blockInset * 2)
                .attr('fill', d => BLOCK_STATES[d.state]?.color || '#999')
                .attr('opacity', d => d.state === 0 ? 0.5 : 1.0)
                .attr('stroke', 'rgba(255,255,255,0.3)')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseenter', function(event, d) {
                    showHoverTooltip(event, d);
                    if (!(selectedBlock && selectedBlock.offset === d.offset)) {
                        // Show hover overlay (unclipped, drawn on top)
                        // Use getCurrentScale() to get the live scale accounting for zoom
                        g.select('.hover-overlay').remove();
                        const liveScale = getCurrentScale();
                        const x = liveScale(d.offset);
                        const w = Math.max(1, liveScale(d.offset + d.size) - liveScale(d.offset));
                        g.append('rect')
                            .datum(d) // Store data for zoom updates
                            .attr('class', 'hover-overlay')
                            .attr('x', x).attr('y', blockInset)
                            .attr('width', w).attr('height', innerHeight - blockInset * 2)
                            .attr('fill', 'none')
                            .attr('stroke', '#000')
                            .attr('stroke-width', 2)
                            .style('pointer-events', 'none');
                    }
                })
                .on('mousemove', function(event) { if (hoverTooltipRef.current) hoverTooltipRef.current.style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 15) + 'px'); })
                .on('mouseleave', function() {
                    hideHoverTooltip();
                    g.select('.hover-overlay').remove();
                })
                .on('click', function(event, d) { event.stopPropagation(); onBlockClick(d); showPersistentTooltip(event, d); });

            blockGroups.append('text').attr('class', 'block-text')
                .attr('x', d => currentXScale(d.offset) + (currentXScale(d.offset + d.size) - currentXScale(d.offset)) / 2)
                .attr('y', innerHeight / 2)
                .attr('dy', '0.35em').attr('text-anchor', 'middle').attr('fill', 'white').attr('font-size', '11px').attr('font-weight', 'bold')
                .style('pointer-events', 'none').style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
                .style('display', d => (currentXScale(d.offset + d.size) - currentXScale(d.offset)) > 30 ? 'block' : 'none')
                .text(d => { if (d.state === 1 && d.allocationId > 0) return `#${d.allocationId}`; if (d.state === 0 && d.size > 1000) return 'FREE'; if (d.state === 2) return 'FREED'; return ''; });
        }

        // 3. Draw boundary stroke on TOP of blocks
        g.append('rect').attr('class', 'heap-boundary')
            .attr('x', 0).attr('y', 0)
            .attr('width', innerWidth).attr('height', innerHeight)
            .attr('fill', 'none')
            .attr('stroke', '#333')
            .attr('stroke-width', borderWidth);

        // 4. Draw selection overlay (unclipped, on top of everything)
        if (selectedBlock && blocks && blocks.length > 0) {
            const sbd = blocks.find(b => b.offset === selectedBlock.offset);
            if (sbd) {
                g.append('rect').attr('class', 'block-selection-overlay')
                    .datum(sbd)
                    .attr('x', currentXScale(sbd.offset))
                    .attr('y', blockInset)
                    .attr('width', Math.max(1, currentXScale(sbd.offset + sbd.size) - currentXScale(sbd.offset)))
                    .attr('height', innerHeight - blockInset * 2)
                    .attr('fill', 'none')
                    .attr('stroke', '#000')
                    .attr('stroke-width', 3)
                    .style('pointer-events', 'none');
            }
        }

        updateAxis(g, currentXScale, totalSize, blocks, innerHeight, currentZoomLevel);
        svg.on('click', () => { onBlockClick(null); hideHoverTooltip(); });

    }, [blocks, totalSize, dimensions, selectedBlock, onBlockClick]);

    return (
        <Box sx={{ flex: 1, minHeight: 0 }}>
            <svg ref={svgRef} width={dimensions.width} height={dimensions.height}
                style={{ border: `${borderWidth}px solid #333`, borderRadius: '4px', display: 'block' }} />
        </Box>
    );
};

export default MemoryLayout;
