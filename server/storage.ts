import { users, type User, type InsertUser, loans, type Loan, type InsertLoan, messages, type Message, type InsertMessage, notifications, type Notification, type InsertNotification, accounts, type Account, type InsertAccount, withdrawals, type Withdrawal, type InsertWithdrawal, stocks, type Stock, type InsertStock, stockTrades, type StockTrade, type InsertStockTrade, deposits, type Deposit, type InsertDeposit, bankAccounts, type BankAccount, type InsertBankAccount, systemSettings, type SystemSetting, type InsertSystemSetting, stockPriceHistory, type StockPriceHistory, type InsertStockPriceHistory } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { log } from "./vite";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from './db';
import { eq, and, desc, asc, or, isNull, lt } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import PgSession from 'connect-pg-simple';

const MemoryStore = createMemoryStore(session);

const scryptAsync = promisify(scrypt);

async function hashInitialPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashedPassword, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashedPassword, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    log(`Error comparing passwords: ${error}`, "storage");
    return false;
  }
}

// สร้าง session store ที่ใช้ PostgreSQL
const PgSessionStore = PgSession(session);

// Interface for all storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByFacebookId(facebookId: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, "confirmPassword">): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Loan operations
  getLoan(id: number): Promise<Loan | undefined>;
  getLoansByUserId(userId: number): Promise<Loan[]>;
  getAllLoans(): Promise<Loan[]>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  updateLoan(id: number, loan: Partial<Loan>): Promise<Loan | undefined>;

  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]>;
  getUserMessages(userId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;

  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;

  // Account operations
  getAccount(userId: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccountBalance(userId: number, amount: number): Promise<Account | undefined>;

  // Withdrawal operations
  getWithdrawal(id: number): Promise<Withdrawal | undefined>;
  getUserWithdrawals(userId: number): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawal(id: number, withdrawal: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  // Bank Account operations
  getBankAccount(id: number): Promise<BankAccount | undefined>;
  getUserBankAccounts(userId: number): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: number, account: Partial<BankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: number): Promise<boolean>;
  setDefaultBankAccount(userId: number, accountId: number): Promise<boolean>;

  // Stock operations
  getStock(id: number): Promise<Stock | undefined>;
  getStockBySymbol(symbol: string): Promise<Stock | undefined>;
  getAllStocks(): Promise<Stock[]>;
  createStock(stock: InsertStock): Promise<Stock>;
  updateStock(id: number, stock: Partial<Stock>): Promise<Stock | undefined>;
  updateStockPrice(id: number, currentPrice: number): Promise<Stock | undefined>;

  // Stock price history operations
  getStockPriceHistory(stockId: number, interval: string, limit?: number): Promise<StockPriceHistory[]>;
  saveStockPriceHistory(history: InsertStockPriceHistory): Promise<StockPriceHistory>;
  getLatestStockPrice(stockId: number, interval: string): Promise<StockPriceHistory | undefined>;
  deleteOldStockPriceHistory(olderThan: Date): Promise<number>; // Returns count of deleted records

  // Stock trade operations
  getStockTrade(id: number): Promise<StockTrade | undefined>;
  getUserStockTrades(userId: number): Promise<StockTrade[]>;
  getActiveUserStockTrades(userId: number): Promise<StockTrade[]>;
  getAllStockTrades(): Promise<StockTrade[]>;
  createStockTrade(trade: InsertStockTrade): Promise<StockTrade>;
  updateStockTrade(id: number, trade: Partial<StockTrade>): Promise<StockTrade | undefined>;
  completeStockTrade(id: number, endPrice: number, status: string): Promise<StockTrade | undefined>;
  
  // Deposit operations
  getDeposit(id: number): Promise<Deposit | undefined>;
  getUserDeposits(userId: number): Promise<Deposit[]>;
  getAllDeposits(): Promise<Deposit[]>;
  createDeposit(deposit: InsertDeposit): Promise<Deposit>;
  updateDeposit(id: number, deposit: Partial<Deposit>): Promise<Deposit | undefined>;
  
  // System settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getAllSystemSettings(): Promise<SystemSetting[]>;
  createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  updateSystemSetting(key: string, value: any): Promise<SystemSetting | undefined>;
  getDepositBankInfo(): Promise<any>; // Returns bank account info for deposits

  // Session store
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private usersStore: Map<number, User>;
  private loansStore: Map<number, Loan>;
  private messagesStore: Map<number, Message>;
  private notificationsStore: Map<number, Notification>;
  private accountsStore: Map<number, Account>;
  private withdrawalsStore: Map<number, Withdrawal>;
  private stocksStore: Map<number, Stock>;
  private stockTradesStore: Map<number, StockTrade>;
  private stockPriceHistoryStore: Map<number, StockPriceHistory>;
  private depositsStore: Map<number, Deposit>;
  private bankAccountsStore: Map<number, BankAccount> = new Map();
  private systemSettingsStore: Map<string, SystemSetting> = new Map();

  private userIdCounter: number;
  private loanIdCounter: number;
  private messageIdCounter: number;
  private notificationIdCounter: number;
  private withdrawalIdCounter: number;
  private stockIdCounter: number;
  private stockTradeIdCounter: number;
  private stockPriceHistoryIdCounter: number;
  private depositIdCounter: number;
  private bankAccountIdCounter: number;
  private systemSettingIdCounter: number;

  sessionStore: session.Store;

  constructor() {
    // Initialize stores
    this.usersStore = new Map();
    this.loansStore = new Map();
    this.messagesStore = new Map();
    this.notificationsStore = new Map();
    this.accountsStore = new Map();
    this.withdrawalsStore = new Map();
    this.stocksStore = new Map();
    this.stockTradesStore = new Map();
    this.stockPriceHistoryStore = new Map();
    this.depositsStore = new Map();
    this.systemSettingsStore = new Map();

    // Initialize ID counters
    this.userIdCounter = 1;
    this.loanIdCounter = 1;
    this.messageIdCounter = 1;
    this.notificationIdCounter = 1;
    this.withdrawalIdCounter = 1;
    this.stockIdCounter = 1;
    this.stockTradeIdCounter = 1;
    this.stockPriceHistoryIdCounter = 1;
    this.depositIdCounter = 1;
    this.bankAccountIdCounter = 1;
    this.systemSettingIdCounter = 1;

    // Create session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions every 24h
    });

    // Initialize with admin user
    hashInitialPassword("admin123").then(hashedPassword => {
      this.createUser({
        username: "admin",
        password: hashedPassword,
        email: "admin@cashluxe.com",
        fullName: "System Administrator",
        phone: "099-999-9999",
        authProvider: 'local',
        isAdmin: true,
        isActive: true,
      }).then(admin => {
        log(`Admin user created with ID: ${admin.id}`, "storage");
        
        // Create admin account with initial balance
        this.createAccount({
          userId: admin.id,
          balance: 100000, // 100,000 THB สำหรับทดสอบ
        }).then(account => {
          log(`Admin account created with ID: ${account.id}`, "storage");
        });
        
        // Initialize mock stocks
        this.initializeMockStocks();
      });
    });
    
  }
  
  // Method to initialize mock stock data
  private async initializeMockStocks() {
    try {
      // Import mock stocks from mock-stocks.ts
      const { mockStocks } = await import('./mock-stocks');
      
      // Check if we already have stocks
      if ((await this.getAllStocks()).length > 0) {
        log(`Stocks already exist in database, skipping initialization`, "storage");
        return;
      }
      
      // Add each mock stock
      for (const mockStock of mockStocks) {
        try {
          // Generate sentiment data based on stock movement
          const { generateSentiment } = await import('./mock-stocks');
          const sentimentData = generateSentiment(mockStock.changePercent);
          
          await this.createStock({
            symbol: mockStock.symbol,
            name: mockStock.name,
            exchange: mockStock.exchange,
            currentPrice: mockStock.currentPrice,
            previousClose: mockStock.previousClose,
            change: mockStock.change,
            changePercent: mockStock.changePercent,
            logoUrl: mockStock.logoUrl,
            sector: mockStock.sector,
            description: mockStock.description,
            // Add sentiment data
            sentimentScore: sentimentData.sentimentScore,
            sentimentVolume: sentimentData.sentimentVolume,
            sentimentTrend: sentimentData.sentimentTrend
          });
        } catch (error) {
          log(`Error creating mock stock ${mockStock.symbol}: ${error}`, "storage");
        }
      }
      
      log(`Initialized ${mockStocks.length} mock stocks`, "storage");
    } catch (error) {
      log(`Failed to initialize mock stocks: ${error}`, "storage");
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersStore.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersStore.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersStore.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.usersStore.values()).find(
      (user) => user.googleId === googleId
    );
  }

  async getUserByFacebookId(facebookId: string): Promise<User | undefined> {
    return Array.from(this.usersStore.values()).find(
      (user) => user.facebookId === facebookId
    );
  }

  async createUser(insertUser: Omit<InsertUser, "confirmPassword">): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    
    // Set default values
    const authProvider = insertUser.authProvider || 'local';
    
    const user: User = {
      ...insertUser,
      id,
      createdAt: now,
      isActive: true,
      isAdmin: insertUser.isAdmin || false,
      authProvider,
      password: insertUser.password || null,
      googleId: (insertUser as any).googleId || null,
      facebookId: (insertUser as any).facebookId || null,
      birthDate: insertUser.birthDate || null,
      address: insertUser.address || null,
      occupation: insertUser.occupation || null,
      monthlyIncome: insertUser.monthlyIncome || null,
      idCardNumber: insertUser.idCardNumber || null,
      profilePicture: insertUser.profilePicture || null
    };
    this.usersStore.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.usersStore.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.usersStore.values());
  }

  // Loan methods
  async getLoan(id: number): Promise<Loan | undefined> {
    return this.loansStore.get(id);
  }

  async getLoansByUserId(userId: number): Promise<Loan[]> {
    return Array.from(this.loansStore.values()).filter(
      (loan) => loan.userId === userId
    );
  }

  async getAllLoans(): Promise<Loan[]> {
    return Array.from(this.loansStore.values());
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const id = this.loanIdCounter++;
    const now = new Date();
    const loan: Loan = {
      ...insertLoan,
      id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      adminId: null,
      adminNote: null,
      purpose: insertLoan.purpose || null,
      idCardDocument: insertLoan.idCardDocument || null,
      salaryDocument: insertLoan.salaryDocument || null
    };
    this.loansStore.set(id, loan);
    return loan;
  }

  async updateLoan(id: number, updates: Partial<Loan>): Promise<Loan | undefined> {
    const loan = await this.getLoan(id);
    if (!loan) return undefined;

    const updatedLoan = {
      ...loan,
      ...updates,
      updatedAt: new Date()
    };
    this.loansStore.set(id, updatedLoan);
    return updatedLoan;
  }

  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messagesStore.get(id);
  }

  async getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]> {
    return Array.from(this.messagesStore.values())
      .filter(message =>
        (message.senderId === user1Id && message.receiverId === user2Id) ||
        (message.senderId === user2Id && message.receiverId === user1Id)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getUserMessages(userId: number): Promise<Message[]> {
    return Array.from(this.messagesStore.values())
      .filter(message =>
        message.senderId === userId || message.receiverId === userId
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const message: Message = {
      ...insertMessage,
      id,
      isRead: false,
      createdAt: now
    };
    this.messagesStore.set(id, message);
    return message;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = await this.getMessage(id);
    if (!message) return undefined;

    const updatedMessage = { ...message, isRead: true };
    this.messagesStore.set(id, updatedMessage);
    return updatedMessage;
  }

  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notificationsStore.get(id);
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notificationsStore.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const now = new Date();
    const notification: Notification = {
      ...insertNotification,
      id,
      isRead: false,
      createdAt: now,
      relatedEntityId: insertNotification.relatedEntityId || null
    };
    this.notificationsStore.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = await this.getNotification(id);
    if (!notification) return undefined;

    const updatedNotification = { ...notification, isRead: true };
    this.notificationsStore.set(id, updatedNotification);
    return updatedNotification;
  }

  // Account methods
  async getAccount(userId: number): Promise<Account | undefined> {
    // Find account by userId
    return Array.from(this.accountsStore.values()).find(
      (account) => account.userId === userId
    );
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const id = this.userIdCounter++; // Using a new counter could be better
    const now = new Date();
    const account: Account = {
      ...insertAccount,
      id,
      balance: insertAccount.balance || 0,
      createdAt: now,
      updatedAt: now
    };
    this.accountsStore.set(id, account);
    return account;
  }

  async updateAccountBalance(userId: number, amount: number): Promise<Account | undefined> {
    let account = await this.getAccount(userId);

    // If account doesn't exist, create a new one
    if (!account) {
      account = await this.createAccount({ userId, balance: 0 });
    }

    // Update balance
    const updatedAccount = {
      ...account,
      balance: account.balance + amount,
      updatedAt: new Date()
    };
    this.accountsStore.set(account.id, updatedAccount);
    return updatedAccount;
  }

  // Withdrawal methods
  async getWithdrawal(id: number): Promise<Withdrawal | undefined> {
    return this.withdrawalsStore.get(id);
  }

  async getUserWithdrawals(userId: number): Promise<Withdrawal[]> {
    return Array.from(this.withdrawalsStore.values())
      .filter(withdrawal => withdrawal.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return Array.from(this.withdrawalsStore.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async createWithdrawal(insertWithdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const id = this.withdrawalIdCounter++;
    const now = new Date();
    const withdrawal: Withdrawal = {
      ...insertWithdrawal,
      id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      adminId: null,
      adminNote: null
    };
    this.withdrawalsStore.set(id, withdrawal);

    // Deduct balance from user account temporarily
    const account = await this.getAccount(insertWithdrawal.userId);
    if (account && account.balance >= insertWithdrawal.amount) {
      await this.updateAccountBalance(insertWithdrawal.userId, -insertWithdrawal.amount);
    }

    return withdrawal;
  }

  async updateWithdrawal(id: number, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    const withdrawal = await this.getWithdrawal(id);
    if (!withdrawal) return undefined;

    // If status is changing to rejected, refund the money
    if (updates.status === "rejected" && withdrawal.status !== "rejected") {
      await this.updateAccountBalance(withdrawal.userId, withdrawal.amount);
    }

    const updatedWithdrawal = {
      ...withdrawal,
      ...updates,
      updatedAt: new Date()
    };
    this.withdrawalsStore.set(id, updatedWithdrawal);
    return updatedWithdrawal;
  }
  
  // Bank Account methods
  async getBankAccount(id: number): Promise<BankAccount | undefined> {
    return this.bankAccountsStore.get(id);
  }

  async getUserBankAccounts(userId: number): Promise<BankAccount[]> {
    return Array.from(this.bankAccountsStore.values())
      .filter(account => account.userId === userId)
      .sort((a, b) => (a.isDefault === b.isDefault) ? 0 : a.isDefault ? -1 : 1);
  }

  async createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount> {
    const id = this.bankAccountIdCounter++;
    const now = new Date();
    
    // Check if this is the first account for the user
    const userAccounts = await this.getUserBankAccounts(insertBankAccount.userId);
    const isDefault = userAccounts.length === 0;
    
    const bankAccount: BankAccount = {
      ...insertBankAccount,
      id,
      createdAt: now,
      isDefault
    };
    
    this.bankAccountsStore.set(id, bankAccount);
    return bankAccount;
  }

  async updateBankAccount(id: number, updates: Partial<BankAccount>): Promise<BankAccount | undefined> {
    const bankAccount = await this.getBankAccount(id);
    if (!bankAccount) return undefined;

    const updatedBankAccount = {
      ...bankAccount,
      ...updates
    };
    
    this.bankAccountsStore.set(id, updatedBankAccount);
    return updatedBankAccount;
  }

  async deleteBankAccount(id: number): Promise<boolean> {
    const bankAccount = await this.getBankAccount(id);
    if (!bankAccount) return false;
    
    // If this is a default account, try to find another account for the user and make it default
    if (bankAccount.isDefault) {
      const userAccounts = await this.getUserBankAccounts(bankAccount.userId);
      const otherAccount = userAccounts.find(acc => acc.id !== id);
      if (otherAccount) {
        await this.updateBankAccount(otherAccount.id, { isDefault: true });
      }
    }
    
    return this.bankAccountsStore.delete(id);
  }

  async setDefaultBankAccount(userId: number, accountId: number): Promise<boolean> {
    const bankAccount = await this.getBankAccount(accountId);
    if (!bankAccount || bankAccount.userId !== userId) return false;
    
    // First, set all user's accounts to non-default
    const userAccounts = await this.getUserBankAccounts(userId);
    for (const account of userAccounts) {
      if (account.isDefault && account.id !== accountId) {
        await this.updateBankAccount(account.id, { isDefault: false });
      }
    }
    
    // Then set the selected account as default
    await this.updateBankAccount(accountId, { isDefault: true });
    return true;
  }

  // Stock methods
  async getStock(id: number): Promise<Stock | undefined> {
    return this.stocksStore.get(id);
  }

  async getStockBySymbol(symbol: string): Promise<Stock | undefined> {
    return Array.from(this.stocksStore.values()).find(
      (stock) => stock.symbol.toUpperCase() === symbol.toUpperCase()
    );
  }

  async getAllStocks(): Promise<Stock[]> {
    return Array.from(this.stocksStore.values())
      .filter(stock => stock.isActive)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const id = this.stockIdCounter++;
    const now = new Date();
    const stock: Stock = {
      ...insertStock,
      id,
      isActive: true,
      lastUpdated: now,
      createdAt: now
    };
    this.stocksStore.set(id, stock);
    return stock;
  }

  async updateStock(id: number, updates: Partial<Stock>): Promise<Stock | undefined> {
    const stock = await this.getStock(id);
    if (!stock) return undefined;

    const updatedStock = {
      ...stock,
      ...updates,
      lastUpdated: new Date()
    };
    this.stocksStore.set(id, updatedStock);
    return updatedStock;
  }

  async updateStockPrice(id: number, currentPrice: number): Promise<Stock | undefined> {
    const stock = await this.getStock(id);
    if (!stock) return undefined;

    const previousPrice = stock.currentPrice;
    const change = currentPrice - stock.previousClose;
    const changePercent = (change / stock.previousClose) * 100;
    const now = new Date();

    const updatedStock = {
      ...stock,
      currentPrice,
      change,
      changePercent,
      lastUpdated: now
    };
    this.stocksStore.set(id, updatedStock);
    
    // บันทึกข้อมูลราคาหุ้นเพื่อใช้ในการแสดงกราฟ
    try {
      await this.saveStockPriceHistory({
        stockId: id,
        timestamp: now,
        open: previousPrice,
        high: Math.max(previousPrice, currentPrice),
        low: Math.min(previousPrice, currentPrice),
        close: currentPrice,
        volume: Math.floor(Math.random() * 10000), // สำหรับ in-memory จำลองปริมาณการซื้อขาย
        interval: '1min'
      });
    } catch (error) {
      log(`Error saving stock price history: ${error}`, "storage");
    }
    
    return updatedStock;
  }
  
  // Stock price history methods
  async getStockPriceHistory(stockId: number, interval: string, limit?: number): Promise<StockPriceHistory[]> {
    const allHistory = Array.from(this.stockPriceHistoryStore.values())
      .filter(history => history.stockId === stockId && history.interval === interval)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // เรียงจากใหม่ไปเก่า
    
    return limit ? allHistory.slice(0, limit) : allHistory;
  }
  
  async saveStockPriceHistory(history: InsertStockPriceHistory): Promise<StockPriceHistory> {
    const id = this.stockPriceHistoryIdCounter++;
    const priceHistory: StockPriceHistory = {
      ...history,
      id
    };
    this.stockPriceHistoryStore.set(id, priceHistory);
    return priceHistory;
  }
  
  async getLatestStockPrice(stockId: number, interval: string): Promise<StockPriceHistory | undefined> {
    const history = await this.getStockPriceHistory(stockId, interval, 1);
    return history.length > 0 ? history[0] : undefined;
  }
  
  async deleteOldStockPriceHistory(olderThan: Date): Promise<number> {
    let deletedCount = 0;
    const idsToDelete: number[] = [];
    
    // หา ID ของข้อมูลที่เก่ากว่าวันที่กำหนด
    for (const [id, history] of this.stockPriceHistoryStore.entries()) {
      if (history.timestamp < olderThan) {
        idsToDelete.push(id);
      }
    }
    
    // ลบข้อมูล
    for (const id of idsToDelete) {
      if (this.stockPriceHistoryStore.delete(id)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  // Deposit methods
  async getDeposit(id: number): Promise<Deposit | undefined> {
    return this.depositsStore.get(id);
  }

  async getUserDeposits(userId: number): Promise<Deposit[]> {
    return Array.from(this.depositsStore.values())
      .filter(deposit => deposit.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async getAllDeposits(): Promise<Deposit[]> {
    return Array.from(this.depositsStore.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async createDeposit(insertDeposit: InsertDeposit): Promise<Deposit> {
    const id = this.depositIdCounter++;
    const now = new Date();
    const deposit: Deposit = {
      ...insertDeposit,
      id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      adminId: null,
      adminNote: null,
      slipImageUrl: insertDeposit.slipImageUrl || null
    };
    this.depositsStore.set(id, deposit);
    return deposit;
  }

  async updateDeposit(id: number, updates: Partial<Deposit>): Promise<Deposit | undefined> {
    const deposit = await this.getDeposit(id);
    if (!deposit) return undefined;

    // If status is changing to approved, add the amount to the user's account
    if (updates.status === "approved" && deposit.status !== "approved") {
      await this.updateAccountBalance(deposit.userId, deposit.amount);
    }

    const updatedDeposit = {
      ...deposit,
      ...updates,
      updatedAt: new Date()
    };
    this.depositsStore.set(id, updatedDeposit);
    return updatedDeposit;
  }

  // Stock trade methods
  async getStockTrade(id: number): Promise<StockTrade | undefined> {
    return this.stockTradesStore.get(id);
  }

  async getUserStockTrades(userId: number): Promise<StockTrade[]> {
    return Array.from(this.stockTradesStore.values())
      .filter(trade => trade.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async getActiveUserStockTrades(userId: number): Promise<StockTrade[]> {
    return Array.from(this.stockTradesStore.values())
      .filter(trade => trade.userId === userId && trade.status === "active")
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()); // Oldest first (to process expiring trades first)
  }

  async getAllStockTrades(): Promise<StockTrade[]> {
    return Array.from(this.stockTradesStore.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first
  }

  async createStockTrade(insertTrade: InsertStockTrade): Promise<StockTrade> {
    const id = this.stockTradeIdCounter++;
    const now = new Date();
    
    // ตรวจสอบว่ามีหุ้นที่จะเทรดหรือไม่
    const stock = await this.getStock(insertTrade.stockId);
    if (!stock) {
      throw new Error("Stock not found");
    }

    // คำนวณ multiplier ตามระยะเวลา
    let multiplier = 1.8; // default for 90s and 120s
    if (insertTrade.duration === 300) {
      multiplier = 2.6;
    }

    // คำนวณเงินที่จะได้รับหากชนะ
    const potentialPayout = Math.round(insertTrade.amount * multiplier);

    const trade: StockTrade = {
      ...insertTrade,
      id,
      multiplier,
      startPrice: stock.currentPrice,
      startTime: now,
      status: "active",
      potentialPayout,
      endPrice: null,
      endTime: null,
      payoutAmount: null,
      createdAt: now
    };

    // ตัดเงินจากบัญชีผู้ใช้
    const account = await this.getAccount(insertTrade.userId);
    if (!account || account.balance < insertTrade.amount) {
      throw new Error("Insufficient balance");
    }
    await this.updateAccountBalance(insertTrade.userId, -insertTrade.amount);

    this.stockTradesStore.set(id, trade);
    return trade;
  }

  async updateStockTrade(id: number, updates: Partial<StockTrade>): Promise<StockTrade | undefined> {
    const trade = await this.getStockTrade(id);
    if (!trade) return undefined;

    const updatedTrade = {
      ...trade,
      ...updates
    };
    this.stockTradesStore.set(id, updatedTrade);
    return updatedTrade;
  }

  async completeStockTrade(id: number, endPrice: number, status: string): Promise<StockTrade | undefined> {
    const trade = await this.getStockTrade(id);
    if (!trade || trade.status !== "active") return undefined;

    const now = new Date();
    let payoutAmount = null;

    // ตรวจสอบผลการเทรด
    if (status === "win") {
      payoutAmount = trade.potentialPayout;
      // เพิ่มเงินเข้าบัญชีผู้ใช้
      await this.updateAccountBalance(trade.userId, payoutAmount);
    }

    const updatedTrade = {
      ...trade,
      endPrice,
      endTime: now,
      status,
      payoutAmount
    };
    
    this.stockTradesStore.set(id, updatedTrade);
    return updatedTrade;
  }

  // System settings methods
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    return Array.from(this.systemSettingsStore.values()).find(
      (setting) => setting.settingKey === key
    );
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return Array.from(this.systemSettingsStore.values());
  }

  async createSystemSetting(insertSetting: InsertSystemSetting): Promise<SystemSetting> {
    const id = this.systemSettingIdCounter++;
    const now = new Date();
    
    const setting: SystemSetting = {
      ...insertSetting,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.systemSettingsStore.set(setting.settingKey, setting);
    return setting;
  }

  async updateSystemSetting(key: string, value: any): Promise<SystemSetting | undefined> {
    const setting = await this.getSystemSetting(key);
    if (!setting) return undefined;
    
    const updatedSetting = {
      ...setting,
      settingValue: value,
      updatedAt: new Date()
    };
    
    this.systemSettingsStore.set(key, updatedSetting);
    return updatedSetting;
  }

  async getDepositBankInfo(): Promise<any> {
    const accountName = await this.getSystemSetting('deposit_account_name');
    const bankName = await this.getSystemSetting('deposit_bank_name');
    const accountNumber = await this.getSystemSetting('deposit_account_number');
    const qrCodeUrl = await this.getSystemSetting('deposit_qr_code');
    
    // If settings don't exist, create default values
    if (!accountName) {
      await this.createSystemSetting({
        settingKey: 'deposit_account_name',
        settingValue: 'บริษัท กรุงศรี ไอฟิน จำกัด',
        description: 'ชื่อบัญชีธนาคารสำหรับการฝากเงิน'
      });
    }
    
    if (!bankName) {
      await this.createSystemSetting({
        settingKey: 'deposit_bank_name',
        settingValue: 'ธนาคารกรุงศรีอยุธยา',
        description: 'ชื่อธนาคารสำหรับการฝากเงิน'
      });
    }
    
    if (!accountNumber) {
      await this.createSystemSetting({
        settingKey: 'deposit_account_number',
        settingValue: '123-4-56789-0',
        description: 'เลขบัญชีธนาคารสำหรับการฝากเงิน'
      });
    }
    
    if (!qrCodeUrl) {
      await this.createSystemSetting({
        settingKey: 'deposit_qr_code',
        settingValue: '/images/qr-code-placeholder.png',
        description: 'URL ของรูปภาพ QR Code สำหรับการฝากเงิน'
      });
    }
    
    // Get fresh data after potentially creating default values
    return {
      accountName: (await this.getSystemSetting('deposit_account_name'))?.settingValue,
      bankName: (await this.getSystemSetting('deposit_bank_name'))?.settingValue,
      accountNumber: (await this.getSystemSetting('deposit_account_number'))?.settingValue,
      qrCodeUrl: (await this.getSystemSetting('deposit_qr_code'))?.settingValue
    };
  }
}

// PostgreSQL storage implementation
export class PostgresStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Use MemoryStore for sessions instead of PgSessionStore due to compatibility issues
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Clear expired sessions every 24h
    });

    // Initialize with admin user and stocks
    this.initializeAdminUser();
  }

  private async initializeAdminUser() {
    try {
      // Check if we already have admin user
      const adminUser = await this.getUserByUsername('admin');
      if (adminUser) {
        log(`Admin user already exists with ID: ${adminUser.id}`, "storage");
        await this.initializeMockStocks();
        return;
      }

      // Create admin user
      hashInitialPassword("admin123").then(async (hashedPassword) => {
        try {
          const admin = await this.createUser({
            username: "admin",
            password: hashedPassword,
            email: "admin@cashluxe.com",
            fullName: "System Administrator",
            phone: "099-999-9999",
            authProvider: 'local',
            isAdmin: true,
            isActive: true,
            status: "active",
          });
          
          log(`Admin user created with ID: ${admin.id}`, "storage");
          
          // Create admin account with initial balance
          const account = await this.createAccount({
            userId: admin.id,
            balance: 100000, // 100,000 THB สำหรับทดสอบ
          });
          
          log(`Admin account created with ID: ${account.id}`, "storage");
          
          // Initialize mock stocks
          await this.initializeMockStocks();
        } catch (error) {
          log(`Error creating admin user: ${error}`, "storage");
        }
      });
    } catch (error) {
      log(`Error checking for admin user: ${error}`, "storage");
    }
  }

  // Method to initialize mock stock data
  private async initializeMockStocks() {
    try {
      // Import mock stocks from mock-stocks.ts
      const { mockStocks } = await import('./mock-stocks');
      
      // Check if we already have stocks
      if ((await this.getAllStocks()).length > 0) {
        log(`Stocks already exist in database, skipping initialization`, "storage");
        return;
      }
      
      // Add each mock stock
      for (const mockStock of mockStocks) {
        try {
          // Generate sentiment data based on stock movement
          const { generateSentiment } = await import('./mock-stocks');
          const sentimentData = generateSentiment(mockStock.changePercent);
          
          await this.createStock({
            symbol: mockStock.symbol,
            name: mockStock.name,
            exchange: mockStock.exchange,
            currentPrice: mockStock.currentPrice,
            previousClose: mockStock.previousClose,
            change: mockStock.change,
            changePercent: mockStock.changePercent,
            logoUrl: mockStock.logoUrl,
            sector: mockStock.sector,
            description: mockStock.description,
            // Add sentiment data
            sentimentScore: sentimentData.sentimentScore,
            sentimentVolume: sentimentData.sentimentVolume,
            sentimentTrend: sentimentData.sentimentTrend
          });
        } catch (error) {
          log(`Error creating mock stock ${mockStock.symbol}: ${error}`, "storage");
        }
      }
      
      log(`Initialized ${mockStocks.length} mock stocks`, "storage");
    } catch (error) {
      log(`Failed to initialize mock stocks: ${error}`, "storage");
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting user by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting user by username ${username}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting user by email ${email}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting user by Google ID ${googleId}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserByFacebookId(facebookId: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.facebookId, facebookId)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting user by Facebook ID ${facebookId}: ${error}`, "storage");
      return undefined;
    }
  }

  async createUser(insertUser: Omit<InsertUser, "confirmPassword">): Promise<User> {
    try {
      const result = await db.insert(users).values({
        username: insertUser.username,
        password: insertUser.password || null,
        email: insertUser.email,
        fullName: insertUser.fullName,
        phone: insertUser.phone,
        age: insertUser.age || null,
        birthDate: insertUser.birthDate || null,
        address: insertUser.address || null,
        occupation: insertUser.occupation || null,
        monthlyIncome: insertUser.monthlyIncome || null,
        remainingIncome: insertUser.remainingIncome || null,
        idCardNumber: insertUser.idCardNumber || null,
        profilePicture: insertUser.profilePicture || null,
        frontIdCardImage: insertUser.frontIdCardImage || null,
        backIdCardImage: insertUser.backIdCardImage || null,
        selfieWithIdCardImage: insertUser.selfieWithIdCardImage || null,
        isAdmin: insertUser.isAdmin || false,
        isActive: insertUser.isActive !== undefined ? insertUser.isActive : true,
        status: insertUser.status || "active",
        googleId: (insertUser as any).googleId || null,
        facebookId: (insertUser as any).facebookId || null,
        authProvider: insertUser.authProvider || "local",
      }).returning();

      const createdUser = result[0];
      return createdUser;
    } catch (error) {
      log(`Error creating user ${insertUser.username}: ${error}`, "storage");
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    try {
      const result = await db.update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating user ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      log(`Error getting all users: ${error}`, "storage");
      return [];
    }
  }

  // Loan methods
  async getLoan(id: number): Promise<Loan | undefined> {
    try {
      const result = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting loan by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getLoansByUserId(userId: number): Promise<Loan[]> {
    try {
      return await db.select().from(loans).where(eq(loans.userId, userId));
    } catch (error) {
      log(`Error getting loans for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async getAllLoans(): Promise<Loan[]> {
    try {
      return await db.select().from(loans);
    } catch (error) {
      log(`Error getting all loans: ${error}`, "storage");
      return [];
    }
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    try {
      const now = new Date();
      const result = await db.insert(loans).values({
        ...insertLoan,
        status: "pending",
        adminId: null,
        adminNote: null,
        createdAt: now,
        updatedAt: now,
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating loan: ${error}`, "storage");
      throw error;
    }
  }

  async updateLoan(id: number, updates: Partial<Loan>): Promise<Loan | undefined> {
    try {
      const now = new Date();
      const result = await db.update(loans)
        .set({
          ...updates,
          updatedAt: now
        })
        .where(eq(loans.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating loan ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    try {
      const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting message by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]> {
    try {
      return await db.select().from(messages)
        .where(
          or(
            and(
              eq(messages.senderId, user1Id),
              eq(messages.receiverId, user2Id)
            ),
            and(
              eq(messages.senderId, user2Id),
              eq(messages.receiverId, user1Id)
            )
          )
        )
        .orderBy(asc(messages.createdAt));
    } catch (error) {
      log(`Error getting messages between users ${user1Id} and ${user2Id}: ${error}`, "storage");
      return [];
    }
  }

  async getUserMessages(userId: number): Promise<Message[]> {
    try {
      return await db.select().from(messages)
        .where(
          or(
            eq(messages.senderId, userId),
            eq(messages.receiverId, userId)
          )
        )
        .orderBy(asc(messages.createdAt));
    } catch (error) {
      log(`Error getting messages for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      const result = await db.insert(messages).values({
        ...insertMessage,
        isRead: false,
        readAt: null,
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating message: ${error}`, "storage");
      throw error;
    }
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    try {
      const now = new Date();
      const result = await db.update(messages)
        .set({
          isRead: true,
          readAt: now
        })
        .where(eq(messages.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error marking message ${id} as read: ${error}`, "storage");
      return undefined;
    }
  }

  // Notification methods
  async getNotification(id: number): Promise<Notification | undefined> {
    try {
      const result = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting notification by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserNotifications(userId: number): Promise<Notification[]> {
    try {
      return await db.select().from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      log(`Error getting notifications for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    try {
      const result = await db.insert(notifications).values({
        ...insertNotification,
        isRead: false,
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating notification: ${error}`, "storage");
      throw error;
    }
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    try {
      const result = await db.update(notifications)
        .set({
          isRead: true
        })
        .where(eq(notifications.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error marking notification ${id} as read: ${error}`, "storage");
      return undefined;
    }
  }

  // Account methods
  async getAccount(userId: number): Promise<Account | undefined> {
    try {
      const result = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting account for user ${userId}: ${error}`, "storage");
      return undefined;
    }
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    try {
      const now = new Date();
      const result = await db.insert(accounts).values({
        ...insertAccount,
        balance: insertAccount.balance || 0,
        createdAt: now,
        updatedAt: now
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating account: ${error}`, "storage");
      throw error;
    }
  }

  async updateAccountBalance(userId: number, amount: number): Promise<Account | undefined> {
    try {
      let account = await this.getAccount(userId);

      // ถ้าบัญชียังไม่มี ให้สร้างใหม่
      if (!account) {
        account = await this.createAccount({ userId, balance: 0 });
      }

      // อัพเดทยอดเงิน
      const now = new Date();
      const result = await db.update(accounts)
        .set({
          balance: account.balance + amount,
          updatedAt: now
        })
        .where(eq(accounts.userId, userId))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating account balance for user ${userId}: ${error}`, "storage");
      return undefined;
    }
  }

  // Withdrawal methods
  async getWithdrawal(id: number): Promise<Withdrawal | undefined> {
    try {
      const result = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting withdrawal by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserWithdrawals(userId: number): Promise<Withdrawal[]> {
    try {
      return await db.select().from(withdrawals)
        .where(eq(withdrawals.userId, userId))
        .orderBy(desc(withdrawals.createdAt));
    } catch (error) {
      log(`Error getting withdrawals for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    try {
      return await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
    } catch (error) {
      log(`Error getting all withdrawals: ${error}`, "storage");
      return [];
    }
  }

  async createWithdrawal(insertWithdrawal: InsertWithdrawal): Promise<Withdrawal> {
    try {
      const now = new Date();
      // Create the withdrawal record
      const result = await db.insert(withdrawals).values({
        ...insertWithdrawal,
        status: "pending",
        adminId: null,
        adminNote: null,
        createdAt: now,
        updatedAt: now
      }).returning();
      
      // Get the new withdrawal record
      const withdrawal = result[0];
      
      // ตรวจสอบว่ามียอดเงินเพียงพอหรือไม่ แต่ยังไม่หักเงิน
      // จะหักเงินก็ต่อเมื่อแอดมินอนุมัติคำขอ
      const account = await this.getAccount(insertWithdrawal.userId);
      if (!account || account.balance < withdrawal.amount) {
        throw new Error("ยอดเงินในบัญชีไม่เพียงพอสำหรับการถอน");
      }

      return withdrawal;
    } catch (error) {
      log(`Error creating withdrawal: ${error}`, "storage");
      throw error;
    }
  }

  async updateWithdrawal(id: number, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    try {
      // Get the current withdrawal first
      const withdrawal = await this.getWithdrawal(id);
      if (!withdrawal) return undefined;
      
      // เพิ่มตรรกะการหักเงินเมื่ออนุมัติ
      if (updates.status === "approved" && withdrawal.status !== "approved") {
        // เมื่ออนุมัติ หักเงินจากบัญชี
        await this.updateAccountBalance(withdrawal.userId, -withdrawal.amount);
      }
      
      // กรณีปฏิเสธ ไม่ต้องทำอะไร เพราะยังไม่ได้หักเงินตั้งแต่แรก
      
      // Update the record
      const now = new Date();
      const result = await db.update(withdrawals)
        .set({
          ...updates,
          updatedAt: now
        })
        .where(eq(withdrawals.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating withdrawal ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  // Stock methods
  async getStock(id: number): Promise<Stock | undefined> {
    try {
      const result = await db.select().from(stocks).where(eq(stocks.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting stock by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getStockBySymbol(symbol: string): Promise<Stock | undefined> {
    try {
      const result = await db.select().from(stocks).where(eq(stocks.symbol, symbol)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting stock by symbol ${symbol}: ${error}`, "storage");
      return undefined;
    }
  }

  async getAllStocks(): Promise<Stock[]> {
    try {
      return await db.select().from(stocks).where(eq(stocks.isActive, true));
    } catch (error) {
      log(`Error getting all stocks: ${error}`, "storage");
      return [];
    }
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    try {
      const now = new Date();
      const result = await db.insert(stocks).values({
        ...insertStock,
        isActive: true,
        lastUpdated: now,
        createdAt: now
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating stock: ${error}`, "storage");
      throw error;
    }
  }

  async updateStock(id: number, updates: Partial<Stock>): Promise<Stock | undefined> {
    try {
      const now = new Date();
      const result = await db.update(stocks)
        .set({
          ...updates,
          lastUpdated: now
        })
        .where(eq(stocks.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating stock ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async updateStockPrice(id: number, currentPrice: number): Promise<Stock | undefined> {
    try {
      const stock = await this.getStock(id);
      if (!stock) return undefined;

      const change = currentPrice - stock.previousClose;
      const changePercent = (change / stock.previousClose) * 100;
      
      const now = new Date();
      
      // ปรับค่า sentiment ตามการเปลี่ยนแปลงราคา
      const { generateSentiment } = await import('./mock-stocks');
      const sentimentData = generateSentiment(changePercent);
      
      const result = await db.update(stocks)
        .set({
          currentPrice,
          change,
          changePercent,
          lastUpdated: now,
          sentimentScore: sentimentData.sentimentScore,
          sentimentVolume: sentimentData.sentimentVolume,
          sentimentTrend: sentimentData.sentimentTrend
        })
        .where(eq(stocks.id, id))
        .returning();
      
      // บันทึกข้อมูลราคาหุ้นสำหรับการสร้างกราฟ
      try {
        const previousPrice = stock.currentPrice;
        await this.saveStockPriceHistory({
          stockId: id,
          timestamp: now,
          open: previousPrice,
          high: Math.max(previousPrice, currentPrice),
          low: Math.min(previousPrice, currentPrice),
          close: currentPrice,
          volume: Math.floor(Math.random() * 10000), // สำหรับจำลองปริมาณการซื้อขาย
          interval: '1min'
        });
      } catch (historyError) {
        log(`Error saving stock price history: ${historyError}`, "storage");
      }
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating stock price for ${id}: ${error}`, "storage");
      return undefined;
    }
  }
  
  // Stock price history methods
  async getStockPriceHistory(stockId: number, interval: string, limit?: number): Promise<StockPriceHistory[]> {
    try {
      const query = db.select()
        .from(stockPriceHistory)
        .where(and(
          eq(stockPriceHistory.stockId, stockId),
          eq(stockPriceHistory.interval, interval)
        ))
        .orderBy(desc(stockPriceHistory.timestamp));
      
      if (limit) {
        query.limit(limit);
      }
      
      return await query;
    } catch (error) {
      log(`Error getting stock price history: ${error}`, "storage");
      return [];
    }
  }
  
  async saveStockPriceHistory(historyData: InsertStockPriceHistory): Promise<StockPriceHistory> {
    try {
      const result = await db.insert(stockPriceHistory)
        .values(historyData)
        .returning();
      
      return result[0];
    } catch (error) {
      log(`Error saving stock price history: ${error}`, "storage");
      throw error;
    }
  }
  
  async getLatestStockPrice(stockId: number, interval: string): Promise<StockPriceHistory | undefined> {
    try {
      const result = await db.select()
        .from(stockPriceHistory)
        .where(and(
          eq(stockPriceHistory.stockId, stockId),
          eq(stockPriceHistory.interval, interval)
        ))
        .orderBy(desc(stockPriceHistory.timestamp))
        .limit(1);
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting latest stock price: ${error}`, "storage");
      return undefined;
    }
  }
  
  async deleteOldStockPriceHistory(olderThan: Date): Promise<number> {
    try {
      const result = await db.delete(stockPriceHistory)
        .where(lt(stockPriceHistory.timestamp, olderThan))
        .returning();
      
      return result.length;
    } catch (error) {
      log(`Error deleting old stock price history: ${error}`, "storage");
      return 0;
    }
  }

  // Stock trade methods
  async getStockTrade(id: number): Promise<StockTrade | undefined> {
    try {
      const result = await db.select().from(stockTrades).where(eq(stockTrades.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting stock trade by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserStockTrades(userId: number): Promise<StockTrade[]> {
    try {
      return await db.select().from(stockTrades)
        .where(eq(stockTrades.userId, userId))
        .orderBy(desc(stockTrades.createdAt));
    } catch (error) {
      log(`Error getting stock trades for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async getActiveUserStockTrades(userId: number): Promise<StockTrade[]> {
    try {
      return await db.select().from(stockTrades)
        .where(and(
          eq(stockTrades.userId, userId),
          eq(stockTrades.status, "active")
        ))
        .orderBy(desc(stockTrades.createdAt));
    } catch (error) {
      log(`Error getting active stock trades for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async getAllStockTrades(): Promise<StockTrade[]> {
    try {
      return await db.select().from(stockTrades).orderBy(desc(stockTrades.createdAt));
    } catch (error) {
      log(`Error getting all stock trades: ${error}`, "storage");
      return [];
    }
  }

  async createStockTrade(insertTrade: InsertStockTrade): Promise<StockTrade> {
    try {
      const now = new Date();
      
      // ต้องเพิ่มข้อมูลผู้ใช้จาก session ก่อนการสร้าง
      if (!insertTrade.userId) {
        throw new Error("Missing userId for stock trade");
      }
      
      const result = await db.insert(stockTrades).values({
        ...insertTrade,
        status: insertTrade.status || "active",
        startTime: now,
        endPrice: null,
        endTime: null,
        payoutAmount: null,
        createdAt: now
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating stock trade: ${error}`, "storage");
      throw error;
    }
  }

  async updateStockTrade(id: number, updates: Partial<StockTrade>): Promise<StockTrade | undefined> {
    try {
      const result = await db.update(stockTrades)
        .set(updates)
        .where(eq(stockTrades.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating stock trade ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async completeStockTrade(id: number, endPrice: number, status: string): Promise<StockTrade | undefined> {
    try {
      const trade = await this.getStockTrade(id);
      if (!trade) return undefined;
      
      // ตรวจสอบว่าการเทรดนี้อยู่ในสถานะ active ไม่
      if (trade.status !== "active") {
        log(`Cannot complete trade ${id} because it is already in status: ${trade.status}`, "storage");
        return undefined;
      }

      const now = new Date();
      let payoutAmount = null;
      
      // ตรวจสอบอีกครั้งว่ามี adminForceResult หรือไม่ ก่อนดำเนินการต่อ
      // ถ้ามี adminForceResult ให้ใช้ค่านั้นแทนค่า status ที่ส่งมา
      let finalStatus = status;
      
      if (trade.adminForceResult) {
        finalStatus = trade.adminForceResult;
        log(`Using admin forced result (storage): ${finalStatus} instead of ${status} for trade ${id}`, "storage");
      }
      
      // ถ้าสถานะเป็น "win" ให้คำนวณเงินรางวัล
      if (finalStatus === "win") {
        payoutAmount = Math.floor(trade.potentialPayout); // ปัดลงให้เป็นจำนวนเต็ม
        
        // เพิ่มเงินเข้าบัญชีผู้ใช้
        await this.updateAccountBalance(trade.userId, payoutAmount);
        
        log(`User ${trade.userId} won trade ${id} and received ${payoutAmount}`, "storage");
      } else {
        log(`User ${trade.userId} lost trade ${id} with amount ${trade.amount}`, "storage");
      }

      // แสดงผลว่าใช้ adminForceResult หรือไม่
      if (trade.adminForceResult) {
        log(`Trade ${id} completed with admin forced result: ${trade.adminForceResult}`, "storage");
      }

      const result = await db.update(stockTrades)
        .set({
          endPrice,
          endTime: now,
          status: finalStatus, // ใช้ finalStatus ที่อาจถูกเปลี่ยนแปลงโดย adminForceResult
          payoutAmount
        })
        .where(eq(stockTrades.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error completing stock trade ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  // Deposit methods
  async getDeposit(id: number): Promise<Deposit | undefined> {
    try {
      const result = await db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting deposit by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserDeposits(userId: number): Promise<Deposit[]> {
    try {
      return await db.select().from(deposits)
        .where(eq(deposits.userId, userId))
        .orderBy(desc(deposits.createdAt));
    } catch (error) {
      log(`Error getting deposits for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async getAllDeposits(): Promise<Deposit[]> {
    try {
      return await db.select().from(deposits).orderBy(desc(deposits.createdAt));
    } catch (error) {
      log(`Error getting all deposits: ${error}`, "storage");
      return [];
    }
  }

  async createDeposit(insertDeposit: InsertDeposit): Promise<Deposit> {
    try {
      const result = await db.insert(deposits).values({
        ...insertDeposit,
        status: insertDeposit.status || 'pending',
        slipImageUrl: insertDeposit.slipImageUrl || null
      }).returning();
      
      if (result.length === 0) {
        throw new Error("Failed to create deposit record");
      }
      
      return result[0];
    } catch (error) {
      log(`Error creating deposit: ${error}`, "storage");
      throw error;
    }
  }

  async updateDeposit(id: number, updates: Partial<Deposit>): Promise<Deposit | undefined> {
    try {
      const result = await db.update(deposits)
        .set(updates)
        .where(eq(deposits.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating deposit ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  // Bank Account methods
  async getBankAccount(id: number): Promise<BankAccount | undefined> {
    try {
      const result = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting bank account by ID ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async getUserBankAccounts(userId: number): Promise<BankAccount[]> {
    try {
      return await db.select().from(bankAccounts)
        .where(eq(bankAccounts.userId, userId))
        .orderBy(desc(bankAccounts.isDefault), desc(bankAccounts.createdAt));
    } catch (error) {
      log(`Error getting bank accounts for user ${userId}: ${error}`, "storage");
      return [];
    }
  }

  async createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount> {
    try {
      // Check if this is the first account for the user
      const userAccounts = await this.getUserBankAccounts(insertBankAccount.userId);
      const isDefault = userAccounts.length === 0;
      
      const result = await db.insert(bankAccounts).values({
        ...insertBankAccount,
        isDefault
      }).returning();
      
      if (result.length === 0) {
        throw new Error("Failed to create bank account");
      }
      
      return result[0];
    } catch (error) {
      log(`Error creating bank account: ${error}`, "storage");
      throw error;
    }
  }

  async updateBankAccount(id: number, updates: Partial<BankAccount>): Promise<BankAccount | undefined> {
    try {
      const result = await db.update(bankAccounts)
        .set(updates)
        .where(eq(bankAccounts.id, id))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating bank account ${id}: ${error}`, "storage");
      return undefined;
    }
  }

  async deleteBankAccount(id: number): Promise<boolean> {
    try {
      const bankAccount = await this.getBankAccount(id);
      if (!bankAccount) return false;
      
      // If this is a default account, try to find another account for the user and make it default
      if (bankAccount.isDefault) {
        const userAccounts = await this.getUserBankAccounts(bankAccount.userId);
        const otherAccount = userAccounts.find(acc => acc.id !== id);
        if (otherAccount) {
          await this.updateBankAccount(otherAccount.id, { isDefault: true });
        }
      }
      
      const result = await db.delete(bankAccounts).where(eq(bankAccounts.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      log(`Error deleting bank account ${id}: ${error}`, "storage");
      return false;
    }
  }

  async setDefaultBankAccount(userId: number, accountId: number): Promise<boolean> {
    try {
      const bankAccount = await this.getBankAccount(accountId);
      if (!bankAccount || bankAccount.userId !== userId) return false;
      
      // First, set all user's accounts to non-default
      await db.update(bankAccounts)
        .set({ isDefault: false })
        .where(and(
          eq(bankAccounts.userId, userId),
          eq(bankAccounts.isDefault, true)
        ));
      
      // Then set the selected account as default
      const result = await db.update(bankAccounts)
        .set({ isDefault: true })
        .where(eq(bankAccounts.id, accountId))
        .returning();
        
      return result.length > 0;
    } catch (error) {
      log(`Error setting default bank account for user ${userId}: ${error}`, "storage");
      return false;
    }
  }

  // System settings methods
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    try {
      const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error getting system setting ${key}: ${error}`, "storage");
      return undefined;
    }
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    try {
      return await db.select().from(systemSettings);
    } catch (error) {
      log(`Error getting all system settings: ${error}`, "storage");
      return [];
    }
  }

  async createSystemSetting(insertSetting: InsertSystemSetting): Promise<SystemSetting> {
    try {
      const now = new Date();
      const result = await db.insert(systemSettings).values({
        ...insertSetting,
        createdAt: now,
        updatedAt: now
      }).returning();

      return result[0];
    } catch (error) {
      log(`Error creating system setting ${insertSetting.settingKey}: ${error}`, "storage");
      throw error;
    }
  }

  async updateSystemSetting(key: string, value: any): Promise<SystemSetting | undefined> {
    try {
      const now = new Date();
      const result = await db.update(systemSettings)
        .set({
          settingValue: value,
          updatedAt: now
        })
        .where(eq(systemSettings.settingKey, key))
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      log(`Error updating system setting ${key}: ${error}`, "storage");
      return undefined;
    }
  }

  async getDepositBankInfo(): Promise<any> {
    try {
      const accountName = await this.getSystemSetting('deposit_account_name');
      const bankName = await this.getSystemSetting('deposit_bank_name');
      const accountNumber = await this.getSystemSetting('deposit_account_number');
      const qrCodeUrl = await this.getSystemSetting('deposit_qr_code');
      
      // If settings don't exist, create default values
      if (!accountName) {
        await this.createSystemSetting({
          settingKey: 'deposit_account_name',
          settingValue: 'บริษัท กรุงศรี ไอฟิน จำกัด',
          description: 'ชื่อบัญชีธนาคารสำหรับการฝากเงิน'
        });
      }
      
      if (!bankName) {
        await this.createSystemSetting({
          settingKey: 'deposit_bank_name',
          settingValue: 'ธนาคารกรุงศรีอยุธยา',
          description: 'ชื่อธนาคารสำหรับการฝากเงิน'
        });
      }
      
      if (!accountNumber) {
        await this.createSystemSetting({
          settingKey: 'deposit_account_number',
          settingValue: '123-4-56789-0',
          description: 'เลขบัญชีธนาคารสำหรับการฝากเงิน'
        });
      }
      
      if (!qrCodeUrl) {
        await this.createSystemSetting({
          settingKey: 'deposit_qr_code',
          settingValue: '/images/qr-code-placeholder.png',
          description: 'URL ของรูปภาพ QR Code สำหรับการฝากเงิน'
        });
      }
      
      // ฟังก์ชันสำหรับแปลงค่า settingValue ที่อยู่ในรูปแบบ JSON string
      const parseSettingValue = (value: unknown): string => {
        if (!value) return '';
        
        try {
          // แปลงเป็น string ก่อน
          const strValue = String(value);
          // ตรวจสอบว่าค่านี้เป็น JSON string หรือไม่
          if (strValue.startsWith('"') && strValue.endsWith('"')) {
            // ถ้าเป็น JSON string ให้แปลงกลับเป็น JS value
            return JSON.parse(strValue);
          }
          return strValue;
        } catch (e) {
          // หากแปลงไม่ได้ ให้ใช้ค่าเดิม
          return String(value);
        }
      };
      
      // Get fresh data after potentially creating default values and parse JSON values
      return {
        accountName: parseSettingValue((await this.getSystemSetting('deposit_account_name'))?.settingValue),
        bankName: parseSettingValue((await this.getSystemSetting('deposit_bank_name'))?.settingValue),
        accountNumber: parseSettingValue((await this.getSystemSetting('deposit_account_number'))?.settingValue),
        qrCodeUrl: parseSettingValue((await this.getSystemSetting('deposit_qr_code'))?.settingValue)
      };
    } catch (error) {
      log(`Error getting deposit bank info: ${error}`, "storage");
      return {
        accountName: 'บริษัท กรุงศรี ไอฟิน จำกัด',
        bankName: 'ธนาคารกรุงศรีอยุธยา',
        accountNumber: '123-4-56789-0',
        qrCodeUrl: '/images/qr-code-placeholder.png'
      };
    }
  }
}

// เปลี่ยนมาใช้ PostgresStorage เพื่อจัดเก็บข้อมูลแบบถาวร
export const storage = new PostgresStorage();