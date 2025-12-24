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
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'rgba(0,0,0,0.02)'
                }}
            >
                <List dense sx={{ py: 0 }}>
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
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    '&:last-child': { borderBottom: 'none' },
                                    py: 0.75
                                }}
                            >
                                <Box width="100%">
                                    <Box display="flex" alignItems="center" gap={0.75} mb={0.25} flexWrap="wrap">
                                        <Chip
                                            label={log.action}
                                            size="small"
                                            color={getActionColor(log.action)}
                                            sx={{ height: '22px', fontSize: '0.7rem' }}
                                        />
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
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
                                                    height: '18px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                        )}
                                        
                                        {!log.success && (
                                            <Chip
                                                label="FAILED"
                                                size="small"
                                                color="error"
                                                sx={{ height: '20px', fontSize: '0.65rem' }}
                                            />
                                        )}
                                    </Box>
                                    {formatLogEntry(log) && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            {formatLogEntry(log)}
                                        </Typography>
                                    )}
                                </Box>
                            </ListItem>
                        ))
                    )}
                </List>
            </Box>
            
            <Box mt={1} display="flex" justifyContent="flex-start" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                    {logs.length} operations logged
                </Typography>
            </Box>
        </Box>
    );
};

export default Log;
