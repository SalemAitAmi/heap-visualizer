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
        setResetZoom(true);
        refreshData();
    };

    const handleAllocate = (size, count, region = null) => {
        const newPointers = [];
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
            }
        }
        setAllocatedPointers(prev => [...prev, ...newPointers]);
        refreshData();
    };

    const handleFreeBlock = (block) => {
        // Find the pointer - for heap implementations with headers,
        // the pointer is the block offset + header size
        const headerSize = currentHeap === 1 ? 0 : 4; // heap_1 has no header
        const expectedPtr = block.offset + headerSize;
        
        // Find closest matching pointer
        let matchingPtr = null;
        let minDiff = Infinity;
        
        allocatedPointers.forEach(ptr => {
            const diff = Math.abs(ptr - expectedPtr);
            if (diff < minDiff && diff < 20) { // Allow small variance
                minDiff = diff;
                matchingPtr = ptr;
            }
        });

        if (matchingPtr) {
            heapModule.free(matchingPtr);
            
            // Track this manual free operation
            setManualFreeOperations(prev => [...prev, {
                ptr: matchingPtr,
                blockId: block.allocationId,
                offset: block.offset,
                step: currentStep,
                timestamp: Date.now()
            }]);
            
            // Remove from allocated pointers
            setAllocatedPointers(prev => prev.filter(p => p !== matchingPtr));
            refreshData();
        } else {
            console.warn('Could not find matching pointer for block:', block);
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
        const simulations = getSimulations();
        const selectedSim = simulations[simulationName];
        if (selectedSim) {
            setSimulation(simulationName);
            setSimulationSteps(selectedSim.steps);
            heapModule.reset();
            setAllocatedPointers([]);
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
            setManualFreeOperations([]);
            
            const newPointers = [];
            for (let i = 0; i < currentStep - 1; i++) {
                const step = simulationSteps[i];
                if (step.action === 'allocate') {
                    const ptr = step.flags !== undefined && currentHeap === 5
                        ? heapModule.mallocFlags(step.size, step.flags)
                        : heapModule.malloc(step.size);
                    
                    if (ptr) {
                        newPointers.push(ptr);
                    }
                } else if (step.action === 'free' && step.ptrIndex !== undefined) {
                    if (step.ptrIndex < newPointers.length && newPointers[step.ptrIndex]) {
                        heapModule.free(newPointers[step.ptrIndex]);
                    }
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
            <Box className="app" p={3}>
                {/* Modern Header */}
                <Box 
                    sx={{ 
                        textAlign: 'center', 
                        mb: 4,
                        p: 3,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(236,72,153,0.05) 100%)',
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'rgba(99,102,241,0.1)'
                    }}
                >
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={1}>
                        <CodeIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                        <Typography 
                            variant="h3" 
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
                    </Box>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            color: 'text.secondary',
                            fontWeight: 400,
                            letterSpacing: 0
                        }}
                    >
                        {heapInfo.name}
                    </Typography>
                </Box>
                
                <Grid container spacing={3}>
                    {/* Controls */}
                    <Grid item xs={12} md={6}>
                        <Paper elevation={0} sx={{ p: 2.5, height: '380px', /* ... */ }}>
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
                        </Paper>
                    </Grid>

                    {/* Statistics */}
                    <Grid item xs={12} md={6}>
                        <Paper elevation={0} sx={{ p: 2.5, height: '380px', /* ... */ }}>
                            <Statistics 
                                stats={stats} 
                                currentHeap={currentHeap}
                                blocks={blocks}
                                heapModule={heapModule}
                            />
                        </Paper>
                    </Grid>

                    {/* Memory Layout */}
                    <Grid item xs={12}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                p: 2.5, 
                                height: currentHeap === 5 ? '800px' : '450px',
                                border: '1px solid',
                                borderColor: 'divider',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
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

                    {/* Log */}
                    <Grid item xs={12}>
                        <Paper elevation={0} sx={{ p: 2.5, height: '300px', /* ... */ }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                                Execution Log
                            </Typography>
                            <Log logs={logs} currentHeap={currentHeap}/>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Fade>
    );
}

export default App;