import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Card, CardContent, Button, 
  Select, MenuItem, InputLabel, FormControl, Pagination, Box, Chip
} from '@mui/material';

const authConfig = {
  email: "pandalapraneeth.23.cse@anits.edu.in",
  name: "Pandala Praneeth",
  rollNo: "A23126510169",
  accessCode: "MTqxar",
  clientID: "3de3df34-edf9-4cd9-8c72-011e8f0f3118",
  clientSecret: "nNbhSEqAQvYNsbdT"
};

async function saveLogData(level, origin, msg) {
  try {
    const tokenResponse = await fetch('/evaluation-service/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authConfig)
    });
    const authPayload = await tokenResponse.json();
    
    await fetch('/evaluation-service/logs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authPayload.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level: level.toLowerCase(),
        message: `[${origin.toUpperCase()}] ${msg}`,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn("Fallback logging notice:", err.message);
  }
}

const priorityScores = { 'Placement': 3, 'Result': 2, 'Event': 1 };

export default function App() {
  const [items, setItems] = useState([]);
  const [currentTab, setCurrentTab] = useState('all'); 
  const [selectedType, setSelectedType] = useState('');
  const [pageIndex, setPageIndex] = useState(1);
  const [readIds, setReadIds] = useState(new Set());
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadNotificationData();
  }, [pageIndex, selectedType, currentTab, pageSize]);

  const loadNotificationData = async () => {
    try {
      await saveLogData("info", "frontend", `API request fired for page: ${pageIndex}`);
      
      let endpoint = `/evaluation-service/notifications?page=${pageIndex}&limit=${pageSize}`;
      if (selectedType) {
        endpoint += `&notification_type=${selectedType}`;
      }

      const loginRes = await fetch('/evaluation-service/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authConfig)
      });
      const loginData = await loginRes.json();

      const dataRes = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${loginData.access_token}` }
      });
      
      const parsedJSON = await dataRes.json();
      let rawList = parsedJSON.notifications || [];

      if (currentTab === 'priority') {
        rawList = rawList.sort((first, second) => {
          const rankFirst = priorityScores[first.Type] || 0;
          const rankSecond = priorityScores[second.Type] || 0;
          if (rankSecond !== rankFirst) return rankSecond - rankFirst;
          return new Date(second.Timestamp.replace(' ', 'T')) - new Date(first.Timestamp.replace(' ', 'T'));
        });
      }

      setItems(rawList);
    } catch (err) {
      await saveLogData("error", "component", `Caught boundary exception: ${err.message}`);
    }
  };

  const updateReadState = async (targetId) => {
    setReadIds(previousSet => {
      const copySet = new Set(previousSet);
      copySet.add(targetId);
      return copySet;
    });
    await saveLogData("debug", "state", `Notification checked: ${targetId}`);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Typography variant="h4" fontWeight="800" letterSpacing="-0.5px" gutterBottom color="primary">
        Campus Notification Core Dashboard
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
        Logged in Session Tracking Profile: <strong>{authConfig.rollNo}</strong>
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button 
          variant={currentTab === 'all' ? 'contained' : 'outlined'} 
          onClick={() => setCurrentTab('all')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          Standard Feed view
        </Button>
        <Button 
          variant={currentTab === 'priority' ? 'contained' : 'outlined'} 
          color="secondary" 
          onClick={() => setCurrentTab('priority')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
           Critical Priority Inbox
        </Button>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Filter Category</InputLabel>
          <Select 
            value={selectedType} 
            onChange={(e) => { setSelectedType(e.target.value); setPageIndex(1); }} 
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
            value={pageSize} 
            onChange={(e) => { setPageSize(e.target.value); setPageIndex(1); }} 
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
        {items.length === 0 ? (
          <Card sx={{ textAlign: 'center', p: 4, borderRadius: '12px', border: '1px dashed #ccc' }}>
            <Typography color="textSecondary">No notifications found matching current query bounds.</Typography>
          </Card>
        ) : (
          items.map((row) => {
            const isUnread = !readIds.has(row.ID);
            return (
              <Card 
                key={row.ID}
                onClick={() => updateReadState(row.ID)}
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
          page={pageIndex} 
          onChange={(e, val) => setPageIndex(val)} 
          color="primary" 
          size="medium"
          sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px' } }}
        />
      </Box>
    </Container>
  );
}