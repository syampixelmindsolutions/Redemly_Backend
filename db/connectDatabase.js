import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;
let connectionPromise = null;

const connectDatabase = async () => {
  // ✅ If already connected, return immediately
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('✅ Database already connected');
    return mongoose.connection;
  }

  // ✅ If connection is in progress, wait for it
  if (connectionPromise) {
    console.log('⏳ Waiting for existing connection...');
    return connectionPromise;
  }

  // Get MongoDB URI
  const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;
  
  if (!mongoURI) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  console.log('🔄 Connecting to MongoDB...');
  console.log('📡 Using URI:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
  
  // ✅ Create new connection only if none exists
  connectionPromise = mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000, // Faster feedback on connection issues
    socketTimeoutMS: 45000,
  })
  .then(() => {
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    connectionPromise = null;
    return mongoose.connection;
  })
  .catch((error) => {
    console.error('❌ MongoDB Connection Error:', error.message);
    connectionPromise = null;
    isConnected = false;
    throw error;
  });

  return connectionPromise;
};

// ✅ Handle connection events (only set once)
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
  isConnected = true;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
  isConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
  isConnected = false;
});

export default connectDatabase;