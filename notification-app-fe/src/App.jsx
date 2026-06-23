import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Card, CardContent, Button, 
  Select, MenuItem, InputLabel, FormControl, Pagination, Box, Chip
} from '@mui/material';

const clientCredentials = {
  email: "pandalapraneeth.23.cse@anits.edu.in",
  name: "Pandala Praneeth",
  rollNo: "A23126510169",
  accessCode: "MTqxar",
  clientID: "3de3df34-edf9-4cd9-8c72-011e8f0f3118",
  clientSecret: "nNbhSEqAQvYNsbdT"
};

async function syncTelemetryLog(logLevel, logPkg, logMsg) {
  try {
    const authResponse = await fetch('/evaluation-service/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientCredentials)
    });
    const authData = await authResponse.json();
    
    // Exact schema matching the instruction guidelines
    await fetch('/evaluation-service/logs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stack: "frontend",
        level: logLevel.toLowerCase(),
        package: logPkg.toLowerCase(), // Restriced to: auth, config, middleware, utils, style
        message: logMsg
      })
    });
  } catch (err) {
    console.warn("Telemetry connection fallback alert:", err.message);
  }
}

const rankingWeights = { 'Placement': 3, 'Result': 2, 'Event': 1 };

export default function App() {
  const [dataFeed, setDataFeed] = useState([]);
  const [feedFilter, setFeedFilter] = useState('all'); 
  const [activeCategory, setActiveCategory] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [openedIds, setOpenedIds] = useState(new Set());
  const [rowLimit, setRowLimit] = useState(10);

  useEffect(() => {
    fetchNotificationData();
  }, [activePage, activeCategory, feedFilter, rowLimit]);

  const fetchNotificationData = async () => {
    try {
      // Uses 'middleware' package value from allowed schema list
      await syncTelemetryLog("info", "middleware", `Query path requested for page view: ${activePage}`);
      
      let targetPath = `/evaluation-service/notifications?page=${activePage}&limit=${rowLimit}`;
      if (activeCategory) {
        targetPath += `&notification_type=${activeCategory}`;
      }

      const tokenRes = await fetch('/evaluation-service/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientCredentials)
      });
      const tokenData = await tokenRes.json();

      const feedRes = await fetch(targetPath, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      
      const jsonResult = await feedRes.json();
      let trackingList = jsonResult.notifications || [];

      if (feedFilter === 'priority') {
        trackingList = trackingList.sort((itemA, itemB) => {
          const rankA = rankingWeights[itemA.Type] || 0;
          const rankB = rankingWeights[itemB.Type] || 0;
          if (rankB !== rankA) return rankB - rankA;
          return new Date(itemB.Timestamp.replace(' ', 'T')) - new Date(itemA.Timestamp.replace(' ', 'T'));
        });
      }

      setDataFeed(trackingList);
    } catch (err) {
      // Uses 'utils' package value from allowed schema list
      await syncTelemetryLog("error", "utils", `Exception processed inside view hook: ${err.message}`);
    }
  };

  const processItemSelection = async (targetId) => {
    setOpenedIds(prevSet => {
      const copySet = new Set(prevSet);
      copySet.add(targetId);
      return copySet;
    });
    // Uses 'middleware' package value from allowed schema list
    await syncTelemetryLog("debug", "middleware", `Interaction update recorded for id: ${targetId}`);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Typography variant="h4" fontWeight="800" letterSpacing="-0.5px" gutterBottom color="primary">
        Campus Notification Core Dashboard
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
        Logged in Session Tracking Profile: <strong>{clientCredentials.rollNo}</strong>
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button 
          variant={feedFilter === 'all' ? 'contained' : 'outlined'} 
          onClick={() => setFeedFilter('all')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          Standard Feed view
        </Button>
        <Button 
          variant={feedFilter === 'priority' ? 'contained' : 'outlined'} 
          color="secondary" 
          onClick={() => setFeedFilter('priority')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          🚨 Critical Priority Inbox
        </Button>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Filter Category</InputLabel>
          <Select 
            value={activeCategory} 
            onChange={(e) => { setActiveCategory(e.target.value); setActivePage(1); }} 
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
            value={rowLimit} 
            onChange={(e) => { setRowLimit(e.target.value); setActivePage(1); }} 
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

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        {dataFeed.length === 0 ? (
          <Card sx={{ textAlign: 'center', p: 4, borderRadius: '12px', border: '1px dashed #ccc' }}>
            <Typography color="textSecondary">No notifications found matching current query bounds.</Typography>
          </Card>
        ) : (
          dataFeed.map((row) => {
            const isUnread = !openedIds.has(row.ID);
            return (
              <Card 
                key={row.ID}
                onClick={() => processItemSelection(row.ID)}
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
                      <Typography variant="caption" fontWeight="bold" color={row.Type === 'Placement' ? 'error.main' : 'primary.main'}>
                        {row.Type.toUpperCase()}
                      </Typography>
                      {isUnread && (
                        <Chip label="NEW" size="small" color="primary" sx={{ height: '16px', fontSize: '9px', fontWeight: 'bold' }} />
                      )}
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: isUnread ? '600' : '400', color: isUnread ? '#212121' : '#616161' }}>
                      {row.Message}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
                    {row.Timestamp}
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
          page={activePage} 
          onChange={(e, val) => setActivePage(val)} 
          color="primary" 
          size="medium"
          sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px' } }}
        />
      </Box>
    </Container>
  );
}