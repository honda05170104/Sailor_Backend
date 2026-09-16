import mongoose from 'mongoose';

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const dbName = process.env.DB_NAME || 'sailor';

  await mongoose.connect(uri, { dbName });
  console.log(`MongoDB connected: ${dbName}`);
}

export default connectDB;
