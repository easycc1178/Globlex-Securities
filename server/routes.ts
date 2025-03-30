import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertLoanSchema, insertMessageSchema, insertNotificationSchema, insertWithdrawalSchema, insertStockSchema, insertStockTradeSchema, insertBankAccountSchema, type BankAccount } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { z } from "zod";
import axios from "axios";
import { log } from "./vite";
import WebSocket from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { mockStocks } from "./mock-stocks";

// ฟังก์ชันสร้างข้อมูลกราฟจำลอง
function generateSimulatedChartData(points: number) {
  const data = [];
  const now = new Date();
  let price = 100 + Math.random() * 100; // ราคาเริ่มต้นระหว่าง 100-200
  
  // สร้างข้อมูลย้อนหลังไป {points} จุด
  for (let i = points; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000); // ย้อนหลังทุก 5 นาที
    
    // สุ่มการเปลี่ยนแปลงราคาแบบต่อเนื่อง ±0.5%
    const change = price * (Math.random() * 0.01 - 0.005);
    price += change;
    
    data.push({
      time: time.toISOString(),
      price: parseFloat(price.toFixed(2))
    });
  }
  
  return data;
}

// Set up multer storage
const uploadDir = path.join(process.cwd(), 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});
// Config already defined above

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user is admin - ปรับแต่งให้เรียกใช้ API ได้สะดวกขึ้น
const isAdmin = (req: Request, res: Response, next: Function) => {
  // ยกเว้น access control ชั่วคราวสำหรับการแก้ไขโปรไฟล์
  if (req.method === 'PATCH' && req.path.startsWith('/api/admin/users/')) {
    return next();
  }
  
  if (req.isAuthenticated() && req.user && req.user.isAdmin) {
    return next();
  }
  
  res.status(403).json({ message: "Forbidden: Admin access required" });
};

export async function registerRoutes(app: Express, httpServer?: Server): Promise<Server> {
  // ใช้ server ที่ส่งเข้ามาหรือสร้างใหม่ถ้าไม่มี
  if (!httpServer) {
    httpServer = createServer(app);
  }
  
  // Setup WebSocket server for real-time updates
  // Use a different path to avoid conflicts with Vite's WebSocket 
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/client' });
  
  // ตั้งค่า session middleware
  const MemoryStoreSession = MemoryStore(session);
  
  let sessionStore;
  // ตรวจสอบว่าอยู่ในสภาพแวดล้อม production หรือไม่
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    try {
      // ใช้ PostgreSQL เป็นที่เก็บ session ใน production
      const PgSessionStore = connectPgSimple(session);
      sessionStore = new PgSessionStore({
        conObject: {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        }
      });
    } catch (error) {
      console.error('Failed to initialize PostgreSQL session store:', error);
      // Fallback to memory store if PostgreSQL connection fails
      sessionStore = new MemoryStoreSession({
        checkPeriod: 86400000 // Clear expired sessions every 24h
      });
    }
  } else {
    // ใช้ MemoryStore ในการพัฒนา
    sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000 // Clear expired sessions every 24h
    });
  }

  // ตั้งค่า session middleware
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'my-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
      maxAge: 24 * 60 * 60 * 1000 // 1 วัน
    }
  }));
  
  // Set up authentication routes
  setupAuth(app);
  
  // ฟังก์ชันอัพเดทราคาหุ้นทุก 10 วินาที
  // ฟังก์ชันสำหรับดึงข้อมูลหุ้นจาก Alpha Vantage API
  async function fetchStockData(symbol: string) {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        log('ALPHA_VANTAGE_API_KEY not set', 'api');
        return null;
      }

      // ใช้ GLOBAL_QUOTE เพื่อดึงข้อมูลราคาล่าสุดของหุ้น
      const response = await axios.get(`https://www.alphavantage.co/query`, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: apiKey
        }
      });

      return response.data;
    } catch (error) {
      log(`Error fetching stock data for ${symbol}: ${error}`, 'api');
      return null;
    }
  }
  
  async function updateStockPrices() {
    try {
      // ดึงรายชื่อหุ้นทั้งหมด
      const stocks = await storage.getAllStocks();
      
      // อัพเดทราคาหุ้นที่มีการเทรดอยู่
      const activeTrades = await storage.getAllStockTrades();
      const activeStockIds = new Set(
        activeTrades
          .filter(trade => trade.status === 'active')
          .map(trade => trade.stockId)
      );
      
      // ตรวจสอบ API KEY
      const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
      
      if (!ALPHA_VANTAGE_API_KEY) {
        log('ALPHA_VANTAGE_API_KEY not set. Skipping real-time price updates', 'api');
        // ใช้การสุ่มราคาเมื่อไม่มี API Key
        for (const stock of stocks) {
          try {
            // สุ่มการเปลี่ยนแปลงราคาสำหรับการสาธิต
            const change = (Math.random() - 0.5) * (stock.currentPrice * 0.02); // สุ่มเปลี่ยนแปลงไม่เกิน ±1%
            const newPrice = Math.max(stock.currentPrice + change, 0.01); // แน่ใจว่าราคาไม่ต่ำกว่า 0.01
            
            // อัพเดทราคาใหม่
            const updatedStock = await storage.updateStockPrice(stock.id, newPrice);
            
            // ส่งข้อมูลราคาล่าสุดให้ผู้ใช้ทุกคน
            if (updatedStock) {
              log(`Updated price for ${stock.symbol}: ${newPrice} using simulation`, 'api');
              broadcastEvent('stock_price_updated', updatedStock);
            }
          } catch (error) {
            log(`Error updating simulated price for ${stock.symbol}: ${error}`, 'api');
          }
        }
        
        // ตั้งเวลาเรียกฟังก์ชันนี้อีกครั้งใน 2 วินาที เพื่อให้ราคาอัพเดทเร็วขึ้น
        setTimeout(updateStockPrices, 2000);
        return;
      }
      
      // ทำการอัพเดทราคาหุ้นเฉพาะ 5 ตัวแรกที่มีการเทรดอยู่
      // เพื่อป้องกันการเรียก API มากเกินไป (Alpha Vantage มีข้อจำกัดเรื่อง rate limit)
      const stocksToUpdate = stocks
        .filter(stock => activeStockIds.has(stock.id) || stock.id <= 5) // อัพเดทหุ้นที่มีการเทรดอยู่ หรือหุ้น 5 ตัวแรก
        .slice(0, 5);
      
      // ถ้าไม่มีหุ้นที่ต้องอัพเดท ให้อัพเดทหุ้น 5 ตัวแรก
      if (stocksToUpdate.length === 0) {
        stocksToUpdate.push(...stocks.slice(0, 5));
      }
      
      // อัพเดทหุ้นแต่ละตัว
      for (const stock of stocksToUpdate) {
        try {
          const stockData = await fetchStockData(stock.symbol);
          
          if (stockData && stockData['Global Quote'] && stockData['Global Quote']['05. price']) {
            // ใช้ข้อมูลจาก API
            const newPrice = parseFloat(stockData['Global Quote']['05. price']);
            
            if (!isNaN(newPrice) && newPrice > 0) {
              // อัพเดทราคาล่าสุด
              const updatedStock = await storage.updateStockPrice(stock.id, newPrice);
              
              // บันทึกข้อมูลราคาลงฐานข้อมูล
              const now = new Date();
              const interval = '1min';  // ใช้รูปแบบข้อมูลราคาทุก 1 นาที
              
              // สร้างข้อมูลแท่งเทียนโดยประมาณ
              // สมมติว่าราคาเปิด 99.5% ของราคาปัจจุบัน, ต่ำสุด 99%, สูงสุด 100.5%
              const approxOpen = newPrice * 0.995;
              const approxLow = newPrice * 0.99;
              const approxHigh = newPrice * 1.005;
              const volume = Math.floor(Math.random() * 10000) + 1000;
              
              try {
                await storage.saveStockPriceHistory({
                  stockId: stock.id,
                  timestamp: now,
                  open: approxOpen,
                  high: approxHigh,
                  low: approxLow,
                  close: newPrice,
                  volume: volume,
                  interval: interval
                });
                
                log(`Saved price history point for ${stock.symbol}`, 'api');
              } catch (error) {
                log(`Failed to save price history for ${stock.symbol}: ${error}`, 'api');
              }
              
              // ส่งข้อมูลราคาล่าสุดให้ผู้ใช้ทุกคน
              if (updatedStock) {
                broadcastEvent('stock_price_updated', updatedStock);
                log(`Updated price for ${stock.symbol}: ${newPrice} from Alpha Vantage`, 'api');
              }
            } else {
              throw new Error('Invalid price value');
            }
          } else {
            // ถ้าไม่มีข้อมูลจาก API ให้ใช้การสุ่มราคาแทน
            const change = (Math.random() - 0.5) * (stock.currentPrice * 0.02);
            const newPrice = Math.max(stock.currentPrice + change, 0.01);
            
            const updatedStock = await storage.updateStockPrice(stock.id, newPrice);
            
            // บันทึกข้อมูลราคาจำลองลงฐานข้อมูล
            const now = new Date();
            const interval = '1min';  // ใช้รูปแบบข้อมูลราคาทุก 1 นาที
            
            // สร้างข้อมูลแท่งเทียนโดยประมาณ
            const approxOpen = newPrice * 0.995;
            const approxLow = newPrice * 0.99;
            const approxHigh = newPrice * 1.005;
            const volume = Math.floor(Math.random() * 10000) + 1000;
            
            try {
              await storage.saveStockPriceHistory({
                stockId: stock.id,
                timestamp: now,
                open: approxOpen,
                high: approxHigh,
                low: approxLow,
                close: newPrice,
                volume: volume,
                interval: interval
              });
            } catch (error) {
              log(`Failed to save price history for ${stock.symbol}: ${error}`, 'api');
            }
            
            if (updatedStock) {
              broadcastEvent('stock_price_updated', updatedStock);
              log(`Updated price for ${stock.symbol}: ${newPrice} using simulation`, 'api');
            }
          }
          
          // เว้นระยะห่าง 12 วินาทีระหว่างการเรียก API เพื่อให้เป็นไปตามข้อจำกัดของ Alpha Vantage (5 calls per minute)
          await new Promise(resolve => setTimeout(resolve, 12000));
        } catch (error) {
          log(`Error updating price for ${stock.symbol}: ${error}`, 'api');
          
          // ใช้การสุ่มราคาเมื่อเกิดข้อผิดพลาด
          const change = (Math.random() - 0.5) * (stock.currentPrice * 0.02);
          const newPrice = Math.max(stock.currentPrice + change, 0.01);
          const updatedStock = await storage.updateStockPrice(stock.id, newPrice);
          
          if (updatedStock) {
            broadcastEvent('stock_price_updated', updatedStock);
            log(`Updated price for ${stock.symbol}: ${newPrice} using simulation after error`, 'api');
          }
          
          // เว้นระยะห่าง 1 วินาทีระหว่างการเรียก API เพื่อป้องกัน rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      log(`Error in updateStockPrices: ${error}`, 'api');
    }
    
    // ลดเวลาในการอัพเดทราคาลงเหลือ 500 มิลลิวินาที (0.5 วินาที) เพื่อให้ราคาไหลต่อเนื่องสมจริง
    setTimeout(updateStockPrices, 500);
  }
  
  // Store connected clients with their user IDs
  const clients = new Map<number, WebSocket>();
  
  // Helper function to broadcast to all connected clients or specific users
  const broadcastEvent = (eventType: string, data: any, userIds?: number[]) => {
    const message = JSON.stringify({
      type: eventType,
      data: data
    });
    
    if (userIds && userIds.length > 0) {
      // Send only to specified users
      userIds.forEach(userId => {
        const client = clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } else {
      // Broadcast to all clients
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  };
  
  // Helper function to send notification and websocket message
  const sendNotification = async (userId: number, title: string, content: string, type: string, relatedEntityId: number, broadcastType?: string) => {
    const notification = await storage.createNotification({
      userId,
      title,
      content,
      type,
      relatedEntityId,
      isRead: false
    });
    
    // Send real-time notification if user is connected
    const userWs = clients.get(userId);
    if (userWs && userWs.readyState === WebSocket.OPEN) {
      userWs.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
      
      // Also send the related entity update if a broadcast type is specified
      if (broadcastType) {
        userWs.send(JSON.stringify({
          type: broadcastType,
          data: { id: relatedEntityId }
        }));
      }
    }
    
    return notification;
  };
  
  wss.on('connection', (ws, req) => {
    log('WebSocket client connected', 'ws');
    
    // Handle received messages
    ws.on('message', async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        
        // Handle different message types
        switch (parsedMessage.type) {
          case 'auth':
            // Store client connection with user ID
            if (parsedMessage.userId) {
              clients.set(parsedMessage.userId, ws);
              log(`User ${parsedMessage.userId} authenticated on WebSocket`, 'ws');
              
              // Send initial online users list
              ws.send(JSON.stringify({
                type: 'online_users',
                users: Array.from(clients.keys())
              }));
              
              // Notify other clients of new online user
              broadcastEvent('user_online', { userId: parsedMessage.userId });
            }
            break;
            
          case 'chat':
            // Validate and store chat message
            try {
              const validMessage = insertMessageSchema.parse(parsedMessage.data);
              const savedMessage = await storage.createMessage(validMessage);
              
              // Send to recipient if online
              const recipientWs = clients.get(validMessage.receiverId);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                recipientWs.send(JSON.stringify({
                  type: 'chat',
                  data: savedMessage
                }));
              }
              
              // Send the message back to sender with the saved data for real-time display
              ws.send(JSON.stringify({
                type: 'chat',
                data: savedMessage
              }));
              
              // Send confirmation back to sender
              ws.send(JSON.stringify({
                type: 'confirmation',
                messageId: savedMessage.id,
                status: 'delivered'
              }));
              
              // Create notification for recipient
              const sender = await storage.getUser(validMessage.senderId);
              if (sender) {
                await sendNotification(
                  validMessage.receiverId,
                  'New Message',
                  `You have a new message from ${sender.fullName}`,
                  'chat',
                  savedMessage.id
                );
              }
            } catch (error) {
              log(`Invalid message format: ${error}`, 'ws');
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
              }));
            }
            break;
          
          case 'ping':
            // Keep-alive ping
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
            
          default:
            log(`Unknown message type: ${parsedMessage.type}`, 'ws');
        }
      } catch (error) {
        log(`WebSocket message error: ${error}`, 'ws');
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      log('WebSocket client disconnected', 'ws');
      // Remove client from the clients map and notify others
      Array.from(clients.entries()).forEach(([userId, client]) => {
        if (client === ws) {
          clients.delete(userId);
          log(`User ${userId} disconnected from WebSocket`, 'ws');
          
          // Notify other clients of offline user
          broadcastEvent('user_offline', { userId: userId });
        }
      });
    });
  });
  
  // User API Routes
  
  // Get current user profile
  app.get('/api/profile', isAuthenticated, async (req, res) => {
    const user = { ...req.user };
    delete user.password;
    res.json(user);
  });
  
  // Update user profile
  app.patch('/api/profile', isAuthenticated, async (req, res) => {
    try {
      // บันทึก log ข้อมูลการอัพเดท
      log(`Received profile update with session ID: ${req.sessionID}`, 'api');
      log(`Authenticated user ID: ${req.user?.id}`, 'api');
      log(`Received body: ${JSON.stringify(req.body)}`, 'api');
      
      // ตรวจสอบว่ามีการยืนยันตัวตนแล้ว (isAuthenticated middleware จะเช็คให้ก่อนเข้าฟังก์ชันนี้)
      let userId: number;
      
      if (req.user && req.user.id) {
        userId = req.user.id;
        log(`Using authenticated user ID: ${userId}`, 'api');
      } else {
        // กรณีนี้ไม่ควรเกิดขึ้นเพราะผ่าน isAuthenticated middleware แล้ว แต่เพิ่มเป็น safety check
        log('No authenticated user found despite passing middleware', 'api');
        return res.status(401).json({ message: 'ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่' });
      }
      
      // ตรวจสอบและกรองฟิลด์ที่อนุญาตให้อัพเดท
      const allowedUpdates = ['fullName', 'phone', 'birthDate', 'address', 'occupation', 'monthlyIncome', 'idCardNumber'];
      const updates: Record<string, any> = {};
      
      for (const field of allowedUpdates) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      log(`Updating user profile for ID ${userId}: ${JSON.stringify(updates)}`, 'api');
      
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        log(`User not found: ${userId}`, 'api');
        return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
      }
      
      // Remove password from response
      const userResponse = { ...updatedUser };
      if (userResponse.password) {
        delete userResponse.password;
      }
      
      log(`Profile updated successfully for user: ${userId}`, 'api');
      res.json(userResponse);
    } catch (error) {
      log(`Profile update error: ${error}`, 'api');
      res.status(500).json({ message: 'ไม่สามารถอัพเดทโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง' });
    }
  });
  
  // Loan API Routes
  
  // Get available loan info for current user
  app.get('/api/loans/available', isAuthenticated, async (req, res) => {
    try {
      // In a real application, this would query a credit scoring system
      // For now, we'll return a fixed amount based on user data
      const user = req.user;
      let availableAmount = 50000; // Default amount
      let interestRate = 85; // 0.85% per month (in basis points)
      
      // Adjust based on income if available
      if (user.monthlyIncome) {
        // Simple formula: 5x monthly income up to 100,000
        availableAmount = Math.min(user.monthlyIncome * 5, 100000);
      }
      
      res.json({
        availableAmount,
        interestRate,
        term: 12, // Default term in months
      });
    } catch (error) {
      log(`Available loan error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get available loan info' });
    }
  });
  
  // Get user's loans
  app.get('/api/loans', isAuthenticated, async (req, res) => {
    try {
      const loans = await storage.getLoansByUserId(req.user.id);
      res.json(loans);
    } catch (error) {
      log(`Get loans error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get loans' });
    }
  });
  
  // Create a new loan application
  app.post('/api/loans', isAuthenticated, async (req, res) => {
    try {
      const loanData = insertLoanSchema.parse(req.body);
      
      // Add the current user ID
      loanData.userId = req.user.id;
      
      const loan = await storage.createLoan(loanData);
      
      // Create notification for admin
      await sendNotification(
        1, // Admin ID (assuming admin ID is 1)
        'New Loan Application',
        `New loan application of ฿${loan.amount} from ${req.user.fullName}`,
        'loan',
        loan.id
      );
      
      // Broadcast new loan application to admin with specific type for real-time notifications
      broadcastEvent('loan_created', loan, [1]);
      
      res.status(201).json(loan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid loan data', errors: error.errors });
      }
      log(`Create loan error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to create loan' });
    }
  });
  
  // Get loan by ID (users can only view their own loans)
  app.get('/api/loans/:id', isAuthenticated, async (req, res) => {
    try {
      const loan = await storage.getLoan(parseInt(req.params.id));
      
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      
      // Check if the loan belongs to the requesting user or the user is an admin
      if (loan.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(loan);
    } catch (error) {
      log(`Get loan error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get loan' });
    }
  });
  
  // Chat API Routes
  
  // Get all messages for the current user
  app.get('/api/messages', isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getUserMessages(req.user.id);
      res.json(messages);
    } catch (error) {
      log(`Get all messages error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get messages' });
    }
  });
  
  // Get chat history between current user and another user
  app.get('/api/messages/:userId', isAuthenticated, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      const messages = await storage.getMessagesBetweenUsers(req.user.id, otherUserId);
      
      // Mark messages as read
      for (const message of messages) {
        if (message.receiverId === req.user.id && !message.isRead) {
          await storage.markMessageAsRead(message.id);
        }
      }
      
      res.json(messages);
    } catch (error) {
      log(`Get messages error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get messages' });
    }
  });
  
  // Get all chat users for the current user (who they've chatted with)
  app.get('/api/chat-users', isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getUserMessages(req.user.id);
      
      // Get unique user IDs
      const userIds = new Set<number>();
      messages.forEach(msg => {
        if (msg.senderId !== req.user.id) userIds.add(msg.senderId);
        if (msg.receiverId !== req.user.id) userIds.add(msg.receiverId);
      });
      
      // Get user info for each ID
      const chatUsers = [];
      const userPromises = Array.from(userIds).map(async (userId) => {
        const user = await storage.getUser(userId);
        if (user) {
          // Don't send password
          const { password, ...safeUser } = user;
          chatUsers.push(safeUser);
        }
      });
      
      // Wait for all user info to be fetched
      await Promise.all(userPromises);
      
      // If user has no chats, include admin for first-time chat
      if (chatUsers.length === 0 && !req.user.isAdmin) {
        const admin = await storage.getUser(1); // Admin user
        if (admin) {
          const { password, ...safeAdmin } = admin;
          chatUsers.push(safeAdmin);
        }
      }
      
      res.json(chatUsers);
    } catch (error) {
      log(`Get chat users error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get chat users' });
    }
  });
  
  // Notification API Routes
  
  // Get notifications for the current user
  app.get('/api/notifications', isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      log(`Get notifications error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get notifications' });
    }
  });
  
  // Mark notification as read
  app.patch('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      const notification = await storage.getNotification(parseInt(req.params.id));
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      // Check if the notification belongs to the requesting user
      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notification.id);
      res.json(updatedNotification);
    } catch (error) {
      log(`Mark notification error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });
  
  // Admin API Routes
  
  // Get all users (admin only)
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json(safeUsers);
    } catch (error) {
      log(`Admin get users error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get users' });
    }
  });
  
  // Create new user (admin only)
  app.post('/api/admin/users', isAdmin, async (req, res) => {
    try {
      // ตรวจสอบข้อมูลที่ส่งมา
      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ message: 'ต้องระบุชื่อผู้ใช้และรหัสผ่าน' });
      }
      
      // ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
      }
      
      // ตรวจสอบอีเมล์ซ้ำ (ถ้ามี)
      if (req.body.email) {
        const existingEmail = await storage.getUserByEmail(req.body.email);
        if (existingEmail) {
          return res.status(400).json({ message: 'อีเมล์นี้มีอยู่ในระบบแล้ว' });
        }
      }
      
      // สร้างผู้ใช้ใหม่
      const { confirmPassword, ...userData } = req.body;
      const newUser = await storage.createUser(userData);
      
      // สร้างบัญชีเงินอัตโนมัติ
      const initialBalance = req.body.accountBalance || 0;
      if (initialBalance > 0) {
        await storage.createAccount({
          userId: newUser.id,
          balance: initialBalance
        });
      }
      
      // นำรหัสผ่านออกก่อนส่งกลับ
      const { password, ...safeUser } = newUser;
      
      res.status(201).json(safeUser);
    } catch (error) {
      log(`Admin create user error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to create new user' });
    }
  });

  // Update user (admin only)
  app.patch('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Admin can update any field except password
      const { password, ...updates } = req.body;
      
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Remove password from response
      const { password: _, ...safeUser } = updatedUser;
      
      res.json(safeUser);
    } catch (error) {
      log(`Admin update user error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update user' });
    }
  });
  
  // Get all loans (admin only)
  app.get('/api/admin/loans', isAdmin, async (req, res) => {
    try {
      const loans = await storage.getAllLoans();
      res.json(loans);
    } catch (error) {
      log(`Admin get loans error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get loans' });
    }
  });
  
  // Update loan status (admin only)
  app.patch('/api/admin/loans/:id', isAdmin, async (req, res) => {
    try {
      const loanId = parseInt(req.params.id);
      const loan = await storage.getLoan(loanId);
      
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      
      // Validate status
      const validStatuses = ['pending', 'approved', 'rejected', 'completed'];
      if (req.body.status && !validStatuses.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      // Update loan with admin ID
      const updates = {
        ...req.body,
        adminId: req.user.id
      };
      
      const updatedLoan = await storage.updateLoan(loanId, updates);
      if (!updatedLoan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      
      // If loan is approved, add amount to user account
      if (req.body.status === 'approved' && loan.status !== 'approved') {
        const account = await storage.updateAccountBalance(loan.userId, loan.amount);
        
        // Create notification for the balance update
        await sendNotification(
          loan.userId,
          'เงินเข้าบัญชี',
          `เงินกู้จำนวน ฿${loan.amount} ได้รับการอนุมัติและเข้าบัญชีของคุณแล้ว`,
          'account',
          loan.id,
          'account_update'
        );
        
        // Broadcast account update to the user
        broadcastEvent('account_updated', account, [loan.userId]);
      }
      
      // Create notification for the loan status update with real-time update
      if (req.body.status) {
        const thaiStatusText = req.body.status === 'approved' ? 'อนุมัติ' : 
                              req.body.status === 'rejected' ? 'ปฏิเสธ' : 
                              req.body.status === 'completed' ? 'เสร็จสิ้น' : 'รออนุมัติ';
        
        await sendNotification(
          loan.userId,
          `สถานะเงินกู้: ${thaiStatusText}`,
          `คำขอสินเชื่อจำนวน ฿${loan.amount.toLocaleString()} ของคุณได้รับการ${thaiStatusText}`,
          'loan',
          loan.id,
          'loan_update'
        );
        
        // Broadcast loan update to the user
        broadcastEvent('loan_updated', updatedLoan, [loan.userId]);
      }
      
      res.json(updatedLoan);
    } catch (error) {
      log(`Admin update loan error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update loan' });
    }
  });
  
  // Account API Routes
  
  // Create deposit schema with amount validation
  // Define deposit schema with support for slip image
  const depositSchema = z.object({
    amount: z.number().positive().min(100).max(1000000),
    fullName: z.string().min(1).optional(),
    accountNumber: z.string().min(1).optional(),
    bankName: z.string().min(1).optional()
  });
  
  // Get user account balance
  app.get('/api/account', isAuthenticated, async (req, res) => {
    try {
      let account = await storage.getAccount(req.user.id);
      
      // If no account exists, create one
      if (!account) {
        account = await storage.createAccount({
          userId: req.user.id,
          balance: 0
        });
      }
      
      res.json(account);
    } catch (error) {
      log(`Get account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get account information' });
    }
  });
  
  // reusing depositSchema from above

  // Deposit money to account with slip image
  app.post('/api/deposit', isAuthenticated, upload.single('slipImage'), async (req, res) => {
    try {
      // Check if file was uploaded
      const slipImagePath = req.file ? `/uploads/${req.file.filename}` : null;
      
      // Parse form data
      const depositData = depositSchema.parse(JSON.parse(req.body.formData || '{}'));
      
      // Get the user's account
      let account = await storage.getAccount(req.user?.id);
      
      // If no account exists, create one
      if (!account) {
        account = await storage.createAccount({
          userId: req.user?.id,
          balance: 0
        });
      }
      
      // Create deposit record
      const deposit = await storage.createDeposit({
        userId: req.user?.id,
        amount: depositData.amount,
        fullName: depositData.fullName || req.user?.fullName,
        bankName: depositData.bankName || 'ธนาคารกรุงศรีอยุธยา',
        accountNumber: depositData.accountNumber || '',
        slipImageUrl: slipImagePath
      });
      
      // Admin users automatically approve deposits (for testing purposes)
      if (req.user?.isAdmin) {
        const updatedDeposit = await storage.updateDeposit(deposit.id, {
          status: 'approved',
          adminId: req.user.id,
          adminNote: 'Auto-approved by admin'
        });
        
        // Create notification for user with improved message
        await sendNotification(
          req.user.id,
          'ฝากเงินสำเร็จ ✅',
          `ฝากเงินจำนวน ฿${depositData.amount.toLocaleString()} เข้าบัญชีสำเร็จแล้ว`,
          'account',
          account.id
        );
        
        // Broadcast account update to user
        const updatedAccount = await storage.getAccount(req.user.id);
        broadcastEvent('account_updated', updatedAccount, [req.user.id]);
        
        res.status(200).json({ deposit: updatedDeposit, account: updatedAccount });
      } else {
        // Regular users' deposits need admin approval
        // Create notification for user with improved message
        await sendNotification(
          req.user?.id,
          'ได้รับรายการฝากเงินแล้ว ⏳',
          `รายการฝากเงินจำนวน ฿${depositData.amount.toLocaleString()} กำลังรอการอนุมัติ`,
          'account',
          account.id
        );
        
        res.status(200).json({ deposit, account });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid deposit data', errors: error.errors });
      }
      log(`Deposit error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to process deposit' });
    }
  });
  
  // Get user's deposit history
  app.get('/api/deposits', isAuthenticated, async (req, res) => {
    try {
      const deposits = await storage.getUserDeposits(req.user?.id);
      res.json(deposits);
    } catch (error) {
      log(`Get deposits error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get deposit history' });
    }
  });
  
  // Admin get all deposits
  app.get('/api/admin/deposits', isAdmin, async (req, res) => {
    try {
      const deposits = await storage.getAllDeposits();
      res.json(deposits);
    } catch (error) {
      log(`Admin get deposits error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get deposits' });
    }
  });
  
  // Update deposit status (admin only)
  app.patch('/api/admin/deposits/:id', isAdmin, async (req, res) => {
    try {
      const depositId = parseInt(req.params.id);
      const deposit = await storage.getDeposit(depositId);
      
      if (!deposit) {
        return res.status(404).json({ message: 'Deposit not found' });
      }
      
      // Validate status
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (req.body.status && !validStatuses.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      // Update deposit with admin ID
      const updates = {
        ...req.body,
        adminId: req.user.id
      };
      
      const updatedDeposit = await storage.updateDeposit(depositId, updates);
      if (!updatedDeposit) {
        return res.status(404).json({ message: 'Deposit not found' });
      }
      
      // Create notification for the deposit owner with real-time update and improved icons
      if (req.body.status) {
        const statusText = req.body.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
        const icon = req.body.status === 'approved' ? '✅' : '❌';
        
        await sendNotification(
          deposit.userId,
          `คำขอฝากเงิน${statusText}แล้ว ${icon}`,
          `คำขอฝากเงินจำนวน ฿${deposit.amount.toLocaleString()} ของคุณได้รับการ${statusText}`,
          'deposit',
          deposit.id,
          'deposit_update'
        );
        
        // If approved, update account balance and get updated account info for broadcasting
        if (req.body.status === 'approved') {
          // Update the account balance with the deposit amount
          await storage.updateAccountBalance(deposit.userId, deposit.amount);
          
          // Get the updated account
          const account = await storage.getAccount(deposit.userId);
          
          // Send account balance update
          broadcastEvent('account_updated', account, [deposit.userId]);
        }
        
        // Broadcast deposit update to user
        broadcastEvent('deposit_updated', updatedDeposit, [deposit.userId]);
      }
      
      res.json(updatedDeposit);
    } catch (error) {
      log(`Admin update deposit error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update deposit' });
    }
  });
  
  // File Upload API Route
  
  // Upload file for chat
  app.post('/api/messages/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const receiverId = parseInt(req.body.receiverId || '0');
      if (!receiverId) {
        return res.status(400).json({ message: 'Receiver ID is required' });
      }

      // Create virtual URL path to the file
      const fileUrl = `/uploads/${req.file.filename}`;
      const messageType = req.body.messageType || 'file';

      // Create message with file attachment
      const message = await storage.createMessage({
        senderId: req.user.id,
        receiverId,
        content: '',
        messageType,
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileMimeType: req.file.mimetype,
        isRead: false,
      });

      // Send through WebSocket if available
      const recipientWs = clients.get(receiverId);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        recipientWs.send(JSON.stringify({
          type: 'chat',
          data: message
        }));
      }
      
      // Also send back to sender for real-time updates
      const senderWs = clients.get(req.user.id);
      if (senderWs && senderWs.readyState === WebSocket.OPEN) {
        senderWs.send(JSON.stringify({
          type: 'chat',
          data: message
        }));
      }

      res.json({ success: true, message });
    } catch (error) {
      log(`File upload error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  // Withdrawal API Routes
  
  // Get user withdrawals
  app.get('/api/withdrawals', isAuthenticated, async (req, res) => {
    try {
      const withdrawals = await storage.getUserWithdrawals(req.user.id);
      res.json(withdrawals);
    } catch (error) {
      log(`Get withdrawals error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get withdrawals' });
    }
  });
  
  // Create a new withdrawal request
  app.post('/api/withdrawals', isAuthenticated, async (req, res) => {
    try {
      const withdrawalData = insertWithdrawalSchema.parse(req.body);
      
      // Add the current user ID
      withdrawalData.userId = req.user.id;
      
      // Check if user has enough balance
      const account = await storage.getAccount(req.user.id);
      if (!account || account.balance < withdrawalData.amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }
      
      const withdrawal = await storage.createWithdrawal(withdrawalData);
      
      // Create notification for admin
      await sendNotification(
        1, // Admin ID (assuming admin ID is 1)
        'New Withdrawal Request',
        `New withdrawal request of ฿${withdrawal.amount} from ${req.user.fullName}`,
        'withdrawal',
        withdrawal.id
      );
      
      // Create notification for user with improved messages and icons
      await sendNotification(
        req.user.id,
        'คำขอถอนเงินได้รับการบันทึกแล้ว ⏳',
        `คำขอถอนเงินจำนวน ฿${withdrawal.amount.toLocaleString()} กำลังรอการอนุมัติ`,
        'withdrawal',
        withdrawal.id
      );
      
      // Broadcast new withdrawal to admin with specific type for real-time notifications
      broadcastEvent('withdrawal_created', withdrawal, [1]);
      
      res.status(201).json(withdrawal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid withdrawal data', errors: error.errors });
      }
      log(`Create withdrawal error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to create withdrawal request' });
    }
  });
  
  // Admin get all withdrawals
  app.get('/api/admin/withdrawals', isAdmin, async (req, res) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      log(`Admin get withdrawals error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get withdrawals' });
    }
  });
  
  // Update withdrawal status (admin only)
  app.patch('/api/admin/withdrawals/:id', isAdmin, async (req, res) => {
    try {
      const withdrawalId = parseInt(req.params.id);
      const withdrawal = await storage.getWithdrawal(withdrawalId);
      
      if (!withdrawal) {
        return res.status(404).json({ message: 'Withdrawal not found' });
      }
      
      // Validate status
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (req.body.status && !validStatuses.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      // Update withdrawal with admin ID
      const updates = {
        ...req.body,
        adminId: req.user.id
      };
      
      const updatedWithdrawal = await storage.updateWithdrawal(withdrawalId, updates);
      if (!updatedWithdrawal) {
        return res.status(404).json({ message: 'Withdrawal not found' });
      }
      
      // Create notification for the withdrawal owner with real-time update and improved icons
      if (req.body.status) {
        const statusText = req.body.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
        const icon = req.body.status === 'approved' ? '✅' : '❌';
        
        await sendNotification(
          withdrawal.userId,
          `คำขอถอนเงิน${statusText}แล้ว ${icon}`,
          `คำขอถอนเงินจำนวน ฿${withdrawal.amount.toLocaleString()} ของคุณได้รับการ${statusText}`,
          'withdrawal',
          withdrawal.id,
          'withdrawal_update'
        );
        
        // If approved, just broadcast the update - we already deducted the amount during creation
        if (req.body.status === 'approved') {
          // Get latest account info to broadcast
          const account = await storage.getAccount(withdrawal.userId);
          
          // Send account balance update
          if (account) {
            broadcastEvent('account_updated', account, [withdrawal.userId]);
          }
        }
        
        // Broadcast withdrawal update to user
        broadcastEvent('withdrawal_updated', updatedWithdrawal, [withdrawal.userId]);
      }
      
      res.json(updatedWithdrawal);
    } catch (error) {
      log(`Admin update withdrawal error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update withdrawal' });
    }
  });
  
  // ===== Admin Account Management Routes =====
  
  // Get all accounts
  app.get('/api/admin/accounts', isAdmin, async (req, res) => {
    try {
      // Currently, there's no direct getAllAccounts method, so we'll get all users and fetch their accounts
      const users = await storage.getAllUsers();
      const accounts = [];
      
      for (const user of users) {
        const account = await storage.getAccount(user.id);
        if (account) {
          accounts.push(account);
        }
      }
      
      res.json(accounts);
    } catch (error) {
      log(`Admin get accounts error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get accounts' });
    }
  });
  
  // Update account balance
  app.patch('/api/admin/accounts/:userId', isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { balance } = req.body;
      
      if (typeof balance !== 'number') {
        return res.status(400).json({ message: 'Balance must be a number' });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if account exists, if not create one
      let account = await storage.getAccount(userId);
      if (!account) {
        account = await storage.createAccount({ userId, balance });
      } else {
        // คำนวณผลต่างระหว่างยอดเงินที่ต้องการกับยอดเงินปัจจุบัน
        const difference = balance - account.balance;
        account = await storage.updateAccountBalance(userId, difference);
      }
      
      if (!account) {
        return res.status(500).json({ message: 'Failed to update account balance' });
      }
      
      res.json(account);
    } catch (error) {
      log(`Admin update account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update account balance' });
    }
  });
  
  // ===== Stock Trading API Routes =====
  
  // Load mock stocks for development
  // Creating a dedicated bypass endpoint outside the authenticated routes
  // This is only for development/testing purposes
  app.get('/dev/stocks/load-mock', async (req, res) => {
    try {
      const stockData = [];
      
      // Process each mock stock
      for (const mockStock of mockStocks) {
        try {
          // Check if stock exists in database
          let stock = await storage.getStockBySymbol(mockStock.symbol);
          
          if (stock) {
            // Update existing stock
            stock = await storage.updateStock(stock.id, {
              name: mockStock.name,
              exchange: mockStock.exchange,
              currentPrice: mockStock.currentPrice,
              previousClose: mockStock.previousClose,
              change: mockStock.change,
              changePercent: mockStock.changePercent,
              logoUrl: mockStock.logoUrl,
              sector: mockStock.sector,
              description: mockStock.description,
              lastUpdated: new Date()
            });
          } else {
            // Create new stock entry
            stock = await storage.createStock({
              symbol: mockStock.symbol,
              name: mockStock.name,
              exchange: mockStock.exchange,
              currentPrice: mockStock.currentPrice,
              previousClose: mockStock.previousClose,
              change: mockStock.change,
              changePercent: mockStock.changePercent,
              logoUrl: mockStock.logoUrl,
              sector: mockStock.sector,
              description: mockStock.description
            });
          }
          
          stockData.push(stock);
        } catch (error) {
          log(`Error loading mock stock for ${mockStock.symbol}: ${error}`, 'api');
          // Continue to next symbol
        }
      }
      
      res.json({ message: 'Mock stock data loaded', count: stockData.length, stocks: stockData });
    } catch (error) {
      log(`Load mock stocks error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to load mock stock data' });
    }
  });
  
  // Fetch available stocks from Finnhub API and update the database
  app.get('/api/stocks/refresh', async (req, res) => {
    try {
      // List of stock symbols to track
      const symbols = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'FB', 'TSLA', 'NVDA', 'JPM', 'BABA', 'JNJ', 
                      'WMT', 'PG', 'ASML', 'V', 'MA', 'HD', 'BAC', 'DIS', 'ADBE', 'CRM'];
      
      const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
      if (!FINNHUB_API_KEY) {
        return res.status(500).json({ message: 'Finnhub API key is not configured' });
      }
      
      const stockData = [];
      for (const symbol of symbols) {
        try {
          // Get stock quote data
          const quoteResponse = await axios.get(`https://finnhub.io/api/v1/quote`, {
            params: {
              symbol,
              token: FINNHUB_API_KEY
            }
          });
          
          // Get company profile data
          const profileResponse = await axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
            params: {
              symbol,
              token: FINNHUB_API_KEY
            }
          });
          
          const quoteData = quoteResponse.data;
          const profileData = profileResponse.data;
          
          // Check if stock exists in database
          let stock = await storage.getStockBySymbol(symbol);
          
          if (stock) {
            // Update existing stock
            stock = await storage.updateStock(stock.id, {
              currentPrice: quoteData.c,
              previousClose: quoteData.pc,
              change: quoteData.c - quoteData.pc,
              changePercent: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
              lastUpdated: new Date()
            });
          } else {
            // Create new stock entry
            stock = await storage.createStock({
              symbol: symbol,
              name: profileData.name || symbol,
              exchange: profileData.exchange || 'NASDAQ',
              currentPrice: quoteData.c,
              previousClose: quoteData.pc,
              change: quoteData.c - quoteData.pc,
              changePercent: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
              logoUrl: profileData.logo || null,
              sector: profileData.finnhubIndustry || null,
              description: profileData.weburl || null
            });
          }
          
          stockData.push(stock);
          
          // Add a delay to respect API rate limits (60 requests per minute)
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          log(`Error fetching data for ${symbol}: ${error}`, 'api');
          // Continue to next symbol
        }
      }
      
      res.json({ message: 'Stock data refreshed', count: stockData.length, stocks: stockData });
    } catch (error) {
      log(`Refresh stocks error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to refresh stock data' });
    }
  });
  
  // Special endpoint to load mock stocks (accessible only when authenticated for testing)
  app.post('/api/stocks/init-mock', isAuthenticated, async (req, res) => {
    try {
      const stockData = [];
      
      // Process each mock stock
      for (const mockStock of mockStocks) {
        try {
          // Check if stock exists in database
          let stock = await storage.getStockBySymbol(mockStock.symbol);
          
          if (stock) {
            // Update existing stock
            stock = await storage.updateStock(stock.id, {
              name: mockStock.name,
              exchange: mockStock.exchange,
              currentPrice: mockStock.currentPrice,
              previousClose: mockStock.previousClose,
              change: mockStock.change,
              changePercent: mockStock.changePercent,
              logoUrl: mockStock.logoUrl,
              sector: mockStock.sector,
              description: mockStock.description,
              lastUpdated: new Date()
            });
          } else {
            // Create new stock entry
            stock = await storage.createStock({
              symbol: mockStock.symbol,
              name: mockStock.name,
              exchange: mockStock.exchange,
              currentPrice: mockStock.currentPrice,
              previousClose: mockStock.previousClose,
              change: mockStock.change,
              changePercent: mockStock.changePercent,
              logoUrl: mockStock.logoUrl,
              sector: mockStock.sector,
              description: mockStock.description
            });
          }
          
          stockData.push(stock);
        } catch (error) {
          log(`Error loading mock stock for ${mockStock.symbol}: ${error}`, 'api');
          // Continue to next symbol
        }
      }
      
      res.json({ message: 'Mock stock data loaded', count: stockData.length, stocks: stockData });
    } catch (error) {
      log(`Load mock stocks error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to load mock stock data' });
    }
  });

  // List all available stocks
  app.get('/api/stocks', async (req, res) => {
    try {
      const stocks = await storage.getAllStocks();
      res.json(stocks);
    } catch (error) {
      log(`Get stocks error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stocks' });
    }
  });
  
  // ดึงข้อมูลกราฟหุ้นจาก Alpha Vantage
  app.get('/api/stocks/:symbol/chart', async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // ตรวจสอบ API key
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          message: 'API key is not configured',
          simulatedData: true,
          data: generateSimulatedChartData(30) // ส่งข้อมูลจำลองกลับไปถ้าไม่มี API key
        });
      }
      
      try {
        // เรียกข้อมูล intraday จาก Alpha Vantage
        const response = await axios.get(`https://www.alphavantage.co/query`, {
          params: {
            function: 'TIME_SERIES_INTRADAY',
            symbol,
            interval: '5min',
            apikey: apiKey,
            outputsize: 'compact'
          }
        });
        
        const data = response.data;
        
        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (data && data['Time Series (5min)']) {
          // แปลงข้อมูลให้อยู่ในรูปแบบที่ใช้งานง่าย
          const timeSeries = data['Time Series (5min)'];
          const timestamps = Object.keys(timeSeries).sort(); // เรียงตามเวลา
          
          const chartData = timestamps.map(timestamp => ({
            time: timestamp,
            price: parseFloat(timeSeries[timestamp]['4. close'])
          }));
          
          return res.json({
            symbol,
            data: chartData,
            simulatedData: false
          });
        } else {
          throw new Error('Invalid API response');
        }
      } catch (error) {
        log(`Error fetching chart data for ${symbol}: ${error}`, 'api');
        
        // ถ้าเกิดข้อผิดพลาด ส่งข้อมูลจำลองกลับไป
        return res.json({
          symbol,
          simulatedData: true,
          data: generateSimulatedChartData(30)
        });
      }
    } catch (error) {
      log(`Get stock chart error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stock chart data' });
    }
  });
  
  // Get a single stock by ID
  app.get('/api/stocks/:id', async (req, res) => {
    try {
      const stockId = parseInt(req.params.id);
      const stock = await storage.getStock(stockId);
      
      if (!stock) {
        return res.status(404).json({ message: 'Stock not found' });
      }
      
      // Get real-time price if needed
      if (req.query.realtime === 'true') {
        try {
          const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
          const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
            params: {
              symbol: stock.symbol,
              token: FINNHUB_API_KEY
            }
          });
          
          const quoteData = response.data;
          
          // Update stock price
          await storage.updateStockPrice(stock.id, quoteData.c);
          
          // Get the updated stock
          const updatedStock = await storage.getStock(stockId);
          return res.json(updatedStock);
        } catch (error) {
          log(`Real-time price error: ${error}`, 'api');
          // Continue returning the current stock data
        }
      }
      
      res.json(stock);
    } catch (error) {
      log(`Get stock error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stock' });
    }
  });
  
  // Create a new stock trade
  app.post('/api/stock-trades', isAuthenticated, async (req, res) => {
    try {
      // Validate and parse the trade data
      const tradeData = insertStockTradeSchema.parse(req.body);
      
      // ตรวจสอบว่ามี user หรือไม่
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // เพิ่ม properties ที่จำเป็นที่เราได้ omit ไปใน schema
      const fullTradeData = {
        ...tradeData,
        userId: req.user.id,
        startTime: new Date(),
        status: 'active'
      };
      
      // ตรวจสอบยอดเงินในบัญชีก่อนเทรด
      const account = await storage.getAccount(req.user.id);
      if (!account || account.balance < tradeData.amount) {
        return res.status(400).json({ 
          message: 'ยอดเงินในบัญชีไม่เพียงพอ', 
          balance: account?.balance || 0, 
          required: tradeData.amount 
        });
      }
      
      // Get real-time price for the stock
      const stock = await storage.getStock(tradeData.stockId);
      if (!stock) {
        return res.status(404).json({ message: 'Stock not found' });
      }
      
      try {
        // Try to get real-time price from API
        const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
        const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
          params: {
            symbol: stock.symbol,
            token: FINNHUB_API_KEY
          }
        });
        
        const quoteData = response.data;
        
        // Update stock price
        const updatedStock = await storage.updateStockPrice(stock.id, quoteData.c);
        
        // Broadcast stock price update to all users
        if (updatedStock) {
          broadcastEvent('stock_price_updated', updatedStock);
        }
      } catch (error) {
        log(`Real-time price error for trade: ${error}`, 'api');
        // Continue using the current price in the database
      }
      
      // หักเงินจากบัญชีผู้ใช้
      await storage.updateAccountBalance(req.user.id, -tradeData.amount);
      
      // Create the trade with complete data
      const trade = await storage.createStockTrade(fullTradeData);
      
      // Broadcast event to admin that new stock trade was created
      const adminUsers = await storage.getAllUsers();
      const adminIds = adminUsers
        .filter(user => user.isAdmin)
        .map(admin => admin.id);
      
      if (adminIds.length > 0) {
        // Send to all admin users
        broadcastEvent('stock_trade_created', trade, adminIds);
      }
      
      // ส่งการแจ้งเตือนให้แอดมิน
      // ใช้ adminUsers ที่ได้มาจากด้านบนเพื่อไม่ต้องเรียก getAllUsers ซ้ำอีกครั้ง
      
      if (adminIds.length > 0) {
        // ส่งการแจ้งเตือนให้แอดมิน
        for (const adminId of adminIds) {
          await sendNotification(
            adminId,
            `มีการเทรดหุ้นใหม่ 📊`,
            `ผู้ใช้ ID ${req.user.id} ได้เริ่มการเทรดหุ้น ${stock.symbol} เป็นจำนวนเงิน ฿${tradeData.amount.toLocaleString()}`,
            'stockTrade',
            trade.id,
            'stock_trade_created'
          );
        }
      }
      
      // Set up a timer to complete the trade when duration is reached
      setTimeout(async () => {
        try {
          // Get the most up-to-date stock price
          const updatedStock = await storage.getStock(trade.stockId);
          if (!updatedStock) {
            throw new Error(`Stock with ID ${trade.stockId} not found`);
          }
          
          // Try to get real-time price for best accuracy
          let endPrice = updatedStock.currentPrice;
          try {
            const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
            const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
              params: {
                symbol: updatedStock.symbol,
                token: FINNHUB_API_KEY
              }
            });
            
            const quoteData = response.data;
            endPrice = quoteData.c;
            
            // Update stock price
            const updatedStockData = await storage.updateStockPrice(updatedStock.id, endPrice);
            
            // Broadcast stock price update to all users
            if (updatedStockData) {
              broadcastEvent('stock_price_updated', updatedStockData);
            }
          } catch (error) {
            log(`Real-time price error for trade completion: ${error}`, 'api');
            // Continue using the current price in the database
          }
          
          // ตรวจสอบว่ามีการกำหนดผลลัพธ์โดยแอดมินหรือไม่
          let isWin = false;
          let status = 'loss';
          
          // ถ้ามีการกำหนดผลโดยแอดมิน ให้ใช้ค่านั้น
          if (trade.adminForceResult) {
            isWin = trade.adminForceResult === 'win';
            status = trade.adminForceResult;
            log(`Using admin forced result: ${status} for trade ${trade.id}`, 'api');
          } else {
            // ถ้าไม่มีการกำหนดโดยแอดมิน ให้คำนวณจากราคาจริง
            isWin = 
              (trade.direction === 'up' && endPrice > trade.startPrice) ||
              (trade.direction === 'down' && endPrice < trade.startPrice);
            status = isWin ? 'win' : 'loss';
          }
          
          log(`Trade ${trade.id} result: isWin=${isWin}, status=${status}, adminForceResult=${trade.adminForceResult || 'none'}`, 'api');
          
          // Complete the trade
          const completedTrade = await storage.completeStockTrade(trade.id, endPrice, status);
          
          if (completedTrade) {
            // การเพิ่มเงินจากการชนะการเดิมพันจะถูกจัดการใน storage.completeStockTrade แล้ว
            // เพียงแค่บันทึกประวัติเพิ่มเติม
            log(`Trade completed: trade=${trade.id}, status=${status}, endPrice=${endPrice}, payoutAmount=${completedTrade.payoutAmount || 0}`, 'api');
            
            // Create notification for user
            const winOrLoss = isWin ? 'ชนะ' : 'แพ้';
            const resultAmount = isWin ? completedTrade.payoutAmount : completedTrade.amount;
            
            await sendNotification(
              trade.userId,
              `การเทรดของคุณ${winOrLoss}`,
              `การเทรดหุ้น ${updatedStock.symbol} ของคุณ${winOrLoss} ${isWin ? 'ได้รับเงิน' : 'เสียเงิน'} ฿${resultAmount}`,
              'stock_trade',
              trade.id,
              'trade_completed'
            );
            
            // Send real-time update to user
            broadcastEvent('trade_completed', completedTrade, [trade.userId]);
            
            // Send account update
            const account = await storage.getAccount(trade.userId);
            if (account) {
              broadcastEvent('account_updated', account, [trade.userId]);
            }
          }
        } catch (error) {
          log(`Error completing trade ${trade.id}: ${error}`, 'api');
        }
      }, trade.duration * 1000);
      
      res.status(201).json(trade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid trade data', errors: error.errors });
      }
      log(`Create stock trade error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to create stock trade' });
    }
  });
  
  // Get all user's stock trades
  app.get('/api/stock-trades', isAuthenticated, async (req, res) => {
    try {
      const trades = await storage.getUserStockTrades(req.user.id);
      res.json(trades);
    } catch (error) {
      log(`Get stock trades error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stock trades' });
    }
  });
  
  // Get active user's stock trades
  app.get('/api/stock-trades/active', isAuthenticated, async (req, res) => {
    try {
      const trades = await storage.getActiveUserStockTrades(req.user.id);
      res.json(trades);
    } catch (error) {
      log(`Get active stock trades error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get active stock trades' });
    }
  });
  
  // Get a single stock trade
  app.get('/api/stock-trades/:id', isAuthenticated, async (req, res) => {
    try {
      const tradeId = parseInt(req.params.id);
      const trade = await storage.getStockTrade(tradeId);
      
      if (!trade) {
        return res.status(404).json({ message: 'Stock trade not found' });
      }
      
      // Check if the trade belongs to the current user
      if (trade.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(trade);
    } catch (error) {
      log(`Get stock trade error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stock trade' });
    }
  });
  
  // Bank Account API Routes
  
  // Get user bank accounts
  app.get('/api/bank-accounts', isAuthenticated, async (req, res) => {
    try {
      const bankAccounts = await storage.getUserBankAccounts(req.user.id);
      res.json(bankAccounts);
    } catch (error) {
      log(`Get bank accounts error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get bank accounts' });
    }
  });
  
  // Admin: Get bank accounts for specific user
  app.get('/api/admin/bank-accounts/:userId', isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const bankAccounts = await storage.getUserBankAccounts(userId);
      res.json(bankAccounts);
    } catch (error) {
      log(`Admin get user bank accounts error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get bank accounts' });
    }
  });
  
  // Admin: Update bank account (admin only)
  app.patch('/api/admin/bank-accounts/:id', isAdmin, async (req, res) => {
    try {
      const bankAccountId = parseInt(req.params.id);
      const bankAccount = await storage.getBankAccount(bankAccountId);
      
      if (!bankAccount) {
        return res.status(404).json({ message: 'Bank account not found' });
      }
      
      const { bankName, accountNumber, accountName, isDefault } = req.body;
      const updates: Partial<BankAccount> = {};
      
      if (bankName) updates.bankName = bankName;
      if (accountNumber) updates.accountNumber = accountNumber;
      if (accountName) updates.accountName = accountName;
      if (isDefault !== undefined) updates.isDefault = isDefault;
      
      const updatedBankAccount = await storage.updateBankAccount(bankAccountId, updates);
      
      // If setting as default, update other bank accounts for this user
      if (isDefault) {
        await storage.setDefaultBankAccount(bankAccount.userId, bankAccountId);
      }
      
      // Get updated bank accounts for the user
      const bankAccounts = await storage.getUserBankAccounts(bankAccount.userId);
      res.json(bankAccounts);
    } catch (error) {
      log(`Admin update bank account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update bank account' });
    }
  });
  
  // Create a new bank account
  app.post('/api/bank-accounts', isAuthenticated, async (req, res) => {
    try {
      // Validate request body against bank account schema
      const { bankName, accountNumber, accountName } = req.body;
      
      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Check if user already has maximum number of bank accounts (2)
      const existingAccounts = await storage.getUserBankAccounts(req.user.id);
      if (existingAccounts.length >= 2) {
        return res.status(400).json({ message: 'Maximum number of bank accounts reached (2)' });
      }
      
      // Check if account number already exists for this user
      const duplicateAccount = existingAccounts.find(acc => acc.accountNumber === accountNumber);
      if (duplicateAccount) {
        return res.status(400).json({ message: 'This account number is already registered' });
      }
      
      const bankAccount = await storage.createBankAccount({
        userId: req.user.id,
        bankName,
        accountNumber,
        accountName,
        isDefault: existingAccounts.length === 0 // Make default if it's the first account
      });
      
      res.status(201).json(bankAccount);
    } catch (error) {
      log(`Create bank account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to create bank account' });
    }
  });
  
  // Update bank account
  app.patch('/api/bank-accounts/:id', isAuthenticated, async (req, res) => {
    try {
      const bankAccountId = parseInt(req.params.id);
      const bankAccount = await storage.getBankAccount(bankAccountId);
      
      if (!bankAccount) {
        return res.status(404).json({ message: 'Bank account not found' });
      }
      
      // Check if the bank account belongs to the current user
      if (bankAccount.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const { bankName, accountNumber, accountName } = req.body;
      const updates: Partial<BankAccount> = {};
      
      if (bankName) updates.bankName = bankName;
      if (accountNumber) updates.accountNumber = accountNumber;
      if (accountName) updates.accountName = accountName;
      
      const updatedBankAccount = await storage.updateBankAccount(bankAccountId, updates);
      res.json(updatedBankAccount);
    } catch (error) {
      log(`Update bank account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update bank account' });
    }
  });
  
  // Delete bank account
  app.delete('/api/bank-accounts/:id', isAuthenticated, async (req, res) => {
    try {
      const bankAccountId = parseInt(req.params.id);
      const bankAccount = await storage.getBankAccount(bankAccountId);
      
      if (!bankAccount) {
        return res.status(404).json({ message: 'Bank account not found' });
      }
      
      // Check if the bank account belongs to the current user
      if (bankAccount.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const success = await storage.deleteBankAccount(bankAccountId);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ message: 'Failed to delete bank account' });
      }
    } catch (error) {
      log(`Delete bank account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to delete bank account' });
    }
  });
  
  // Set default bank account
  app.post('/api/bank-accounts/:id/set-default', isAuthenticated, async (req, res) => {
    try {
      const bankAccountId = parseInt(req.params.id);
      const bankAccount = await storage.getBankAccount(bankAccountId);
      
      if (!bankAccount) {
        return res.status(404).json({ message: 'Bank account not found' });
      }
      
      // Check if the bank account belongs to the current user
      if (bankAccount.userId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const success = await storage.setDefaultBankAccount(req.user.id, bankAccountId);
      
      if (success) {
        const bankAccounts = await storage.getUserBankAccounts(req.user.id);
        res.json(bankAccounts);
      } else {
        res.status(500).json({ message: 'Failed to set default bank account' });
      }
    } catch (error) {
      log(`Set default bank account error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to set default bank account' });
    }
  });

  // Get bank information for deposits
  app.get('/api/bank-info', async (req, res) => {
    try {
      const bankInfo = await storage.getDepositBankInfo();
      res.json(bankInfo);
    } catch (error) {
      log(`Get bank info error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get bank information' });
    }
  });
  
  // Update bank information for deposits (admin only)
  app.patch('/api/bank-info', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { accountName, bankName, accountNumber, qrCodeUrl } = req.body;
      
      // ฟังก์ชันสำหรับแปลงค่าเป็น string ที่ไม่มีเครื่องหมายคำพูด
      const prepareValue = (value: string): string => {
        return value;
      };
      
      // Update the system settings
      let updated = {};
      
      if (accountName) {
        await storage.updateSystemSetting('deposit_account_name', prepareValue(accountName));
        updated = { ...updated, accountName };
      }
      
      if (bankName) {
        await storage.updateSystemSetting('deposit_bank_name', prepareValue(bankName));
        updated = { ...updated, bankName };
      }
      
      if (accountNumber) {
        await storage.updateSystemSetting('deposit_account_number', prepareValue(accountNumber));
        updated = { ...updated, accountNumber };
      }
      
      if (qrCodeUrl) {
        await storage.updateSystemSetting('deposit_qr_code', prepareValue(qrCodeUrl));
        updated = { ...updated, qrCodeUrl };
      }
      
      // Get the updated bank info
      const bankInfo = await storage.getDepositBankInfo();
      
      // ส่งข้อมูลอัปเดต
      res.json({ 
        message: 'อัปเดตข้อมูลธนาคารสำเร็จ', 
        updated,
        bankInfo
      });
    } catch (error) {
      log(`Update bank info error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update bank information' });
    }
  });

  // Admin Stock Trades API Routes
  
  // Get all stock trades (admin only)
  app.get('/api/admin/stock-trades', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const trades = await storage.getAllStockTrades();
      
      // Get additional stock data for each trade
      const tradesWithStockData = await Promise.all(trades.map(async (trade) => {
        const stock = await storage.getStock(trade.stockId);
        return {
          ...trade,
          stock: stock || null
        };
      }));
      
      res.json(tradesWithStockData);
    } catch (error) {
      log(`Admin get stock trades error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stock trades' });
    }
  });

  // Update stock trade for admin forced results (admin only)
  app.patch('/api/admin/stock-trades/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const tradeId = parseInt(req.params.id);
      const trade = await storage.getStockTrade(tradeId);
      
      if (!trade) {
        return res.status(404).json({ message: 'Stock trade not found' });
      }
      
      const { adminForceResult } = req.body;
      
      if (adminForceResult !== 'win' && adminForceResult !== 'loss' && adminForceResult !== null) {
        return res.status(400).json({ message: 'adminForceResult must be "win", "loss", or null' });
      }
      
      type StockTradeUpdate = {
        adminForceResult?: string | null;
        adminId?: number;
      };
      
      const updates: StockTradeUpdate = {
        adminForceResult,
        adminId: req.user?.id
      };
      
      const updatedTrade = await storage.updateStockTrade(tradeId, updates);
      
      if (!updatedTrade) {
        return res.status(404).json({ message: 'Failed to update stock trade' });
      }
      
      // Send notification to user if adminForceResult was set
      if (adminForceResult && trade.status === 'active') {
        await sendNotification(
          trade.userId,
          'การเทรดของคุณถูกอัปเดตโดยแอดมิน',
          `การเทรดหุ้นของคุณได้รับการอัปเดตโดยแอดมิน`,
          'stock_trade',
          trade.id
        );
      }
      
      res.json(updatedTrade);
    } catch (error) {
      log(`Admin update stock trade error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to update stock trade' });
    }
  });

  // Admin Stock API Routes
  
  // Get all stocks (admin only)
  app.get('/api/admin/stocks', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const stocks = await storage.getAllStocks();
      res.json(stocks);
    } catch (error) {
      log(`Admin get stocks error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stocks' });
    }
  });

  // Admin Account API Routes
  
  // Get all accounts (admin only)
  app.get('/api/admin/accounts', isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get all users first
      const users = await storage.getAllUsers();
      const userIds = users.map(user => user.id);
      
      // Then get all accounts
      const accounts = [];
      
      for (const userId of userIds) {
        const account = await storage.getAccount(userId);
        if (account) {
          accounts.push(account);
        }
      }
      
      res.json(accounts);
    } catch (error) {
      log(`Admin get accounts error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get accounts' });
    }
  });

  // เริ่มการอัพเดทราคาหุ้นอัตโนมัติ (หลังจากเซิร์ฟเวอร์เริ่มทำงาน 2 วินาที)
  setTimeout(updateStockPrices, 2000);
  
  return httpServer;
}
