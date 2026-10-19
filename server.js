// import express from 'express';
// import http from 'http';
// import cors from 'cors';
// import bodyParser from 'body-parser';
// import cookieParser from 'cookie-parser';
// import dotenv from 'dotenv';
// import connectDatabase from './db/connectDatabase.js';
// import path from 'path';
// import { fileURLToPath } from 'url';

// import UserRoutes from './Routes/userRoutes.js';
// import vendorRoutes from './Routes/vendorRoutes.js';
// import adminRoutes from './Routes/adminRoutes.js'
// import Message from './Models/Message.js';
// import { Server } from 'socket.io';
// import User from './Models/User.js';
// import cron from 'node-cron';

// import Notification from './Models/Notification.js'; 

// dotenv.config();

// const app = express();
// const server = http.createServer(app);

// // ✅ Socket.IO setup
// const io = new Server(server, {
//   cors: {
//     origin: ['http://localhost:3000', 'https://posterbnaoadmin.vercel.app', 'http://194.164.148.244:3000'],
//     methods: ['GET', 'POST'],
//     credentials: true,
//   },
// });

// // ✅ File path helpers
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ✅ Serve static files
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // ✅ Middleware setup
// app.use(cors({
//   origin: ['http://localhost:3000', 'http://localhost:3001', 'https://posterbnaoadmin.vercel.app', 'http://194.164.148.244:3000', 'http://localhost:3001', 'http://31.97.206.144:3024', 'http://31.97.206.144:3031', 'https://admin.redemly.com', 'https://vendor.redemly.com', 'https://redemlydeleteurl.vercel.app'],
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
//   credentials: true
// }));
// app.options('*', cors());

// app.use(bodyParser.json({ limit: "10mb" }));
// app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(cookieParser());

// // ✅ Connect to MongoDB
// connectDatabase();

// // ✅ Routes
// app.use('/api/users', UserRoutes);
// app.use('/api/vendor', vendorRoutes);
// app.use('/api/admin', adminRoutes);

// // ✅ Default route
// app.get("/", (req, res) => {
//   res.json({
//     status: "success",
//     message: "Welcome to our service!",
//   });
// });

// const onlineUsers = {};  // Keep track of online users by userId

// // ✅ Socket.IO logic
// io.on('connection', (socket) => {
//   console.log('🔌 User connected:', socket.id);

//   // User joins their own room (using their userId)
//   socket.on('join', (userId) => {
//     socket.join(userId); // This will allow us to send messages to the specific user room
//     onlineUsers[userId] = socket.id;  // Track that this user is online using their userId

//     console.log(`User ${userId} joined room`);

//     // Notify others that this user is online
//     socket.broadcast.emit('userOnline', { userId, status: 'online' });

//     // Optionally, send back the current list of online users to the new user
//     socket.emit('onlineUsers', Object.keys(onlineUsers));  // Send the online users to the connecting user
//   });

//   // Handle sending messages
//   socket.on('sendMessage', async ({ senderId, receiverId, text, image }) => {
//     try {
//       // Create a new message, include image if present
//       let newMessage;
//       if (image) {
//         newMessage = await Message.create({ sender: senderId, receiver: receiverId, text, image });
//       } else {
//         newMessage = await Message.create({ sender: senderId, receiver: receiverId, text });
//       }

//       // Emit to receiver if the receiver is online
//       if (onlineUsers[receiverId]) {
//         io.to(onlineUsers[receiverId]).emit('receiveMessage', {
//           _id: newMessage._id,
//           senderId,
//           receiverId,
//           text,
//           image: newMessage.image,  // Send image URL if exists
//           createdAt: newMessage.createdAt,
//         });
//       }

//     } catch (err) {
//       console.error('❌ Error sending message:', err);
//     }
//   });
   

//   // ================= SOCKET.IO NOTIFICATION SYSTEM =================
// const onlineUsers = {}; // Track online users by userId
// const userSockets = {}; // Map userId to socket.id for easy lookup

// io.on('connection', (socket) => {
//   console.log('🔌 User connected:', socket.id);

//   // User joins their own notification room
//   socket.on('joinNotifications', (userId) => {
//     if (!userId) {
//       console.error('❌ No userId provided for joinNotifications');
//       return;
//     }

//     // Join user-specific room for notifications
//     socket.join(`user_${userId}`);
    
//     // Store socket mapping
//     userSockets[userId] = socket.id;
//     onlineUsers[userId] = true;

//     console.log(`📢 User ${userId} joined notification room`);

//     // Send welcome notification (optional)
//     socket.emit('notification', {
//       type: 'system',
//       message: 'Notification system connected',
//       timestamp: new Date()
//     });

//     // Check and send any pending notifications from database
//     emitPendingNotifications(userId);
//   });

//   // User requests notification history
//   socket.on('getNotificationHistory', async (userId) => {
//     try {
//       const notifications = await Notification.find({ 
//         userId, 
//         isRead: false 
//       }).sort({ createdAt: -1 }).limit(20);
      
//       socket.emit('notificationHistory', notifications);
//     } catch (error) {
//       console.error('Error fetching notification history:', error);
//     }
//   });

//   // Mark notification as read
//   socket.on('markAsRead', async ({ notificationId, userId }) => {
//     try {
//       await Notification.findByIdAndUpdate(notificationId, { 
//         isRead: true,
//         readAt: new Date()
//       });
      
//       // Emit update to all user's devices
//       io.to(`user_${userId}`).emit('notificationRead', { notificationId });
//     } catch (error) {
//       console.error('Error marking notification as read:', error);
//     }
//   });

//   // Mark all notifications as read
//   socket.on('markAllAsRead', async (userId) => {
//     try {
//       await Notification.updateMany(
//         { userId, isRead: false },
//         { 
//           isRead: true,
//           readAt: new Date()
//         }
//       );
      
//       io.to(`user_${userId}`).emit('allNotificationsRead');
//     } catch (error) {
//       console.error('Error marking all notifications as read:', error);
//     }
//   });

//   // User disconnects
//   socket.on('disconnect', () => {
//     // Find which user disconnected
//     const disconnectedUserId = Object.keys(userSockets).find(
//       userId => userSockets[userId] === socket.id
//     );

//     if (disconnectedUserId) {
//       delete userSockets[disconnectedUserId];
//       delete onlineUsers[disconnectedUserId];
//       console.log(`📢 User ${disconnectedUserId} disconnected from notifications`);
//     }
//   });
// });

// // Function to emit pending notifications when user connects
// async function emitPendingNotifications(userId) {
//   try {
//     const pendingNotifications = await Notification.find({
//       userId,
//       isRead: false,
//       delivered: { $ne: true } // Only notifications not yet delivered
//     }).sort({ createdAt: -1 }).limit(10);

//     const socketId = userSockets[userId];
//     if (socketId && pendingNotifications.length > 0) {
//       pendingNotifications.forEach(async (notification) => {
//         io.to(socketId).emit('newNotification', {
//           _id: notification._id,
//           title: notification.title,
//           message: notification.message,
//           type: notification.type,
//           vendorId: notification.vendorId,
//           couponId: notification.couponId,
//           metadata: notification.metadata,
//           createdAt: notification.createdAt,
//           isRead: notification.isRead
//         });

//         // Mark as delivered
//         notification.delivered = true;
//         await notification.save();
//       });
//     }
//   } catch (error) {
//     console.error('Error emitting pending notifications:', error);
//   }
// }

// // Make io globally available for controllers
// global.io = io;


//   cron.schedule('0 0 * * *', async () => {
//     try {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0); // Reset time to 12:00 AM
//       const todayStr = today.toISOString();

//       const users = await User.find();

//       for (const user of users) {
//         const alreadyExists = user.steps.some(
//           (step) => new Date(step.date).getTime() === today.getTime()
//         );

//         if (!alreadyExists) {
//           const day = today.toLocaleDateString('en-US', { weekday: 'long' });

//           user.steps.push({
//             date: todayStr,
//             day,
//             stepsCount: 0,
//             distance: 0,
//             kcal: 0,
//             timeSpent: '0m'
//           });

//           await user.save();
//         }
//       }

//       console.log("✅ [Cron] Step data initialized for all users at 12:00 AM.");
//     } catch (err) {
//       console.error("❌ [Cron Error] Failed to reset daily step data:", err.message);
//     }
//   });

//   // Handle user disconnecting
//   socket.on('disconnect', () => {
//     // Find which user disconnected
//     const disconnectedUserId = Object.keys(onlineUsers).find(userId => onlineUsers[userId] === socket.id);

//     if (disconnectedUserId) {
//       delete onlineUsers[disconnectedUserId];  // Remove the user from the online users list
//       console.log(`User ${disconnectedUserId} disconnected`);

//       // Notify others that this user is offline
//       socket.broadcast.emit('userOffline', { userId: disconnectedUserId, status: 'offline' });
//     }
//   });
// });


// // ✅ Start the server
// const PORT = process.env.PORT || 6098;

// server.listen(PORT)
//   .on("error", (err) => {
//     if (err.code === "EADDRINUSE") {
//       console.error(`❌ Port ${PORT} is already in use`);
//       process.exit(1);
//     }
//   })
//   .on("listening", () => {
//     console.log(`🚀 Server running on port ${PORT}`);
//   });



import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDatabase from './db/connectDatabase.js';
import path from 'path';
import { fileURLToPath } from 'url';

import UserRoutes from './Routes/userRoutes.js';
import vendorRoutes from './Routes/vendorRoutes.js';
import adminRoutes from './Routes/adminRoutes.js';
import Message from './Models/Message.js';
import { Server } from 'socket.io';
import User from './Models/User.js';
import cron from 'node-cron';
import Notification from './Models/Notification.js';
import dns from 'node:dns';

dotenv.config();

dns.setServers(['1.1.1.1', '1.0.0.1']);

const app = express();
const server = http.createServer(app);

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://posterbnaoadmin.vercel.app', 'http://194.164.148.244:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ✅ File path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Middleware setup
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://posterbnaoadmin.vercel.app', 'http://194.164.148.244:3000', 'http://localhost:3001', 'http://31.97.206.144:3024', 'http://31.97.206.144:3031', 'https://admin.redemly.com', 'https://vendor.redemly.com', 'https://redemlydeleteurl.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true
}));
app.options('*', cors());

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// ✅ Track online users (MOVED to global scope - FIX #1)
const onlineUsers = {};
const userSockets = {};

// ✅ Socket.IO logic (SINGLE connection handler - FIX #2)
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // User joins chat room
  socket.on('join', (userId) => {
    socket.join(userId);
    onlineUsers[userId] = socket.id;
    console.log(`User ${userId} joined room`);
    socket.broadcast.emit('userOnline', { userId, status: 'online' });
    socket.emit('onlineUsers', Object.keys(onlineUsers));
  });

  // User joins notification room
  socket.on('joinNotifications', (userId) => {
    if (!userId) {
      console.error('❌ No userId provided for joinNotifications');
      return;
    }

    socket.join(`user_${userId}`);
    userSockets[userId] = socket.id;
    console.log(`📢 User ${userId} joined notification room`);

    socket.emit('notification', {
      type: 'system',
      message: 'Notification system connected',
      timestamp: new Date()
    });

    emitPendingNotifications(userId);
  });

  // Handle sending messages
  socket.on('sendMessage', async ({ senderId, receiverId, text, image }) => {
    try {
      let newMessage;
      if (image) {
        newMessage = await Message.create({ sender: senderId, receiver: receiverId, text, image });
      } else {
        newMessage = await Message.create({ sender: senderId, receiver: receiverId, text });
      }

      if (onlineUsers[receiverId]) {
        io.to(onlineUsers[receiverId]).emit('receiveMessage', {
          _id: newMessage._id,
          senderId,
          receiverId,
          text,
          image: newMessage.image,
          createdAt: newMessage.createdAt,
        });
      }
    } catch (err) {
      console.error('❌ Error sending message:', err);
    }
  });

  // User requests notification history
  socket.on('getNotificationHistory', async (userId) => {
    try {
      const notifications = await Notification.find({
        userId,
        isRead: false
      }).sort({ createdAt: -1 }).limit(20);
      
      socket.emit('notificationHistory', notifications);
    } catch (error) {
      console.error('Error fetching notification history:', error);
    }
  });

  // Mark notification as read
  socket.on('markAsRead', async ({ notificationId, userId }) => {
    try {
      await Notification.findByIdAndUpdate(notificationId, {
        isRead: true,
        readAt: new Date()
      });
      
      io.to(`user_${userId}`).emit('notificationRead', { notificationId });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  });

  // Mark all notifications as read
  socket.on('markAllAsRead', async (userId) => {
    try {
      await Notification.updateMany(
        { userId, isRead: false },
        {
          isRead: true,
          readAt: new Date()
        }
      );
      
      io.to(`user_${userId}`).emit('allNotificationsRead');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  });

  // Handle user disconnecting
  socket.on('disconnect', () => {
    // Remove from chat online users
    const disconnectedChatUserId = Object.keys(onlineUsers).find(
      userId => onlineUsers[userId] === socket.id
    );

    if (disconnectedChatUserId) {
      delete onlineUsers[disconnectedChatUserId];
      console.log(`User ${disconnectedChatUserId} disconnected from chat`);
      socket.broadcast.emit('userOffline', { userId: disconnectedChatUserId, status: 'offline' });
    }

    // Remove from notification users
    const disconnectedNotifUserId = Object.keys(userSockets).find(
      userId => userSockets[userId] === socket.id
    );

    if (disconnectedNotifUserId) {
      delete userSockets[disconnectedNotifUserId];
      console.log(`📢 User ${disconnectedNotifUserId} disconnected from notifications`);
    }
  });
});

// Function to emit pending notifications when user connects
async function emitPendingNotifications(userId) {
  try {
    const pendingNotifications = await Notification.find({
      userId,
      isRead: false,
      delivered: { $ne: true }
    }).sort({ createdAt: -1 }).limit(10);

    const socketId = userSockets[userId];
    if (socketId && pendingNotifications.length > 0) {
      for (const notification of pendingNotifications) {
        io.to(socketId).emit('newNotification', {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          vendorId: notification.vendorId,
          couponId: notification.couponId,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
          isRead: notification.isRead
        });

        notification.delivered = true;
        await notification.save();
      }
    }
  } catch (error) {
    console.error('Error emitting pending notifications:', error);
  }
}

// Make io globally available for controllers
global.io = io;

// ✅ Cron job for daily step reset
cron.schedule('0 0 * * *', async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const users = await User.find();

    for (const user of users) {
      const alreadyExists = user.steps.some(
        (step) => new Date(step.date).getTime() === today.getTime()
      );

      if (!alreadyExists) {
        const day = today.toLocaleDateString('en-US', { weekday: 'long' });

        user.steps.push({
          date: todayStr,
          day,
          stepsCount: 0,
          distance: 0,
          kcal: 0,
          timeSpent: '0m'
        });

        await user.save();
      }
    }

    console.log("✅ [Cron] Step data initialized for all users at 12:00 AM.");
  } catch (err) {
    console.error("❌ [Cron Error] Failed to reset daily step data:", err.message);
  }
});

// ✅ Function to start server after database connection
const startServer = async () => {
  try {
    // Connect to database first
    console.log('🔄 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Routes (only after DB is connected)
    app.use('/api/users', UserRoutes);
    app.use('/api/vendor', vendorRoutes);
    app.use('/api/admin', adminRoutes);

    // Default route
    app.get("/", (req, res) => {
      res.json({
        status: "success",
        message: "Welcome to our service!",
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('❌ Error:', err.message);
      res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
      });
    });

    // Start server
    const PORT = process.env.PORT || 6098;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();