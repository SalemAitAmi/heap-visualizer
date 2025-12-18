import React, { useState, useEffect } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Typography,
    IconButton,
    Divider,
    Stack
} from '@mui/material';
import {
    PlayArrow,
    Pause,
    SkipPrevious,
    SkipNext,
    Refresh
} from '@mui/icons-material';

const Controls = ({
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
        const simulation = event.target.value;
        setSelectedSimulation(simulation);
        onSimulationChange(simulation);
    };

    const speedOptions = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControl fullWidth size="small">
                <InputLabel>Heap Implementation</InputLabel>
                <Select
                    value={currentHeap}
                    onChange={(e) => onHeapChange(e.target.value)}
                    label="Heap Implementation"
                >
                    {availableHeaps.map(heap => (
                        <MenuItem key={heap.type} value={heap.type} disabled={!heap.available}>
                            {heap.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Divider />

            <Box>
                <Typography variant="subtitle2" gutterBottom>Manual Allocation</Typography>
                <Stack direction="row" spacing={1} mb={1}>
                    <TextField
                        label="Size"
                        type="number"
                        value={allocSize}
                        onChange={(e) => setAllocSize(parseInt(e.target.value) || 0)}
                        size="small"
                        sx={{ width: 100 }}
                    />
                    <TextField
                        label="Count"
                        type="number"
                        value={allocCount}
                        onChange={(e) => setAllocCount(parseInt(e.target.value) || 0)}
                        size="small"
                        sx={{ width: 80 }}
                    />
                    {currentHeap === 5 && (
                        <FormControl size="small" sx={{ width: 100 }}>
                            <InputLabel>Region</InputLabel>
                            <Select
                                value={allocRegion}
                                onChange={(e) => setAllocRegion(e.target.value)}
                                label="Region"
                            >
                                <MenuItem value={0}>FAST</MenuItem>
                                <MenuItem value={1}>DMA</MenuItem>
                                <MenuItem value={2}>UNCACHED</MenuItem>
                                <MenuItem value={255}>Any</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                </Stack>
                <Button
                    variant="contained"
                    onClick={handleAllocate}
                    disabled={allocSize <= 0 || allocCount <= 0}
                    size="small"
                    fullWidth
                >
                    Allocate
                </Button>
            </Box>

            <Divider />

            <FormControl fullWidth size="small">
                <InputLabel>Simulation</InputLabel>
                <Select
                    value={selectedSimulation}
                    onChange={handleSimulationChange}
                    label="Simulation"
                >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="basic">Basic Allocation</MenuItem>
                    <MenuItem value="growth">Growth Pattern</MenuItem>
                    <MenuItem value="mixed">Mixed Sizes</MenuItem>
                    <MenuItem value="fragmentation">Fragmentation Demo</MenuItem>
                    <MenuItem value="regionSpecific">Region-Specific (Heap 5)</MenuItem>
                </Select>
            </FormControl>

            <Box>
                <Typography variant="subtitle2" gutterBottom>Playback Controls</Typography>
                
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton 
                        onClick={onStepBackward} 
                        disabled={currentStep === 0 || !selectedSimulation} 
                        size="small"
                    >
                        <SkipPrevious />
                    </IconButton>
                    <IconButton 
                        onClick={isPlaying ? onPause : onPlay}
                        disabled={!selectedSimulation || currentStep >= totalSteps}
                        color="primary"
                    >
                        {isPlaying ? <Pause /> : <PlayArrow />}
                    </IconButton>
                    <IconButton 
                        onClick={onStepForward}
                        disabled={currentStep >= totalSteps || !selectedSimulation}
                        size="small"
                    >
                        <SkipNext />
                    </IconButton>
                    <IconButton onClick={onReset} size="small">
                        <Refresh />
                    </IconButton>
                    
                    <FormControl size="small" sx={{ minWidth: 70 }}>
                        <InputLabel>Speed</InputLabel>
                        <Select
                            value={playbackSpeed}
                            onChange={(e) => onSpeedChange(e.target.value)}
                            label="Speed"
                            disabled={!selectedSimulation}
                        >
                            {speedOptions.map(speed => (
                                <MenuItem key={speed} value={speed}>
                                    {speed}x
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>

                {selectedSimulation && (
                    <Typography variant="caption" display="block" textAlign="center" mt={1}>
                        Step {currentStep} / {totalSteps}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default Controls;