import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import PollController from './controllers/PollController.js'
import UserController from './controllers/UserController.js'
import ChatController from './controllers/ChatController.js'
import PollService from './services/PollService.js'
import UserService from './services/UserService.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/live-polling'
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err)
    // Don't crash the app, but log the error
  })

// Store active participants per poll room
const pollRooms = new Map()

// API Routes for state recovery
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

app.get('/api/polls/active', async (req, res) => {
  try {
    const poll = await PollService.getActivePoll()
    if (!poll) {
      return res.json({ success: false, poll: null })
    }

    const remainingTime = PollService.getRemainingTime(poll)
    res.json({ 
      success: true, 
      poll: poll.toObject(),
      remainingTime
    })
  } catch (error) {
    console.error('Error getting active poll:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

app.get('/api/polls/history', async (req, res) => {
  try {
    const polls = await PollService.getPollHistory()
    res.json(polls)
  } catch (error) {
    console.error('Error getting poll history:', error)
    res.status(500).json({ error: error.message })
  }
})

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Handle role selection
  socket.on('select-roles', async (data) => {
    const result = await UserController.selectRoles(socket, data)
    socket.emit('roles-selected', result)
    if (result.success) {
      console.log(`User ${socket.id} selected roles:`, data.roles)
    }
  })

  // Handle poll creation (for teachers)
  socket.on('create-poll', async (data) => {
    const result = await PollController.createPoll(socket, data)
    socket.emit('poll-created', result)
    
    if (result.success) {
      // Initialize poll room
      pollRooms.set(result.poll._id.toString(), new Map())
      
      // Broadcast new poll to all connected clients
      io.emit('new-poll', result.poll)
    }
  })

  // Handle vote submission (for students)
  socket.on('submit-vote', async (data) => {
    const result = await PollController.submitVote(socket, data)
    socket.emit('vote-submitted', result)
    
    if (result.success) {
      // Broadcast updated poll results
      io.emit('poll-updated', result.poll)
    }
  })

  // Handle get active poll (for state recovery)
  socket.on('get-active-poll', async () => {
    const result = await PollController.getActivePoll(socket)
    socket.emit('active-poll-response', result)
  })

  // Handle joining poll room
  socket.on('join-poll-room', async (data) => {
    try {
      const { pollId, userName } = data
      if (!pollId) {
        socket.emit('error', { message: 'Poll ID is required' })
        return
      }
      
      const poll = await PollService.getPollById(pollId)
      
      if (!poll) {
        socket.emit('error', { message: 'Poll not found' })
        return
      }

      // Normalize pollId to string for consistency
      const normalizedPollId = poll._id.toString()
      socket.join(`poll-${normalizedPollId}`)
      
      // Also join global chat room for continuous chat across all polls
      socket.join('global-chat')
      
      // Get user role
      const user = await UserService.getUserBySocketId(socket.id)
      const userRole = user?.roles?.[0] || 'student'
      
      // Add participant to room with role information
      if (!pollRooms.has(normalizedPollId)) {
        pollRooms.set(normalizedPollId, new Map())
      }
      const room = pollRooms.get(normalizedPollId)
      room.set(socket.id, { userName, socketId: socket.id, role: userRole })
      
      // Filter out teachers from participants list - only show students
      const allParticipants = Array.from(room.values())
      const studentsOnly = allParticipants.filter(p => p.role !== 'teacher')
      
      // Broadcast updated participants list (students only)
      io.to(`poll-${normalizedPollId}`).emit('participants-updated', studentsOnly)
    } catch (error) {
      console.error('Error joining poll room:', error)
      socket.emit('error', { message: 'Error joining poll room' })
    }
  })

  // Handle leaving poll room
  socket.on('leave-poll-room', (data) => {
    const { pollId } = data
    if (!pollId) return
    
    // Normalize pollId to string for consistency
    const normalizedPollId = typeof pollId === 'string' ? pollId : pollId.toString()
    const room = pollRooms.get(normalizedPollId)
    if (room) {
      room.delete(socket.id)
      // Filter out teachers from participants list - only show students
      const allParticipants = Array.from(room.values())
      const studentsOnly = allParticipants.filter(p => p.role !== 'teacher')
      io.to(`poll-${normalizedPollId}`).emit('participants-updated', studentsOnly)
    }
    socket.leave(`poll-${normalizedPollId}`)
  })

  // Handle chat messages - use global chat room
  socket.on('send-chat-message', async (data) => {
    try {
      const result = await ChatController.sendMessage(socket, data)
      
      if (result.success) {
        // Broadcast message to all in global chat room (continuous across all polls)
        io.to('global-chat').emit('chat-message', {
          userName: data.userName,
          message: data.message,
          timestamp: result.message.timestamp
        })
      } else {
        socket.emit('error', { message: result.error || 'Failed to send message' })
      }
    } catch (error) {
      console.error('Error sending chat message:', error)
      socket.emit('error', { message: 'Error sending chat message' })
    }
  })

  // Handle getting chat messages
  socket.on('get-chat-messages', async (data) => {
    try {
      const result = await ChatController.getMessages(socket, data)
      socket.emit('chat-messages-response', result)
    } catch (error) {
      console.error('Error getting chat messages:', error)
      socket.emit('chat-messages-response', { success: false, error: error.message })
    }
  })

  // Handle kicking user
  socket.on('kick-user', async (data) => {
    try {
      const { pollId, socketId } = data
      if (!pollId) return
      
      const user = await UserService.getUserBySocketId(socket.id)
      
      if (!user || !user.roles.includes('teacher')) {
        socket.emit('error', { message: 'Only teachers can kick users' })
        return
      }

      // Normalize pollId to string for consistency
      const normalizedPollId = typeof pollId === 'string' ? pollId : pollId.toString()
      const room = pollRooms.get(normalizedPollId)
      if (room) {
        room.delete(socketId)
        // Filter out teachers from participants list - only show students
        const allParticipants = Array.from(room.values())
        const studentsOnly = allParticipants.filter(p => p.role !== 'teacher')
        io.to(`poll-${normalizedPollId}`).emit('participants-updated', studentsOnly)
      }

      io.to(socketId).emit('user-kicked', { pollId: normalizedPollId })
    } catch (error) {
      console.error('Error kicking user:', error)
    }
  })

  // Handle get poll history
  socket.on('get-poll-history', async () => {
    const result = await PollController.getPollHistory(socket)
    socket.emit('poll-history', result.polls || [])
  })

  // Handle join poll (for viewing active poll)
  socket.on('join-poll', (data) => {
    const { pollId } = data
    socket.join(`poll-${pollId}`)
  })

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id)
    
    // Remove from all poll rooms
    for (const [pollId, room] of pollRooms.entries()) {
      if (room.has(socket.id)) {
        room.delete(socket.id)
        // Filter out teachers from participants list - only show students
        const allParticipants = Array.from(room.values())
        const studentsOnly = allParticipants.filter(p => p.role !== 'teacher')
        io.to(`poll-${pollId}`).emit('participants-updated', studentsOnly)
      }
    }
  })
})

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
