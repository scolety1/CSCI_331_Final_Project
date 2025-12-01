// Vercel serverless function to fetch fun facts
export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { month, day } = req.query;

    if (!month || !day) {
      res.status(400).json({ error: 'Month and day are required' });
      return;
    }

    // Parse and validate month and day as integers
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    if (isNaN(monthNum) || isNaN(dayNum)) {
      res.status(400).json({ error: 'Month and day must be valid numbers' });
      return;
    }

    if (monthNum < 1 || monthNum > 12) {
      res.status(400).json({ error: 'Month must be between 1 and 12' });
      return;
    }

    if (dayNum < 1 || dayNum > 31) {
      res.status(400).json({ error: 'Day must be between 1 and 31' });
      return;
    }

    // Use History API (history.muffinlabs.com) - free and reliable
    const apiUrl = `https://history.muffinlabs.com/date/${monthNum}/${dayNum}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      // Return fallback text instead of error
      res.status(200).json({ 
        text: `On ${monthNum}/${dayNum}, many interesting historical events have occurred throughout history!` 
      });
      return;
    }

    const data = await response.json();
    
    // History API returns events in data.data.Events array
    if (data && data.data && data.data.Events && data.data.Events.length > 0) {
      // Get a random event from the list
      const randomEvent = data.data.Events[Math.floor(Math.random() * data.data.Events.length)];
      const year = randomEvent.year;
      const text = randomEvent.text;
      
      res.status(200).json({ 
        text: `On this day in ${year}: ${text}` 
      });
    } else {
      // Fallback if API response format is unexpected
      res.status(200).json({ 
        text: `On ${monthNum}/${dayNum}, many interesting historical events have occurred throughout history!` 
      });
    }
  } catch (error) {
    console.error('Error in funfact handler:', error);
    // Extract month and day for fallback, with defaults
    const monthNum = parseInt(req.query?.month || '1', 10);
    const dayNum = parseInt(req.query?.day || '1', 10);
    
    res.status(200).json({ 
      error: 'Failed to fetch fun fact',
      text: `On ${monthNum}/${dayNum}, many interesting historical events have occurred throughout history!`
    });
  }
}

