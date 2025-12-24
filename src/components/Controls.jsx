/**
 * Controls Component - Standalone version
 * 
 * This component is kept as a separate module for potential future use
 * where controls might need to be displayed separately from the memory layout.
 * 
 * Currently, an embedded version is used directly in MemoryLayout.jsx
 * for a more integrated UX.
 * 
 * To use this standalone version, import it and pass the same props
 * that are passed to MemoryLayout's embedded controls.
 */

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
    Tooltip,
    Chip
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
    simulation,
    // Layout variant: 'horizontal' | 'vertical'
    variant = 'vertical'
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

    const speedOptions = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

    if (variant === 'horizontal') {
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
                        sx={{ width: 70 }}
                        inputProps={{ min: 1 }}
                    />
                    <TextField
                        label="Count"
                        type="number"
                        value={allocCount}
                        onChange={(e) => setAllocCount(parseInt(e.target.value) || 0)}
                        size="small"
                        sx={{ width: 60 }}
                        inputProps={{ min: 1, max: 100 }}
                    />
                    {currentHeap === 5 && (
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Region</InputLabel>
                            <Select value={allocRegion} onChange={(e) => setAllocRegion(e.target.value)} label="Region">
                                <MenuItem value={0}>FAST</MenuItem>
                                <MenuItem value={1}>DMA</MenuItem>
                                <MenuItem value={2}>UNCACHED</MenuItem>
                                <MenuItem value={255}>Any</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                    <Button variant="contained" onClick={handleAllocate} disabled={allocSize <= 0 || allocCount <= 0} size="small">
                        Allocate
                    </Button>
                </Stack>

                <Divider orientation="vertical" flexItem />

                {/* Simulation & Playback */}
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '0.8rem' }}>Simulation</InputLabel>
                    <Select value={selectedSimulation} onChange={handleSimulationChange} label="Simulation">
                        <MenuItem value="">None</MenuItem>
                        <MenuItem value="basic">Basic</MenuItem>
                        <MenuItem value="growth">Growth</MenuItem>
                        <MenuItem value="mixed">Mixed</MenuItem>
                        <MenuItem value="fragmentation">Fragmentation</MenuItem>
                        <MenuItem value="coalescing">Coalescing</MenuItem>
                        {currentHeap === 5 && <MenuItem value="regionSpecific">Regions</MenuItem>}
                    </Select>
                </FormControl>

                <Stack direction="row" spacing={0.25} alignItems="center">
                    <IconButton onClick={onStepBackward} disabled={currentStep === 0 || !selectedSimulation} size="small">
                        <SkipPrevious fontSize="small" />
                    </IconButton>
                    <IconButton 
                        onClick={isPlaying ? onPause : onPlay}
                        disabled={!selectedSimulation || currentStep >= totalSteps}
                        size="small"
                        sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                    >
                        {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                    </IconButton>
                    <IconButton onClick={onStepForward} disabled={currentStep >= totalSteps || !selectedSimulation} size="small">
                        <SkipNext fontSize="small" />
                    </IconButton>
                    <IconButton onClick={onReset} size="small">
                        <Refresh fontSize="small" />
                    </IconButton>
                </Stack>

                <FormControl size="small" sx={{ minWidth: 60 }}>
                    <InputLabel sx={{ fontSize: '0.7rem' }}>Speed</InputLabel>
                    <Select value={playbackSpeed} onChange={(e) => onSpeedChange(e.target.value)} label="Speed" disabled={!selectedSimulation}>
                        {speedOptions.map(s => <MenuItem key={s} value={s}>{s}x</MenuItem>)}
                    </Select>
                </FormControl>

                {selectedSimulation && (
                    <Chip label={`${currentStep}/${totalSteps}`} size="small" color={currentStep >= totalSteps ? 'success' : 'primary'} />
                )}
            </Box>
        );
    }

    // Vertical layout (original)
    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControl fullWidth size="small">
                <InputLabel>Heap Implementation</InputLabel>
                <Select value={currentHeap} onChange={(e) => onHeapChange(e.target.value)} label="Heap Implementation">
                    {availableHeaps.map(heap => (
                        <MenuItem key={heap.type} value={heap.type} disabled={!heap.available}>{heap.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Divider />

            <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    Manual Allocation
                </Typography>
                <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
                    <TextField label="Size" type="number" value={allocSize} onChange={(e) => setAllocSize(parseInt(e.target.value) || 0)} size="small" sx={{ width: 100 }} inputProps={{ min: 1 }} />
                    <TextField label="Count" type="number" value={allocCount} onChange={(e) => setAllocCount(parseInt(e.target.value) || 0)} size="small" sx={{ width: 70 }} inputProps={{ min: 1, max: 100 }} />
                    {currentHeap === 5 && (
                        <FormControl size="small" sx={{ width: 100 }}>
                            <InputLabel>Region</InputLabel>
                            <Select value={allocRegion} onChange={(e) => setAllocRegion(e.target.value)} label="Region">
                                <MenuItem value={0}>FAST</MenuItem>
                                <MenuItem value={1}>DMA</MenuItem>
                                <MenuItem value={2}>UNCACHED</MenuItem>
                                <MenuItem value={255}>Any</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                </Stack>
                <Button variant="contained" onClick={handleAllocate} disabled={allocSize <= 0 || allocCount <= 0} size="small" fullWidth>
                    Allocate
                </Button>
            </Box>

            <Divider />

            <FormControl fullWidth size="small">
                <InputLabel>Simulation</InputLabel>
                <Select value={selectedSimulation} onChange={handleSimulationChange} label="Simulation">
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="basic">Basic Allocation</MenuItem>
                    <MenuItem value="growth">Growth Pattern</MenuItem>
                    <MenuItem value="mixed">Mixed Sizes</MenuItem>
                    <MenuItem value="fragmentation">Fragmentation Demo</MenuItem>
                    <MenuItem value="coalescing">Coalescing Demo</MenuItem>
                    {currentHeap === 5 && <MenuItem value="regionSpecific">Region-Specific</MenuItem>}
                </Select>
            </FormControl>

            <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    Playback Controls
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ p: 1, borderRadius: 2, background: 'rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider' }}>
                    <Tooltip title="Step Backward"><span><IconButton onClick={onStepBackward} disabled={currentStep === 0 || !selectedSimulation} size="small"><SkipPrevious /></IconButton></span></Tooltip>
                    <Tooltip title={isPlaying ? "Pause" : "Play"}><span>
                        <IconButton onClick={isPlaying ? onPause : onPlay} disabled={!selectedSimulation || currentStep >= totalSteps} color="primary" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}>
                            {isPlaying ? <Pause /> : <PlayArrow />}
                        </IconButton>
                    </span></Tooltip>
                    <Tooltip title="Step Forward"><span><IconButton onClick={onStepForward} disabled={currentStep >= totalSteps || !selectedSimulation} size="small"><SkipNext /></IconButton></span></Tooltip>
                    <Tooltip title="Reset"><IconButton onClick={onReset} size="small"><Refresh /></IconButton></Tooltip>
                    <Box sx={{ flexGrow: 1 }} />
                    <FormControl size="small" sx={{ minWidth: 70 }}>
                        <InputLabel sx={{ fontSize: '0.75rem' }}>Speed</InputLabel>
                        <Select value={playbackSpeed} onChange={(e) => onSpeedChange(e.target.value)} label="Speed" disabled={!selectedSimulation}>
                            {speedOptions.map(s => <MenuItem key={s} value={s}>{s}x</MenuItem>)}
                        </Select>
                    </FormControl>
                </Stack>
                {selectedSimulation && (
                    <Box sx={{ mt: 1, p: 0.75, borderRadius: 1, bgcolor: currentStep >= totalSteps ? 'success.light' : 'primary.light', color: 'white', textAlign: 'center' }}>
                        <Typography variant="caption" fontWeight="600">Step {currentStep} / {totalSteps}{currentStep >= totalSteps && ' (Complete)'}</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Controls;
