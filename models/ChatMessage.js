import mongoose from 'mongoose'

const chatMessageSchema = new mongoose.Schema({
  pollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: false },
  userName: { type: String, required: true },
  message: { type: String, required: true },
  socketId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
})

export default mongoose.model('ChatMessage', chatMessageSchema)

