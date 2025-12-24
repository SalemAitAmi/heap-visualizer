import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Grid, Paper, Typography, Alert, Fade } from '@mui/material';
import { Code as CodeIcon } from '@mui/icons-material';
import Controls from './components/Controls';
import Statistics from './components/Statistics';
import MemoryLayout from './components/MemoryLayout';
import Log from './components/Log';
import HeapModule from './js/heap_module';
import { getSimulations } from './utils/simulations';

const HEAP_SIZE = 32768; // 32KB for visualization

// Common paper styles for consistent container styling
const paperStyles = {
    p: 2.5,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 3,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

function App() {
    const [heapModule] = useState(new HeapModule());
    const [initialized, setInitialized] = useState(false);
    const [initError, setInitError] = useState(null);
    const [currentHeap, setCurrentHeap] = useState(1);
    const [availableHeaps, setAvailableHeaps] = useState([]);
    const [stats, setStats] = useState({});
    const [blocks, setBlocks] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeBlock, setActiveBlock] = useState(null);
    const [resetZoom, setResetZoom] = useState(false);
    
    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [currentStep, setCurrentStep] = useState(0);
    const [simulation, setSimulation] = useState(null);
    const [simulationSteps, setSimulationSteps] = useState([]);
    const [allocatedPointers, setAllocatedPointers] = useState([]);
    const [manualFreeOperations, setManualFreeOperations] = useState([]);
    
    // Track pointer to block mapping for free operations
    const [pointerBlockMap, setPointerBlockMap] = useState(new Map());
    
    const playbackTimer = useRef(null);
    const stepRef = useRef(0);

    const refreshData = useCallback(() => {
        if (!heapModule || !heapModule.initialized) return;
        
        try {
            const newStats = heapModule.getStats();
            const newBlocks = heapModule.getBlocks();
            const newLogs = heapModule.getLogs();
            
            console.log('Refreshed data:', { 
                stats: newStats, 
                blocks: newBlocks,
                logs: newLogs.length 
            });
            
            setStats(newStats || {});
            setBlocks(newBlocks || []);
            setLogs(newLogs || []);
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }, [heapModule]);

    useEffect(() => {
        const initModule = async () => {
            try {
                console.log('Starting heap module initialization...');
                await heapModule.init();
                const heaps = heapModule.getAvailableHeaps();
                setAvailableHeaps(heaps);
                console.log('Available heaps:', heaps);
                
                heapModule.switchHeap(1);
                heapModule.initHeap(HEAP_SIZE);
                
                const initialStats = heapModule.getStats();
                const initialBlocks = heapModule.getBlocks();
                const initialLogs = heapModule.getLogs();
                
                setStats(initialStats || {});
                setBlocks(initialBlocks || []);
                setLogs(initialLogs || []);
                
                setInitialized(true);
                console.log('Initialization complete with initial data');
                
            } catch (error) {
                console.error('Failed to initialize heap module:', error);
                setInitError(error.message);
            }
        };
        
        initModule();
    }, []);

    useEffect(() => {
        stepRef.current = currentStep;
    }, [currentStep]);

    useEffect(() => {
        if (resetZoom) {
            const timer = setTimeout(() => setResetZoom(false), 100);
            return () => clearTimeout(timer);
        }
    }, [resetZoom]);

    const handleHeapChange = (newHeap) => {
        if (newHeap === currentHeap) return;
        
        resetPlayback();
        setCurrentHeap(newHeap);
        heapModule.switchHeap(newHeap);
        heapModule.initHeap(HEAP_SIZE);
        setAllocatedPointers([]);
        setPointerBlockMap(new Map());
        setActiveBlock(null); // Clear selected block
        setResetZoom(true);
        refreshData();
    };

    const handleAllocate = (size, count, region = null) => {
        const newPointers = [];
        const newMappings = new Map(pointerBlockMap);
        
        for (let i = 0; i < count; i++) {
            let ptr;
            if (currentHeap === 5 && region !== null && region !== 255) {
                // Convert region to flags
                const flags = region === 0 ? 0x01 : region === 1 ? 0x02 : 0x04;
                ptr = heapModule.mallocFlags(size, flags);
            } else {
                ptr = heapModule.malloc(size);
            }
            if (ptr) {
                newPointers.push(ptr);
                // Store mapping with allocation details
                newMappings.set(ptr, { size, region, allocIndex: allocatedPointers.length + newPointers.length - 1 });
            }
        }
        
        setAllocatedPointers(prev => [...prev, ...newPointers]);
        setPointerBlockMap(newMappings);
        refreshData();
    };

    const handleFreeBlock = (block) => {
        console.log('handleFreeBlock called with block:', block);
        console.log('Current allocated pointers:', allocatedPointers);
        
        if (allocatedPointers.length === 0) {
            console.warn('No allocated pointers to free');
            return;
        }
        
        // For heap implementations with headers, the pointer returned by malloc
        // points to the user data area, which is after the header.
        // The block.offset from getBlocks() is the start of the block including header.
        
        // Different heaps have different header sizes:
        // heap_1: no header (allocations are sequential), ptr = heap_memory + offset
        // heap_2, heap_4, heap_5: 4-byte header (stores size), ptr = heap_memory + offset + 4
        // heap_3: uses system malloc
        
        const headerSize = currentHeap === 1 ? 0 : (currentHeap === 3 ? 0 : 4);
        
        // Strategy: Match based on the relationship between pointers and block offsets
        // For any allocated block: ptr = heap_memory_base + block.offset + headerSize
        // So: ptr - block.offset = heap_memory_base + headerSize (constant for all blocks)
        
        // Get all current blocks to establish the mapping
        const currentBlocks = heapModule.getBlocks();
        const allocatedBlocks = currentBlocks.filter(b => b.state === 1);
        
        console.log('Allocated blocks:', allocatedBlocks);
        console.log('Looking for block with offset:', block.offset, 'allocationId:', block.allocationId);
        
        let matchingPtr = null;
        
        // Method 1: If we have pointers and blocks, calculate base address
        if (allocatedPointers.length > 0 && allocatedBlocks.length > 0) {
            // We need to figure out which pointer corresponds to which block
            // Sort both by offset/value to try to establish correspondence
            const sortedPointers = [...allocatedPointers].sort((a, b) => a - b);
            const sortedBlocks = [...allocatedBlocks].sort((a, b) => a.offset - b.offset);
            
            // Calculate the base for each potential matching pair
            // The difference between pointer and (offset + headerSize) should be consistent
            let baseAddress = null;
            
            // Try to find a consistent base address
            if (sortedPointers.length === sortedBlocks.length) {
                // Perfect match - each pointer should correspond to each block
                const bases = sortedPointers.map((ptr, i) => 
                    ptr - sortedBlocks[i].offset - headerSize
                );
                
                // Check if all bases are the same (within tolerance for alignment)
                const firstBase = bases[0];
                const allConsistent = bases.every(b => Math.abs(b - firstBase) < 8);
                
                if (allConsistent) {
                    baseAddress = firstBase;
                    console.log('Calculated consistent base address:', baseAddress);
                }
            }
            
            if (baseAddress !== null) {
                // Now find the pointer for our target block
                const expectedPtr = baseAddress + block.offset + headerSize;
                console.log('Expected pointer for target block:', expectedPtr);
                
                // Find the closest matching pointer
                let minDiff = Infinity;
                sortedPointers.forEach(ptr => {
                    const diff = Math.abs(ptr - expectedPtr);
                    if (diff < minDiff) {
                        minDiff = diff;
                        matchingPtr = ptr;
                    }
                });
                
                // Accept if within reasonable tolerance
                if (minDiff > 16) {
                    console.warn('Best match has large diff:', minDiff);
                    matchingPtr = null;
                }
            }
        }
        
        // Method 2: Fallback - match by allocation order/ID
        if (!matchingPtr && block.allocationId > 0) {
            // Find the index of this block among allocated blocks by allocationId
            const blockIdx = allocatedBlocks.findIndex(b => 
                b.allocationId === block.allocationId && 
                b.offset === block.offset &&
                (block.regionId === undefined || b.regionId === block.regionId)
            );
            
            if (blockIdx !== -1) {
                // Sort blocks by allocationId to establish order
                const blocksByAllocId = [...allocatedBlocks].sort((a, b) => a.allocationId - b.allocationId);
                const orderIdx = blocksByAllocId.findIndex(b => 
                    b.allocationId === block.allocationId && b.offset === block.offset
                );
                
                if (orderIdx !== -1 && orderIdx < allocatedPointers.length) {
                    // This assumes pointers are stored in allocation order
                    // But after frees, the order might not match
                    // So this is a fallback that might not always work
                    console.log('Fallback: trying pointer at order index:', orderIdx);
                }
            }
        }

        // Method 3: Last resort - if only one pointer left, use it
        if (!matchingPtr && allocatedPointers.length === 1 && allocatedBlocks.length === 1) {
            matchingPtr = allocatedPointers[0];
            console.log('Single pointer fallback:', matchingPtr);
        }
        
        if (matchingPtr) {
            console.log('Found matching pointer:', matchingPtr);
            heapModule.free(matchingPtr);
            
            // Track this manual free operation
            setManualFreeOperations(prev => [...prev, {
                ptr: matchingPtr,
                blockId: block.allocationId,
                offset: block.offset,
                step: currentStep,
                timestamp: Date.now()
            }]);
            
            // Remove from allocated pointers and mapping
            setAllocatedPointers(prev => prev.filter(p => p !== matchingPtr));
            setPointerBlockMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(matchingPtr);
                return newMap;
            });
            
            // Clear the active block selection
            setActiveBlock(null);
            
            refreshData();
        } else {
            console.warn('Could not find matching pointer for block:', block);
            console.warn('Available pointers:', allocatedPointers);
            console.warn('Available allocated blocks:', allocatedBlocks);
        }
    };

    const resetPlayback = useCallback(() => {
        setIsPlaying(false);
        setCurrentStep(0);
        stepRef.current = 0;
        if (playbackTimer.current) {
            clearTimeout(playbackTimer.current);
            playbackTimer.current = null;
        }
    }, []);

    const handleSimulationChange = (simulationName) => {
        resetPlayback();
        setActiveBlock(null); // Clear selected block on simulation change
        
        const simulations = getSimulations();
        const selectedSim = simulations[simulationName];
        if (selectedSim) {
            setSimulation(simulationName);
            setSimulationSteps(selectedSim.steps);
            heapModule.reset();
            setAllocatedPointers([]);
            setPointerBlockMap(new Map());
            refreshData();
        } else {
            setSimulation(null);
            setSimulationSteps([]);
        }
    };

    const executeStep = useCallback((stepIndex) => {
        if (stepIndex >= simulationSteps.length) return false;
        
        const step = simulationSteps[stepIndex];
        if (step.action === 'allocate') {
            // Check if we're on heap_5 and step has flags
            const ptr = step.flags !== undefined && currentHeap === 5
                ? heapModule.mallocFlags(step.size, step.flags)
                : heapModule.malloc(step.size);
            
            if (ptr) {
                setAllocatedPointers(prev => [...prev, ptr]);
                setPointerBlockMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(ptr, { size: step.size, flags: step.flags });
                    return newMap;
                });
            }
        } else if (step.action === 'free' && step.ptrIndex !== undefined) {
            setAllocatedPointers(prev => {
                if (step.ptrIndex < prev.length && prev[step.ptrIndex]) {
                    heapModule.free(prev[step.ptrIndex]);
                }
                return prev;
            });
        }
        
        refreshData();
        return true;
    }, [simulationSteps, heapModule, refreshData, currentHeap]);

    const handlePlay = useCallback(() => {
        if (!simulation || stepRef.current >= simulationSteps.length) return;
        
        setIsPlaying(true);
        
        const executeNextStep = () => {
            if (stepRef.current >= simulationSteps.length) {
                setIsPlaying(false);
                return;
            }
            
            const success = executeStep(stepRef.current);
            if (success) {
                setCurrentStep(prev => prev + 1);
                
                if (stepRef.current + 1 < simulationSteps.length) {
                    playbackTimer.current = setTimeout(executeNextStep, 1000 / playbackSpeed);
                } else {
                    setIsPlaying(false);
                }
            } else {
                setIsPlaying(false);
            }
        };
        
        executeNextStep();
    }, [simulation, simulationSteps, executeStep, playbackSpeed]);

    const handlePause = useCallback(() => {
        setIsPlaying(false);
        if (playbackTimer.current) {
            clearTimeout(playbackTimer.current);
            playbackTimer.current = null;
        }
    }, []);

    const handleStepForward = () => {
        if (simulation && currentStep < simulationSteps.length) {
            const success = executeStep(currentStep);
            if (success) {
                setCurrentStep(prev => prev + 1);
            }
        }
    };

    const handleStepBackward = () => {
        if (currentStep > 0) {
            heapModule.reset();
            setAllocatedPointers([]);
            setPointerBlockMap(new Map());
            setManualFreeOperations([]);
            setActiveBlock(null); // Clear selected block
            
            const newPointers = [];
            const newMap = new Map();
            
            for (let i = 0; i < currentStep - 1; i++) {
                const step = simulationSteps[i];
                if (step.action === 'allocate') {
                    const ptr = step.flags !== undefined && currentHeap === 5
                        ? heapModule.mallocFlags(step.size, step.flags)
                        : heapModule.malloc(step.size);
                    
                    if (ptr) {
                        newPointers.push(ptr);
                        newMap.set(ptr, { size: step.size, flags: step.flags });
                    }
                } else if (step.action === 'free' && step.ptrIndex !== undefined) {
                    if (step.ptrIndex < newPointers.length && newPointers[step.ptrIndex]) {
                        heapModule.free(newPointers[step.ptrIndex]);
                    }
                }
            }
            
            setAllocatedPointers(newPointers);
            setPointerBlockMap(newMap);
            setCurrentStep(prev => prev - 1);
            refreshData();
        }
    };

    const handleReset = () => {
        resetPlayback();
        heapModule.reset();
        setAllocatedPointers([]);
        setPointerBlockMap(new Map());
        setActiveBlock(null); // Clear selected block
        setResetZoom(true);
        
        if (simulation) {
            const simulations = getSimulations();
            const selectedSim = simulations[simulation];
            if (selectedSim) {
                setSimulationSteps(selectedSim.steps);
            }
        }
        
        refreshData();
    };

    const handleSpeedChange = (speed) => {
        setPlaybackSpeed(parseFloat(speed));
    };

    useEffect(() => {
        return () => {
            if (playbackTimer.current) {
                clearTimeout(playbackTimer.current);
            }
        };
    }, []);

    if (initError) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh" p={2}>
                <Alert severity="error" sx={{ maxWidth: 500 }}>
                    <Typography variant="h6" gutterBottom>
                        Failed to Initialize Heap Visualizer
                    </Typography>
                    <Typography variant="body2">
                        {initError}
                    </Typography>
                </Alert>
            </Box>
        );
    }

    if (!initialized) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <Paper sx={{ p: 4, borderRadius: 3, background: 'rgba(255,255,255,0.95)' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        Loading Heap Visualizer...
                    </Typography>
                </Paper>
            </Box>
        );
    }

    const heapInfo = heapModule.getCurrentHeapInfo();

    return (
        <Fade in={initialized}>
            <Box className="app" sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
                {/* Modern Header */}
                <Box 
                    sx={{ 
                        textAlign: 'center', 
                        mb: 3,
                        p: { xs: 2, md: 3 },
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(236,72,153,0.05) 100%)',
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'rgba(99,102,241,0.1)'
                    }}
                >
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={1}>
                        <CodeIcon sx={{ fontSize: { xs: 32, md: 40 }, color: 'primary.main' }} />
                        <Typography 
                            variant="h3" 
                            sx={{ 
                                fontSize: { xs: '1.75rem', md: '2.5rem' },
                                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontWeight: 700
                            }}
                        >
                            Heap Memory Visualizer
                        </Typography>
                    </Box>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            color: 'text.secondary',
                            fontWeight: 400,
                            letterSpacing: 0,
                            fontSize: { xs: '0.9rem', md: '1.1rem' }
                        }}
                    >
                        {heapInfo.name}
                    </Typography>
                </Box>
                
                <Grid container spacing={2}>
                    {/* Controls and Statistics Row */}
                    <Grid item xs={12} lg={6}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                ...paperStyles,
                                minHeight: { xs: 'auto', md: '380px' },
                                height: '100%'
                            }}
                        >
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', flexShrink: 0 }}>
                                Controls
                            </Typography>
                            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                                <Controls
                                    availableHeaps={availableHeaps}
                                    currentHeap={currentHeap}
                                    onHeapChange={handleHeapChange}
                                    onAllocate={handleAllocate}
                                    onSimulationChange={handleSimulationChange}
                                    isPlaying={isPlaying}
                                    playbackSpeed={playbackSpeed}
                                    onPlay={handlePlay}
                                    onPause={handlePause}
                                    onStepForward={handleStepForward}
                                    onStepBackward={handleStepBackward}
                                    onReset={handleReset}
                                    onSpeedChange={handleSpeedChange}
                                    currentStep={currentStep}
                                    totalSteps={simulationSteps.length}
                                    simulation={simulation}
                                />
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} lg={6}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                ...paperStyles,
                                minHeight: { xs: 'auto', md: '380px' },
                                height: '100%'
                            }}
                        >
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', flexShrink: 0 }}>
                                Statistics
                            </Typography>
                            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                                <Statistics 
                                    stats={stats} 
                                    currentHeap={currentHeap}
                                    blocks={blocks}
                                    heapModule={heapModule}
                                />
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Memory Layout - Full Width */}
                    <Grid item xs={12}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                ...paperStyles,
                                minHeight: currentHeap === 5 ? { xs: '600px', md: '750px' } : { xs: '350px', md: '450px' },
                            }}
                        >
                            <MemoryLayout
                                blocks={blocks}
                                totalSize={stats.totalSize || HEAP_SIZE}
                                heapOffset={heapModule.getHeapOffset ? heapModule.getHeapOffset() : 0}
                                activeBlock={activeBlock}
                                onBlockClick={setActiveBlock}
                                resetZoom={resetZoom}
                                onFreeBlock={handleFreeBlock}
                            />
                        </Paper>
                    </Grid>

                    {/* Log - Full Width */}
                    <Grid item xs={12}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                ...paperStyles,
                                minHeight: { xs: '250px', md: '300px' },
                            }}
                        >
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', flexShrink: 0 }}>
                                Execution Log
                            </Typography>
                            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                <Log logs={logs} currentHeap={currentHeap}/>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Fade>
    );
}

export default App;
