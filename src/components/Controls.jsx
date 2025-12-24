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
    Stack,
    Tooltip
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
        <Box sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1.5
        }}>
            {/* Heap Selection */}
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

            <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)' }} />

            {/* Manual Allocation */}
            <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    Manual Allocation
                </Typography>
                <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
                    <TextField
                        label="Size (bytes)"
                        type="number"
                        value={allocSize}
                        onChange={(e) => setAllocSize(parseInt(e.target.value) || 0)}
                        size="small"
                        sx={{ 
                            width: { xs: '100%', sm: '100px' },
                            '& .MuiInputLabel-root': { fontSize: '0.8rem' }
                        }}
                        inputProps={{ min: 1 }}
                    />
                    <TextField
                        label="Count"
                        type="number"
                        value={allocCount}
                        onChange={(e) => setAllocCount(parseInt(e.target.value) || 0)}
                        size="small"
                        sx={{ 
                            width: { xs: '50%', sm: '70px' },
                            '& .MuiInputLabel-root': { fontSize: '0.8rem' }
                        }}
                        inputProps={{ min: 1, max: 100 }}
                    />
                    {currentHeap === 5 && (
                        <FormControl size="small" sx={{ width: { xs: '45%', sm: '100px' } }}>
                            <InputLabel sx={{ fontSize: '0.8rem' }}>Region</InputLabel>
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
                    sx={{ 
                        textTransform: 'none',
                        fontWeight: 600
                    }}
                >
                    Allocate
                </Button>
            </Box>

            <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)' }} />

            {/* Simulation Selection */}
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
                    <MenuItem value="coalescing">Coalescing Demo</MenuItem>
                    {currentHeap === 5 && (
                        <MenuItem value="regionSpecific">Region-Specific (Heap 5)</MenuItem>
                    )}
                </Select>
            </FormControl>

            {/* Playback Controls */}
            <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    Playback Controls
                </Typography>
                
                <Stack 
                    direction="row" 
                    alignItems="center" 
                    spacing={0.5}
                    sx={{ 
                        p: 1,
                        borderRadius: 2,
                        background: 'rgba(0,0,0,0.02)',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Tooltip title="Step Backward">
                        <span>
                            <IconButton 
                                onClick={onStepBackward} 
                                disabled={currentStep === 0 || !selectedSimulation} 
                                size="small"
                            >
                                <SkipPrevious />
                            </IconButton>
                        </span>
                    </Tooltip>
                    
                    <Tooltip title={isPlaying ? "Pause" : "Play"}>
                        <span>
                            <IconButton 
                                onClick={isPlaying ? onPause : onPlay}
                                disabled={!selectedSimulation || currentStep >= totalSteps}
                                color="primary"
                                sx={{ 
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'primary.dark' },
                                    '&.Mui-disabled': { bgcolor: 'action.disabledBackground' }
                                }}
                            >
                                {isPlaying ? <Pause /> : <PlayArrow />}
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
                                <SkipNext />
                            </IconButton>
                        </span>
                    </Tooltip>
                    
                    <Tooltip title="Reset">
                        <IconButton onClick={onReset} size="small">
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                    
                    <Box sx={{ flexGrow: 1 }} />
                    
                    <FormControl size="small" sx={{ minWidth: 70 }}>
                        <InputLabel sx={{ fontSize: '0.75rem' }}>Speed</InputLabel>
                        <Select
                            value={playbackSpeed}
                            onChange={(e) => onSpeedChange(e.target.value)}
                            label="Speed"
                            disabled={!selectedSimulation}
                            sx={{ 
                                '& .MuiSelect-select': { fontSize: '0.8rem' }
                            }}
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
                    <Box 
                        sx={{ 
                            mt: 1, 
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: currentStep >= totalSteps ? 'success.light' : 'primary.light',
                            color: 'white',
                            textAlign: 'center'
                        }}
                    >
                        <Typography variant="caption" fontWeight="600">
                            Step {currentStep} / {totalSteps}
                            {currentStep >= totalSteps && ' (Complete)'}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Controls;
