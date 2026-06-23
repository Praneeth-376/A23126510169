import React, { useState, useEffect } from 'react';
import { 
  Container, Typography, Card, CardContent, Button, 
  Select, MenuItem, InputLabel, FormControl, Pagination, Box, Chip
} from '@mui/material';

// RESTORED: Exact lowercase strings matching your verified token profiles
const accountProfile = {
  email: "pandalapraneeth.23.cse@anits.edu.in",
  name: "Pandala Praneeth",
  rollNo: "A23126510169",
  accessCode: "MTqxar",
  clientID: "3de3df34-edf9-4cd9-8c72-011e8f0f3118",
  clientSecret: "nNbhSEqAQvYNsbdT"
};

async function transmitServerLog(sessionToken, severity, componentGroup, logText) {
  try {
    if (!sessionToken) return;
    
    await fetch('/evaluation-service/logs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stack: "frontend", // FIXED: Changed back to frontend to match your successful Postman test
        level: severity.toLowerCase(),
        package: componentGroup.toLowerCase(), 
        message: logText
      })
    });
  } catch (err) {
    console.warn("Log stream dropped:", err.message);
  }
}

const severityWeights = { 'Placement': 3, 'Result': 2, 'Event': 1 };

export default function App() {
  const [feedItems, setFeedItems] = useState([]);
  const [viewScope, setViewScope] = useState('all'); 
  const [typeSelection, setTypeSelection] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openedItemIds, setOpenedItemIds] = useState(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadNotificationFeed();
  }, [currentPage, typeSelection, viewScope, itemsPerPage]);

  const loadNotificationFeed = async () => {
    try {
      const loginResponse = await fetch('/evaluation-service/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountProfile)
      });
      const authJSON = await loginResponse.json();
      const activeToken = authJSON.access_token;

      await transmitServerLog(activeToken, "info", "middleware", `Data load request triggered for page index: ${currentPage}`);
      
      let queryUrl = `/evaluation-service/notifications?page=${currentPage}&limit=${itemsPerPage}`;
      if (typeSelection) {
        queryUrl += `&notification_type=${typeSelection}`;
      }

      const streamResponse = await fetch(queryUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      
      const parsedData = await streamResponse.json();
      let orderedList = parsedData.notifications || [];

      if (viewScope === 'priority') {
        orderedList = orderedList.sort((rowX, rowY) => {
          const scoreX = severityWeights[rowX.Type] || 0;
          const scoreY = severityWeights[rowY.Type] || 0;
          if (scoreY !== scoreX) return scoreY - scoreX;
          return new Date(rowY.Timestamp.replace(' ', 'T')) - new Date(rowX.Timestamp.replace(' ', 'T'));
        });
      }

      setFeedItems(orderedList);
    } catch (err) {
      console.error("Dashboard processing failure:", err.message);
    }
  };

  const handleCardInteraction = async (targetId) => {
    setOpenedItemIds(prevSet => {
      const freshSet = new Set(prevSet);
      freshSet.add(targetId);
      return freshSet;
    });

    try {
      const loginResponse = await fetch('/evaluation-service/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountProfile)
      });
      const authJSON = await loginResponse.json();
      await transmitServerLog(authJSON.access_token, "info", "middleware", `Notification card checked: ${targetId}`);
    } catch (e) {
      console.warn("Interaction tracking skipped:", e.message);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
      <Typography variant="h4" fontWeight="800" letterSpacing="-0.5px" gutterBottom color="primary">
        Campus Notification Core Dashboard
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
        Logged in Session Tracking Profile: <strong>{accountProfile.rollNo}</strong>
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button 
          variant={viewScope === 'all' ? 'contained' : 'outlined'} 
          onClick={() => setViewScope('all')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          Standard Feed view
        </Button>
        <Button 
          variant={viewScope === 'priority' ? 'contained' : 'outlined'} 
          color="secondary" 
          onClick={() => setViewScope('priority')}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
        >
          🚨 Critical Priority Inbox
        </Button>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Filter Category</InputLabel>
          <Select 
            value={typeSelection} 
            onChange={(e) => { setTypeSelection(e.target.value); setCurrentPage(1); }} 
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
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(e.target.value); setCurrentPage(1); }} 
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
        {feedItems.length === 0 ? (
          <Card sx={{ textAlign: 'center', p: 4, borderRadius: '12px', border: '1px dashed #ccc' }}>
            <Typography color="textSecondary">No notifications found matching current query bounds.</Typography>
          </Card>
        ) : (
          feedItems.map((row) => {
            const isUnread = !openedItemIds.has(row.ID);
            return (
              <Card 
                key={row.ID}
                onClick={() => handleCardInteraction(row.ID)}
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
          page={currentPage} 
          onChange={(e, val) => setCurrentPage(val)} 
          color="primary" 
          size="medium"
          sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px' } }}
        />
      </Box>
    </Container>
  );
}