import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  socketId: { type: String, required: true, unique: true },
  roles: { type: [String], default: [] },
  userName: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

export default mongoose.model('User', userSchema)

