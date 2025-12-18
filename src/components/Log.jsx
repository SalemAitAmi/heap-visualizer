import React, { useEffect, useRef } from 'react';
import { Box, Typography, List, ListItem, Chip } from '@mui/material';

const Log = ({ logs, currentHeap }) => {
    const listRef = useRef();

    useEffect(() => {
        // Auto-scroll to bottom when new logs are added
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [logs]);

    const getActionColor = (action) => {
        switch (action) {
            case 'INIT': return 'info';
            case 'MALLOC': return 'success';
            case 'FREE': return 'warning';
            case 'COALESCE': return 'secondary';
            case 'FULL_COALESCE': return 'secondary';
            default: return 'default';
        }
    };

    const getRegionColor = (regionId) => {
        const colors = ['primary', 'secondary', 'info'];
        return colors[regionId] || 'default';
    };

    const formatLogEntry = (log) => {
        let details = [];
        
        if (log.size > 0) {
            details.push(`Size: ${log.size}B`);
        }
        
        if (log.offset > 0) {
            details.push(`Address: 0x${log.offset.toString(16).padStart(4, '0')}`);
        }
        
        if (log.allocationId > 0) {
            details.push(`ID: ${log.allocationId}`);
        }
        
        // Add flags info for heap_5 malloc operations
        if (currentHeap === 5 && log.action === 'MALLOC' && log.flags) {
            const flagNames = [];
            if (log.flags & 0x01) flagNames.push('FAST');
            if (log.flags & 0x02) flagNames.push('DMA');
            if (log.flags & 0x04) flagNames.push('UNCACHED');
            if (flagNames.length > 0) {
                details.push(`Flags: ${flagNames.join('|')}`);
            }
        }

        return details.join(', ');
    };

    return (
        <Box height="100%" display="flex" flexDirection="column">
            <Box 
                ref={listRef}
                sx={{ 
                    flex: 1, 
                    overflowY: 'auto',
                    maxHeight: '250px',
                    border: '1px solid #ddd',
                    borderRadius: 1,
                    bgcolor: '#f5f5f5'
                }}
            >
                <List dense>
                    {logs.length === 0 ? (
                        <ListItem>
                            <Typography variant="body2" color="text.secondary">
                                No operations yet...
                            </Typography>
                        </ListItem>
                    ) : (
                        logs.map((log, index) => (
                            <ListItem
                                key={index}
                                sx={{ 
                                    borderBottom: '1px solid #eee',
                                    '&:last-child': { borderBottom: 'none' }
                                }}
                            >
                                <Box width="100%">
                                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                        <Chip
                                            label={log.action}
                                            size="small"
                                            color={getActionColor(log.action)}
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            #{log.timestamp}
                                        </Typography>
                                        
                                        {/* Show region for heap_5 */}
                                        {currentHeap === 5 && log.regionName && (
                                            <Chip
                                                label={log.regionName}
                                                size="small"
                                                color={getRegionColor(log.regionId)}
                                                variant="outlined"
                                                sx={{ 
                                                    height: '20px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        )}
                                        
                                        {!log.success && (
                                            <Chip
                                                label="FAILED"
                                                size="small"
                                                color="error"
                                            />
                                        )}
                                    </Box>
                                    {formatLogEntry(log) && (
                                        <Typography variant="body2" color="text.secondary">
                                            {formatLogEntry(log)}
                                        </Typography>
                                    )}
                                </Box>
                            </ListItem>
                        ))
                    )}
                </List>
            </Box>
            
            <Box mt={1} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                    {logs.length} operations logged
                </Typography>
                {currentHeap === 5 && (
                    <Box display="flex" gap={0.5}>
                        <Chip label="FAST" size="small" color="primary" variant="outlined" sx={{ height: '18px', fontSize: '0.65rem' }} />
                        <Chip label="DMA" size="small" color="secondary" variant="outlined" sx={{ height: '18px', fontSize: '0.65rem' }} />
                        <Chip label="UNCACHED" size="small" color="info" variant="outlined" sx={{ height: '18px', fontSize: '0.65rem' }} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Log;