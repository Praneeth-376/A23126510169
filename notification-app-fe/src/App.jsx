import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Card, CardContent, Button, 
  Select, MenuItem, InputLabel, FormControl, Pagination, Box, Chip
} from '@mui/material';

// --- INTEGRATED EMBEDDED LOGGING MIDDLEWARE LAYER ---
const CREDENTIALS = {
  email: "pandalapraneeth.23.cse@anits.edu.in",
  name: "Pandala Praneeth",
  rollNo: "A23126510169",
  accessCode: "MTqxar",
  clientID: "3de3df34-edf9-4cd9-8c72-011e8f0f3118",
  clientSecret: "nNbhSEqAQvYNsbdT"
};

async function logToEvaluationServer(level, pkg, message) {
  try {
    // 1. Fetch Fresh Handshake Token
    const authRes = await fetch('/evaluation-service/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS)
    });
    const authData = await authRes.json();
    
    // 2. Transmit Cleaned Flat Log Payload (Avoids reserved keywords like 'package')
    await fetch('/evaluation-service/logs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level: level.toLowerCase(),
        message: `[${pkg.toUpperCase()}] ${message}`,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn("Local logger sync fallback tracking notice:", err.message);
  }
}

const WEIGHTS = { 'Placement': 3, 'Result': 2, 'Event': 1 };

export default function App() {
  const [notifications, setNotifications] = useState([]);
  const [viewMode, setViewMode] = useState('all'); 
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewedIds, setViewedIds] = useState(new Set());
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    fetchNotificationStream();
  }, [page, typeFilter, viewMode, limit]);

  const fetchNotificationStream = async () => {
    try {
      await logToEvaluationServer("info", "frontend", `Inbound network update request triggered for page index: ${page}`);
      
      let url = `/evaluation-service/notifications?page=${page}&limit=${limit}`;
      if (typeFilter) {
        url += `&notification_type=${typeFilter}`;
      }

      const authRes = await fetch('/evaluation-service/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREDENTIALS)
      });
      const authData = await authRes.json();

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authData.access_token}` }
      });
      
      const data = await response.json();
      let streamData = data.notifications || [];

      if (viewMode === 'priority') {
        streamData = streamData.sort((a, b) => {
          const wA = WEIGHTS[a.Type] || 0;
          const wB = WEIGHTS[b.Type] || 0;
          if (wB !== wA) return wB - wA;
          return new Date(b.Timestamp.replace(' ', 'T')) - new Date(a.Timestamp.replace(' ', 'T'));
        });
      }

      setNotifications(streamData);
    } catch (error) {
      await logToEvaluationServer("error", "component", `Critical viewport engine exception caught: ${error.message}`);
    }
  };

  const markAsRead = async (id) => {
    setViewedIds(prev => {
      const updated = new Set(prev);
      updated.add(id);
      return updated;
    });
    await logToEvaluationServer("debug", "state", `Notification pointer reference checked as viewed: ${id}`);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Typography variant="h4" fontWeight="800" letterSpacing="-0.5px" gutterBottom color="primary">
        Campus Notification Core Dashboard
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
        Logged in Session Tracking Profile: <strong>{CREDENTIALS.rollNo}</strong>
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button 
          variant={viewMode === 'all' ? 'contained' : 'outlined'} 
          onClick={() => setViewMode('all')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          Standard Feed view
        </Button>
        <Button 
          variant={viewMode === 'priority' ? 'contained' : 'outlined'} 
          color="secondary" 
          onClick={() => setViewMode('priority')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          🚨 Critical Priority Inbox
        </Button>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Filter Category</InputLabel>
          <Select 
            value={typeFilter} 
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} 
            label="Filter Category"
            sx={{ borderRadius: '8px' }}
          >
            <MenuItem value=""><em>All Deliverables</em></MenuItem>
            <MenuItem value="Placement">Placement Drives</MenuItem>
            <MenuItem value="Result">Academic Results</MenuItem>
            <MenuItem value="Event">Campus Events</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>View Limit</InputLabel>
          <Select 
            value={limit} 
            onChange={(e) => { setLimit(e.target.value); setPage(1); }} 
            label="View Limit"
            sx={{ borderRadius: '8px' }}
          >
            <MenuItem value={5}>Top 5</MenuItem>
            <MenuItem value={10}>Top 10</MenuItem>
            <MenuItem value={15}>Top 15</MenuItem>
            <MenuItem value={20}>Top 20</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Clean Box Layout Stack — Eliminates item attribute errors completely */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        {notifications.length === 0 ? (
          <Card sx={{ textAlign: 'center', p: 4, borderRadius: '12px', border: '1px dashed #ccc' }}>
            <Typography color="textSecondary">No notifications found matching current query bounds.</Typography>
          </Card>
        ) : (
          notifications.map((item) => {
            const isUnread = !viewedIds.has(item.ID);
            return (
              <Card 
                key={item.ID}
                onClick={() => markAsRead(item.ID)}
                elevation={isUnread ? 2 : 0}
                sx={{ 
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isUnread ? '#e0e0e0' : '#f5f5f5',
                  borderLeft: isUnread ? '6px solid #1976d2' : '6px solid #bdbdbd',
                  backgroundColor: isUnread ? '#ffffff' : '#fafafa',
                  transition: '0.2s transform ease-in-out',
                  '&:hover': { transform: 'scale(1.006)' }
                }}
              >
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '16px !important' }}>
                  <Box sx={{ pr: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="caption" fontWeight="bold" color={item.Type === 'Placement' ? 'error.main' : 'primary.main'}>
                        {item.Type.toUpperCase()}
                      </Typography>
                      {isUnread && (
                        <Chip label="NEW" size="small" color="primary" sx={{ height: '16px', fontSize: '9px', fontWeight: 'bold' }} />
                      )}
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: isUnread ? '600' : '400', color: isUnread ? '#212121' : '#616161' }}>
                      {item.Message}
                    </Typography>
                  </Box>
                  {/* Fixed styling rule: whiteSpace placement handled cleanly inside the sx container */}
                  <Typography variant="caption" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
                    {item.Timestamp}
                  </Typography>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
        <Pagination 
          count={5} 
          page={page} 
          onChange={(e, value) => setPage(value)} 
          color="primary" 
          size="medium"
          sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px' } }}
        />
      </Box>
    </Container>
  );
}