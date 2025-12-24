import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Grid, Paper, Typography, Alert, Fade } from '@mui/material';
import { Code as CodeIcon } from '@mui/icons-material';
import Statistics from './components/Statistics';
import MemoryLayout from './components/MemoryLayout';
import Log from './components/Log';
import HeapModule from './js/heap_module';
import { getSimulations } from './utils/simulations';

const HEAP_SIZE = 32768; // 32KB for visualization

// Common paper styles
const paperStyles = {
    p: 2,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
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
    const [pointerBlockMap, setPointerBlockMap] = useState(new Map());
    
    const playbackTimer = useRef(null);
    const stepRef = useRef(0);

    const refreshData = useCallback(() => {
        if (!heapModule || !heapModule.initialized) return;
        
        try {
            const newStats = heapModule.getStats();
            const newBlocks = heapModule.getBlocks();
            const newLogs = heapModule.getLogs();
            
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
                await heapModule.init();
                const heaps = heapModule.getAvailableHeaps();
                setAvailableHeaps(heaps);
                
                heapModule.switchHeap(1);
                heapModule.initHeap(HEAP_SIZE);
                
                setStats(heapModule.getStats() || {});
                setBlocks(heapModule.getBlocks() || []);
                setLogs(heapModule.getLogs() || []);
                setInitialized(true);
            } catch (error) {
                console.error('Failed to initialize heap module:', error);
                setInitError(error.message);
            }
        };
        initModule();
    }, []);

    useEffect(() => { stepRef.current = currentStep; }, [currentStep]);

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
        setActiveBlock(null);
        setResetZoom(true);
        refreshData();
    };

    const handleAllocate = (size, count, region = null) => {
        const newPointers = [];
        const newMappings = new Map(pointerBlockMap);
        
        for (let i = 0; i < count; i++) {
            let ptr;
            if (currentHeap === 5 && region !== null && region !== 255) {
                const flags = region === 0 ? 0x01 : region === 1 ? 0x02 : 0x04;
                ptr = heapModule.mallocFlags(size, flags);
            } else {
                ptr = heapModule.malloc(size);
            }
            if (ptr) {
                newPointers.push(ptr);
                newMappings.set(ptr, { size, region, allocIndex: allocatedPointers.length + newPointers.length - 1 });
            }
        }
        
        setAllocatedPointers(prev => [...prev, ...newPointers]);
        setPointerBlockMap(newMappings);
        refreshData();
    };

    const handleFreeBlock = (block) => {
        if (allocatedPointers.length === 0) return;
        
        const headerSize = currentHeap === 1 ? 0 : (currentHeap === 3 ? 0 : 4);
        const currentBlocks = heapModule.getBlocks();
        const allocatedBlocks = currentBlocks.filter(b => b.state === 1);
        
        let matchingPtr = null;
        
        if (allocatedPointers.length > 0 && allocatedBlocks.length > 0) {
            const sortedPointers = [...allocatedPointers].sort((a, b) => a - b);
            const sortedBlocks = [...allocatedBlocks].sort((a, b) => a.offset - b.offset);
            
            if (sortedPointers.length === sortedBlocks.length) {
                const bases = sortedPointers.map((ptr, i) => ptr - sortedBlocks[i].offset - headerSize);
                const firstBase = bases[0];
                const allConsistent = bases.every(b => Math.abs(b - firstBase) < 8);
                
                if (allConsistent) {
                    const expectedPtr = firstBase + block.offset + headerSize;
                    let minDiff = Infinity;
                    sortedPointers.forEach(ptr => {
                        const diff = Math.abs(ptr - expectedPtr);
                        if (diff < minDiff) { minDiff = diff; matchingPtr = ptr; }
                    });
                    if (minDiff > 16) matchingPtr = null;
                }
            }
        }
        
        if (!matchingPtr && allocatedPointers.length === 1 && allocatedBlocks.length === 1) {
            matchingPtr = allocatedPointers[0];
        }
        
        if (matchingPtr) {
            heapModule.free(matchingPtr);
            setAllocatedPointers(prev => prev.filter(p => p !== matchingPtr));
            setPointerBlockMap(prev => { const m = new Map(prev); m.delete(matchingPtr); return m; });
            setActiveBlock(null);
            refreshData();
        }
    };

    const resetPlayback = useCallback(() => {
        setIsPlaying(false);
        setCurrentStep(0);
        stepRef.current = 0;
        if (playbackTimer.current) { clearTimeout(playbackTimer.current); playbackTimer.current = null; }
    }, []);

    const handleSimulationChange = (simulationName) => {
        resetPlayback();
        setActiveBlock(null);
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
            const ptr = step.flags !== undefined && currentHeap === 5
                ? heapModule.mallocFlags(step.size, step.flags)
                : heapModule.malloc(step.size);
            if (ptr) {
                setAllocatedPointers(prev => [...prev, ptr]);
                setPointerBlockMap(prev => { const m = new Map(prev); m.set(ptr, { size: step.size, flags: step.flags }); return m; });
            }
        } else if (step.action === 'free' && step.ptrIndex !== undefined) {
            setAllocatedPointers(prev => {
                if (step.ptrIndex < prev.length && prev[step.ptrIndex]) heapModule.free(prev[step.ptrIndex]);
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
            if (stepRef.current >= simulationSteps.length) { setIsPlaying(false); return; }
            if (executeStep(stepRef.current)) {
                setCurrentStep(prev => prev + 1);
                if (stepRef.current + 1 < simulationSteps.length) {
                    playbackTimer.current = setTimeout(executeNextStep, 1000 / playbackSpeed);
                } else setIsPlaying(false);
            } else setIsPlaying(false);
        };
        executeNextStep();
    }, [simulation, simulationSteps, executeStep, playbackSpeed]);

    const handlePause = useCallback(() => {
        setIsPlaying(false);
        if (playbackTimer.current) { clearTimeout(playbackTimer.current); playbackTimer.current = null; }
    }, []);

    const handleStepForward = () => {
        if (simulation && currentStep < simulationSteps.length) {
            if (executeStep(currentStep)) setCurrentStep(prev => prev + 1);
        }
    };

    const handleStepBackward = () => {
        if (currentStep > 0) {
            heapModule.reset();
            setAllocatedPointers([]);
            setPointerBlockMap(new Map());
            setActiveBlock(null);
            
            const newPointers = [];
            for (let i = 0; i < currentStep - 1; i++) {
                const step = simulationSteps[i];
                if (step.action === 'allocate') {
                    const ptr = step.flags !== undefined && currentHeap === 5
                        ? heapModule.mallocFlags(step.size, step.flags)
                        : heapModule.malloc(step.size);
                    if (ptr) newPointers.push(ptr);
                } else if (step.action === 'free' && step.ptrIndex !== undefined) {
                    if (step.ptrIndex < newPointers.length) heapModule.free(newPointers[step.ptrIndex]);
                }
            }
            setAllocatedPointers(newPointers);
            setCurrentStep(prev => prev - 1);
            refreshData();
        }
    };

    const handleReset = () => {
        resetPlayback();
        heapModule.reset();
        setAllocatedPointers([]);
        setPointerBlockMap(new Map());
        setActiveBlock(null);
        setResetZoom(true);
        if (simulation) {
            const simulations = getSimulations();
            const selectedSim = simulations[simulation];
            if (selectedSim) setSimulationSteps(selectedSim.steps);
        }
        refreshData();
    };

    const handleSpeedChange = (speed) => setPlaybackSpeed(parseFloat(speed));

    useEffect(() => {
        return () => { if (playbackTimer.current) clearTimeout(playbackTimer.current); };
    }, []);

    if (initError) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh" p={2}>
                <Alert severity="error" sx={{ maxWidth: 500 }}>
                    <Typography variant="h6" gutterBottom>Failed to Initialize</Typography>
                    <Typography variant="body2">{initError}</Typography>
                </Alert>
            </Box>
        );
    }

    if (!initialized) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <Paper sx={{ p: 4, borderRadius: 3 }}>
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
            <Box className="app" sx={{ p: { xs: 1.5, md: 2 }, minHeight: '100vh' }}>
                {/* Compact Header */}
                <Box sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    mb: 2,
                    py: 1.5,
                    px: 2,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(236,72,153,0.05) 100%)',
                    borderRadius: 2,
                    border: '1px solid rgba(99,102,241,0.1)'
                }}>
                    <CodeIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: 700
                        }}
                    >
                        Heap Memory Visualizer
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                        {heapInfo.name}
                    </Typography>
                </Box>
                
                <Grid container spacing={1.5}>
                    {/* Statistics - Full Width, Flat */}
                    <Grid item xs={12}>
                        <Statistics 
                            stats={stats} 
                            currentHeap={currentHeap}
                            blocks={blocks}
                            heapModule={heapModule}
                        />
                    </Grid>

                    {/* Memory Layout with Embedded Controls */}
                    <Grid item xs={12}>
                        <Paper elevation={0} sx={{ ...paperStyles, minHeight: currentHeap === 5 ? 700 : 400 }}>
                            <MemoryLayout
                                blocks={blocks}
                                totalSize={stats.totalSize || HEAP_SIZE}
                                heapOffset={heapModule.getHeapOffset ? heapModule.getHeapOffset() : 0}
                                activeBlock={activeBlock}
                                onBlockClick={setActiveBlock}
                                resetZoom={resetZoom}
                                onFreeBlock={handleFreeBlock}
                                // Control props
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
                        </Paper>
                    </Grid>

                    {/* Execution Log */}
                    <Grid item xs={12}>
                        <Paper elevation={0} sx={{ ...paperStyles, minHeight: 200, maxHeight: 280 }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', flexShrink: 0 }}>
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
