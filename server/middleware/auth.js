const { auth } = require('../lib/firebase');

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if the request has a Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the token with Firebase
    const decodedToken = await auth.verifyIdToken(token);
    
    // Attach the user's ID and email to the request so the backend knows who they are
    req.uid = decodedToken.uid;
    req.email = decodedToken.email;
    
    next(); // Pass them through to the route
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};

module.exports = { requireAuth };