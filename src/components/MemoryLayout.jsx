import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Button } from '@mui/material';
import { Info, Close as CloseIcon } from '@mui/icons-material';
import * as d3 from 'd3';

const BLOCK_STATES = {
    0: { name: 'Free', color: '#4CAF50', label: 'Free Memory' },
    1: { name: 'Allocated', color: '#f44336', label: 'Allocated Block' },
    2: { name: 'Freed', color: '#FF9800', label: 'Freed Block' }
};

const REGION_COLORS = {
    0: { border: '#6366f1', bg: 'rgba(99,102,241,0.05)' },
    1: { border: '#ec4899', bg: 'rgba(236,72,153,0.05)' },
    2: { border: '#3b82f6', bg: 'rgba(59,130,246,0.05)' }
};

const MemoryLayout = ({ blocks, totalSize, heapOffset, activeBlock, onBlockClick, resetZoom, onFreeBlock }) => {
    const containerRef = useRef();
    const [dimensions, setDim] = useState({ width: 800, height: 300 });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const tooltipRef = useRef(null);

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
                const height = isHeap5 ? 650 : 300;
                
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
        };
    }, []);

    useEffect(() => {
        // Update or hide tooltip when selected block changes
        if (!selectedBlock && tooltipRef.current) {
            tooltipRef.current.remove();
            tooltipRef.current = null;
        }
    }, [selectedBlock]);

    const formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    const handleBlockClick = (block) => {
        if (selectedBlock?.allocationId === block?.allocationId && selectedBlock?.offset === block?.offset) {
            // Clicking same block - deselect
            setSelectedBlock(null);
            onBlockClick(null);
        } else {
            // Select new block
            setSelectedBlock(block);
            onBlockClick(block);
        }
    };

    const instructionText = isHeap5
        ? `Each region shown separately. Mouse wheel to zoom, click and drag to pan. Click allocated blocks to select and free them.`
        : `Mouse wheel to zoom, click and drag to pan. Click allocated blocks to select and free them.`;

    return (
        <Box ref={containerRef} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="h6">Memory Layout</Typography>
                <Tooltip title={instructionText} placement="top" arrow>
                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                        <Info fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

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
                        resetZoom={resetZoom}
                        onFreeBlock={onFreeBlock}
                        formatBytes={formatBytes}
                    />
                )}
            </Box>

            <Box display="flex" gap={1} mt={1.5} pt={1.5} borderTop="1px solid rgba(0,0,0,0.1)" flexWrap="wrap" justifyContent="center">
                {Object.values(BLOCK_STATES).map(state => (
                    <Chip
                        key={state.name}
                        label={state.label}
                        sx={{
                            backgroundColor: state.color,
                            color: 'white',
                            opacity: state.name === 'Free' ? 0.7 : 1,
                            '& .MuiChip-label': { fontWeight: 'bold' }
                        }}
                        size="small"
                    />
                ))}
            </Box>
        </Box>
    );
};

const Heap5Layout = ({ blocksByRegion, regionIds, dimensions, selectedBlock, onBlockClick, tooltipRef, resetZoom, onFreeBlock, formatBytes }) => {
    const svgRefs = useRef({});
    const zoomRefs = useRef({});
    const transformRefs = useRef({});

    const regionNames = ['FAST', 'DMA', 'UNCACHED'];
    // Calculate height for 3 regions plus spacing, leaving room for legend
    const totalRegionHeight = dimensions.height - 60; // Leave 60px for legend at bottom
    const regionHeight = Math.floor((totalRegionHeight - 30) / 3); // 30px total spacing between regions

    useEffect(() => {
        if (resetZoom) {
            regionIds.forEach(regionId => {
                if (zoomRefs.current[regionId]) {
                    const svg = d3.select(svgRefs.current[regionId]);
                    transformRefs.current[regionId] = d3.zoomIdentity;
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

    const showTooltip = (event, block) => {
        if (tooltipRef.current) {
            tooltipRef.current.remove();
        }

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : 'Free Block';
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
                    if (onFreeBlock) {
                        onFreeBlock(block);
                    }
                    if (tooltipRef.current) {
                        tooltipRef.current.remove();
                        tooltipRef.current = null;
                    }
                    onBlockClick(null);
                })
                .on('mouseover', function() {
                    d3.select(this).style('background', '#dc2626');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', '#ef4444');
                });
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
        const margin = { top: 20, right: 20, bottom: 50, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = regionHeight - margin.top - margin.bottom;

        const xScale = d3.scaleLinear()
            .domain([0, totalSize])
            .range([0, innerWidth]);

        // Create a clipping path
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
            .translateExtent([[0, 0], [innerWidth, innerHeight]])
            .extent([[0, 0], [width, regionHeight]])
            .on('zoom', (event) => {
                const { transform } = event;
                transformRefs.current[regionId] = transform;
                
                const newXScale = transform.rescaleX(xScale);
                
                let domain = newXScale.domain();
                let adjustedTransform = transform;
                
                if (domain[0] < 0) {
                    adjustedTransform = d3.zoomIdentity
                        .translate(transform.x - newXScale(0), transform.y)
                        .scale(transform.k);
                    transformRefs.current[regionId] = adjustedTransform;
                }
                if (domain[1] > totalSize) {
                    adjustedTransform = d3.zoomIdentity
                        .translate(transform.x - (newXScale(totalSize) - innerWidth), transform.y)
                        .scale(transform.k);
                    transformRefs.current[regionId] = adjustedTransform;
                }
                
                const finalScale = adjustedTransform.rescaleX(xScale);
                
                g.selectAll('.block-rect')
                    .attr('x', d => finalScale(d.offset))
                    .attr('width', d => Math.max(1, finalScale(d.offset + d.size) - finalScale(d.offset)));
                
                g.selectAll('.block-text')
                    .attr('x', d => finalScale(d.offset) + (finalScale(d.offset + d.size) - finalScale(d.offset)) / 2)
                    .style('display', d => (finalScale(d.offset + d.size) - finalScale(d.offset)) > 30 ? 'block' : 'none');
                
                updateAxis(g, finalScale, totalSize, regionBlocks, innerHeight, adjustedTransform.k);
            });

        svg.call(zoom);
        zoomRefs.current[regionId] = zoom;

        if (currentTransform && !isInitialDraw) {
            svg.call(zoom.transform, currentTransform);
        } else {
            transformRefs.current[regionId] = d3.zoomIdentity;
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

            const blockGroups = blockGroup.selectAll('.block')
                .data(regionBlocks)
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
                .attr('stroke', d => {
                    if (selectedBlock && selectedBlock.offset === d.offset && selectedBlock.regionId === d.regionId) {
                        return '#000';
                    }
                    return 'rgba(255,255,255,0.5)';
                })
                .attr('stroke-width', d => {
                    if (selectedBlock && selectedBlock.offset === d.offset && selectedBlock.regionId === d.regionId) {
                        return 3;
                    }
                    return 1;
                })
                .style('cursor', d => d.state === 1 ? 'pointer' : 'default')
                .on('click', function(event, d) {
                    event.stopPropagation();
                    onBlockClick(d);
                    if (d.state === 1) {
                        showTooltip(event, d);
                    }
                });

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
        });
    };

    const updateAxis = (g, xScale, totalSize, blocks, innerHeight, zoomLevel) => {
        g.select('.x-axis').remove();
        g.select('.allocation-markers').remove();
        
        // Main axis ticks
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
            .style('fill', '#000');

        // Add allocation boundary markers only when zoomed in enough
        // Require zoom level > 2 for markers to appear
        if (zoomLevel > 2) {
            const markerGroup = g.append('g').attr('class', 'allocation-markers');
            
            const allocatedBlocks = blocks.filter(b => b.state === 1);
            
            allocatedBlocks.forEach(block => {
                const startX = xScale(block.offset);
                const endX = xScale(block.offset + block.size);
                const width = endX - startX;
                
                // Only show markers if block is wide enough and not at x=0 for start
                if (width > 10) {
                    const showStart = block.offset > 0 || zoomLevel > 5; // Don't show start marker at 0 unless heavily zoomed
                    const showEnd = true;
                    
                    // Start marker
                    if (showStart && startX >= 0) {
                        markerGroup.append('line')
                            .attr('x1', startX)
                            .attr('x2', startX)
                            .attr('y1', innerHeight + 5)
                            .attr('y2', innerHeight + 12)
                            .attr('stroke', '#000')
                            .attr('stroke-width', 1.5);
                    }
                    
                    // End marker
                    if (showEnd) {
                        markerGroup.append('line')
                            .attr('x1', endX)
                            .attr('x2', endX)
                            .attr('y1', innerHeight + 5)
                            .attr('y2', innerHeight + 12)
                            .attr('stroke', '#000')
                            .attr('stroke-width', 1.5);
                    }
                    
                    // Add labels if there's enough space (require more zoom for labels)
                    if (width > 80 && zoomLevel > 4) {
                        // Both start and end
                        if (showStart && startX >= 0) {
                            markerGroup.append('text')
                                .attr('x', startX)
                                .attr('y', innerHeight + 27)
                                .attr('text-anchor', 'middle')
                                .attr('font-size', '9px')
                                .attr('fill', '#000')
                                .text(`0x${block.offset.toString(16).padStart(4, '0')}`);
                        }
                        
                        markerGroup.append('text')
                            .attr('x', endX)
                            .attr('y', innerHeight + 27)
                            .attr('text-anchor', 'middle')
                            .attr('font-size', '9px')
                            .attr('fill', '#000')
                            .text(`0x${(block.offset + block.size).toString(16).padStart(4, '0')}`);
                    } else if (width > 40 && zoomLevel > 3) {
                        // Just start
                        if (showStart && startX >= 0) {
                            markerGroup.append('text')
                                .attr('x', startX + 2)
                                .attr('y', innerHeight + 27)
                                .attr('text-anchor', 'start')
                                .attr('font-size', '9px')
                                .attr('fill', '#000')
                                .text(`0x${block.offset.toString(16).padStart(3, '0')}`);
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
                    <Box key={regionId} mb={idx < regionIds.length - 1 ? 1.5 : 0} sx={{ flexShrink: 0 }}>
                        <Typography 
                            variant="subtitle2" 
                            gutterBottom 
                            sx={{ 
                                fontWeight: 600,
                                color: regionColor.border,
                                mb: 0.5
                            }}
                        >
                            Region {regionId}: {regionNames[regionId] || `Region ${regionId}`}
                        </Typography>
                        <svg
                            ref={el => svgRefs.current[regionId] = el}
                            width={dimensions.width}
                            height={regionHeight}
                            style={{ 
                                border: `2px solid ${regionColor.border}`, 
                                borderRadius: '4px', 
                                display: 'block',
                                background: regionColor.bg
                            }}
                        />
                    </Box>
                );
            })}
        </Box>
    );
};

const SingleHeapLayout = ({ blocks, totalSize, heapOffset, dimensions, selectedBlock, onBlockClick, tooltipRef, resetZoom, onFreeBlock, formatBytes }) => {
    const svgRef = useRef();
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);

    useEffect(() => {
        if (resetZoom && zoomRef.current) {
            const svg = d3.select(svgRef.current);
            transformRef.current = d3.zoomIdentity;
            svg.transition().duration(300).call(
                zoomRef.current.transform,
                d3.zoomIdentity
            );
        }
    }, [resetZoom]);

    const showTooltip = (event, block) => {
        if (tooltipRef.current) {
            tooltipRef.current.remove();
        }

        const stateName = BLOCK_STATES[block.state]?.name || 'Unknown';
        const idText = block.allocationId > 0 ? `#${block.allocationId}` : 'Free Block';

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
                    if (onFreeBlock) {
                        onFreeBlock(block);
                    }
                    if (tooltipRef.current) {
                        tooltipRef.current.remove();
                        tooltipRef.current = null;
                    }
                    onBlockClick(null);
                })
                .on('mouseover', function() {
                    d3.select(this).style('background', '#dc2626');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', '#ef4444');
                });
        }
    };

    const updateAxis = (g, xScale, totalSize, blocks, innerHeight, zoomLevel) => {
        g.select('.x-axis').remove();
        g.select('.allocation-markers').remove();
        
        const tickInterval = Math.max(4096, totalSize / 8);
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
            .style('fill', '#000');

        if (zoomLevel > 2) {
            const markerGroup = g.append('g').attr('class', 'allocation-markers');
            
            const allocatedBlocks = blocks.filter(b => b.state === 1);
            
            allocatedBlocks.forEach(block => {
                const startX = xScale(block.offset);
                const endX = xScale(block.offset + block.size);
                const width = endX - startX;
                
                if (width > 10) {
                    const showStart = block.offset > 0 || zoomLevel > 5;
                    
                    if (showStart && startX >= 0) {
                        markerGroup.append('line')
                            .attr('x1', startX)
                            .attr('x2', startX)
                            .attr('y1', innerHeight + 5)
                            .attr('y2', innerHeight + 12)
                            .attr('stroke', '#000')
                            .attr('stroke-width', 1.5);
                    }
                    
                    markerGroup.append('line')
                        .attr('x1', endX)
                        .attr('x2', endX)
                        .attr('y1', innerHeight + 5)
                        .attr('y2', innerHeight + 12)
                        .attr('stroke', '#000')
                        .attr('stroke-width', 1.5);
                    
                    if (width > 80 && zoomLevel > 4) {
                        if (showStart && startX >= 0) {
                            markerGroup.append('text')
                                .attr('x', startX)
                                .attr('y', innerHeight + 27)
                                .attr('text-anchor', 'middle')
                                .attr('font-size', '9px')
                                .attr('fill', '#000')
                                .text(`0x${block.offset.toString(16).padStart(4, '0')}`);
                        }
                        
                        markerGroup.append('text')
                            .attr('x', endX)
                            .attr('y', innerHeight + 27)
                            .attr('text-anchor', 'middle')
                            .attr('font-size', '9px')
                            .attr('fill', '#000')
                            .text(`0x${(block.offset + block.size).toString(16).padStart(4, '0')}`);
                    } else if (width > 40 && zoomLevel > 3) {
                        if (showStart && startX >= 0) {
                            markerGroup.append('text')
                                .attr('x', startX + 2)
                                .attr('y', innerHeight + 27)
                                .attr('text-anchor', 'start')
                                .attr('font-size', '9px')
                                .attr('fill', '#000')
                                .text(`0x${block.offset.toString(16).padStart(3, '0')}`);
                        }
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
        const margin = { top: 20, right: 20, bottom: 60, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const xScale = d3.scaleLinear()
            .domain([0, totalSize])
            .range([0, innerWidth]);

        // Create clipping path
        svg.append('defs')
            .append('clipPath')
            .attr('id', 'clip-main')
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', innerHeight);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const zoom = d3.zoom()
            .scaleExtent([1, 50])
            .translateExtent([[0, 0], [innerWidth, innerHeight]])
            .extent([[0, 0], [width, height]])
            .on('zoom', (event) => {
                const { transform } = event;
                transformRef.current = transform;
                
                const newXScale = transform.rescaleX(xScale);
                
                let domain = newXScale.domain();
                let adjustedTransform = transform;
                
                if (domain[0] < 0) {
                    adjustedTransform = d3.zoomIdentity
                        .translate(transform.x - newXScale(0), transform.y)
                        .scale(transform.k);
                    transformRef.current = adjustedTransform;
                }
                if (domain[1] > totalSize) {
                    adjustedTransform = d3.zoomIdentity
                        .translate(transform.x - (newXScale(totalSize) - innerWidth), transform.y)
                        .scale(transform.k);
                    transformRef.current = adjustedTransform;
                }
                
                const finalScale = adjustedTransform.rescaleX(xScale);
                
                g.selectAll('.block-rect')
                    .attr('x', d => finalScale(d.offset))
                    .attr('width', d => Math.max(1, finalScale(d.offset + d.size) - finalScale(d.offset)));
                
                g.selectAll('.block-text')
                    .attr('x', d => finalScale(d.offset) + (finalScale(d.offset + d.size) - finalScale(d.offset)) / 2)
                    .style('display', d => (finalScale(d.offset + d.size) - finalScale(d.offset)) > 30 ? 'block' : 'none');
                
                updateAxis(g, finalScale, totalSize, blocks, innerHeight, adjustedTransform.k);
            });

        svg.call(zoom);
        zoomRef.current = zoom;

        if (currentTransform && !isInitialDraw) {
            svg.call(zoom.transform, currentTransform);
        } else {
            transformRef.current = d3.zoomIdentity;
        }

        g.append('rect')
            .attr('class', 'heap-boundary')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', innerHeight)
            .attr('fill', 'none')
            .attr('stroke', '#333')
            .attr('stroke-width', 2);

        const currentXScale = (currentTransform && !isInitialDraw) ? currentTransform.rescaleX(xScale) : xScale;
        const currentZoomLevel = (currentTransform && !isInitialDraw) ? currentTransform.k : 1;

        if (blocks && blocks.length > 0) {
            const blockGroup = g.append('g')
                .attr('clip-path', 'url(#clip-main)');

            const blockGroups = blockGroup.selectAll('.block')
                .data(blocks)
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
                .attr('stroke', d => {
                    if (selectedBlock && selectedBlock.offset === d.offset) {
                        return '#000';
                    }
                    return 'rgba(255,255,255,0.5)';
                })
                .attr('stroke-width', d => {
                    if (selectedBlock && selectedBlock.offset === d.offset) {
                        return 3;
                    }
                    return 1;
                })
                .style('cursor', d => d.state === 1 ? 'pointer' : 'default')
                .on('click', function(event, d) {
                    event.stopPropagation();
                    onBlockClick(d);
                    if (d.state === 1) {
                        showTooltip(event, d);
                    }
                });

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

        svg.on('click', () => {
            onBlockClick(null);
        });

    }, [blocks, totalSize, dimensions, selectedBlock, onBlockClick]);

    return (
        <Box sx={{ flex: 1, minHeight: 0 }}>
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                style={{ border: '1px solid #ccc', borderRadius: '4px', display: 'block' }}
            />
        </Box>
    );
};

export default MemoryLayout;