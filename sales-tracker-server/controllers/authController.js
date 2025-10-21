const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userQueries = require('../queries/userQueries');

// Register new user
const register = async (req, res) => {
  console.log('📝 Register endpoint hit');
  console.log('Request body:', req.body);

  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      console.log('❌ Validation failed: missing required fields');
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    console.log('✓ Input validated');

    // Check if user already exists
    console.log('🔍 Checking if user exists...');
    const existingUser = await userQueries.getUserByEmail(email);
    console.log('✓ User check complete:', existingUser ? 'User exists' : 'User does not exist');

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if email should be auto-promoted to admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const shouldBeAdmin = adminEmails.includes(email.toLowerCase());
    
    // Create user
    const newUser = await userQueries.createUser({
      name,
      email,
      password: hashedPassword,
      role: shouldBeAdmin ? 'admin' : (role || 'admin')
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      },
      process.env.SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user by email
    const user = await userQueries.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
};

module.exports = {
  register,
  login
};

