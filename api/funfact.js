// Vercel serverless function to fetch fun facts
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { month, day } = req.query;

  if (!month || !day) {
    return res.status(400).json({ error: 'Month and day are required' });
  }

  try {
    const apiUrl = `https://numbersapi.com/${month}/${day}/date?json`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching fun fact:', error);
    res.status(500).json({ 
      error: 'Failed to fetch fun fact',
      text: `On ${month}/${day}, many interesting historical events have occurred throughout history!`
    });
  }
}

