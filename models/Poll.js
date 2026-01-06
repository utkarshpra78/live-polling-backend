import mongoose from 'mongoose'

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String }],
  correctAnswers: [{ type: Number }],
  createdBy: { type: String, required: true },
  timeLimit: { type: Number, default: 60 },
  startTime: { type: Date },
  votes: [{
    userId: String,
    userName: String,
    option: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
})

export default mongoose.model('Poll', pollSchema)

