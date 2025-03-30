import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),  // ทำให้เป็น optional เพื่อรองรับ social login
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  age: integer("age"),
  birthDate: text("birth_date"),
  address: text("address"),
  occupation: text("occupation"),
  monthlyIncome: integer("monthly_income"),
  remainingIncome: integer("remaining_income"),
  idCardNumber: text("id_card_number"),
  // Bank information
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  // Profile and documents
  profilePicture: text("profile_picture"),
  frontIdCardImage: text("front_id_card_image"),
  backIdCardImage: text("back_id_card_image"),
  selfieWithIdCardImage: text("selfie_with_id_card_image"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  status: text("status").default("active").notNull(), // active, blocked_withdrawal, blocked_loan
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Social login fields
  googleId: text("google_id").unique(),
  facebookId: text("facebook_id").unique(),
  authProvider: text("auth_provider"), // 'local', 'google', 'facebook'
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, googleId: true, facebookId: true })
  .extend({
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    authProvider: z.enum(['local', 'google', 'facebook']).optional().default('local'),
  })
  .refine((data) => {
    // ถ้าไม่ใช่ social login ต้องมีรหัสผ่านและรหัสผ่านต้องตรงกัน
    if (data.authProvider === 'local' || !data.authProvider) {
      if (!data.password) return false;
      if (!data.confirmPassword) return false;
      return data.password === data.confirmPassword;
    }
    // social login ไม่จำเป็นต้องมีรหัสผ่าน
    return true;
  }, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Loan schema
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  term: integer("term").notNull(), // in months
  interestRate: integer("interest_rate").notNull(), // in basis points (0.01%)
  monthlyPayment: integer("monthly_payment").notNull(),
  purpose: text("purpose"),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, completed
  adminId: integer("admin_id"), // Admin who processed the loan
  adminNote: text("admin_note"),
  // ข้อมูลส่วนตัวของผู้กู้
  fullName: text("full_name"),
  idCardNumber: text("id_card_number"),
  age: integer("age"),
  phone: text("phone"),
  address: text("address"),
  occupation: text("occupation"),
  income: integer("income"), // รายได้ต่อเดือน
  remainingIncome: integer("remaining_income"), // รายได้คงเหลือ
  // รูปภาพเอกสาร
  frontIdCardImage: text("front_id_card_image"),
  backIdCardImage: text("back_id_card_image"),
  selfieWithIdCardImage: text("selfie_with_id_card_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLoanSchema = createInsertSchema(loans)
  .omit({
    id: true,
    adminId: true,
    adminNote: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    amount: z.number().min(50000, "ยอดกู้ขั้นต่ำ 50,000 บาท").max(5000000, "ยอดกู้สูงสุด 5,000,000 บาท"),
    term: z.number().min(1, "ระยะเวลาขั้นต่ำ 1 เดือน").max(60, "ระยะเวลาสูงสุด 60 เดือน"),
  });

// Message schema for chat
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").default("text").notNull(), // text, image, file
  fileUrl: text("file_url"), // URL ของไฟล์หรือรูปภาพ
  fileName: text("file_name"), // ชื่อไฟล์
  fileSize: integer("file_size"), // ขนาดไฟล์ (bytes)
  fileMimeType: text("file_mime_type"), // ประเภทของไฟล์ (MIME type)
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"), // เวลาที่ข้อความถูกอ่าน
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  readAt: true,
  createdAt: true,
});

// Notification schema
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  type: text("type").notNull(), // loan, chat, system
  relatedEntityId: integer("related_entity_id"), // loan_id or message_id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Account balance schema
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  balance: integer("balance").default(0).notNull(), // in THB (smallest unit)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

// Withdrawal schema
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // in THB (smallest unit)
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  adminId: integer("admin_id"), // Admin who processed the withdrawal
  adminNote: text("admin_note"),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  adminId: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = Pick<InsertUser, "username" | "password">;

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;

// Stock schema
export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 10 }).notNull().unique(),
  name: text("name").notNull(),
  exchange: varchar("exchange", { length: 10 }).notNull(),
  currentPrice: real("current_price").notNull(),
  previousClose: real("previous_close").notNull(),
  change: real("change").notNull(),
  changePercent: real("change_percent").notNull(),
  logoUrl: text("logo_url"),
  sector: text("sector"),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  // เพิ่มฟิลด์สำหรับแยกประเภทสินทรัพย์
  asset_type: text("asset_type").default("stock").notNull(), // "stock" หรือ "crypto"
  // เพิ่มข้อมูลสำหรับ Market Sentiment
  sentimentScore: real("sentiment_score").default(0).notNull(), // -1.0 ถึง 1.0 (ลบคือแย่, บวกคือดี)
  sentimentVolume: integer("sentiment_volume").default(0).notNull(), // ปริมาณข้อมูลที่ใช้คำนวณ sentiment
  sentimentTrend: text("sentiment_trend").default("neutral").notNull(), // 'bullish', 'bearish', 'neutral', 'mixed'
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockSchema = createInsertSchema(stocks).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

// Stock trades schema
export const stockTrades = pgTable("stock_trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stockId: integer("stock_id").notNull(),
  direction: text("direction").notNull(), // "up" or "down"
  amount: integer("amount").notNull(), // in THB (smallest unit)
  duration: integer("duration").notNull(), // in seconds (90, 120, 300)
  multiplier: real("multiplier").notNull(), // 1.8 for 90 and 120 sec, 2.6 for 300 sec
  startPrice: real("start_price").notNull(),
  endPrice: real("end_price"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  status: text("status").default("active").notNull(), // active, win, loss, canceled, admin_pending
  potentialPayout: integer("potential_payout").notNull(), // amount * multiplier
  payoutAmount: integer("payout_amount"), // final payout amount if win
  adminForceResult: text("admin_force_result"), // 'win', 'loss' หรือ null ถ้าไม่ได้ถูกกำหนดโดยแอดมิน
  adminNote: text("admin_note"),
  adminId: integer("admin_id"), // ID ของแอดมินที่ทำการกำหนดผลลัพธ์
  notifiedAdmin: boolean("notified_admin").default(false).notNull(), // แจ้งเตือนแอดมินแล้วหรือยัง
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockTradeSchema = createInsertSchema(stockTrades).omit({
  id: true,
  endPrice: true,
  endTime: true,
  payoutAmount: true,
  createdAt: true,
  startTime: true, // omit startTime ให้เซิร์ฟเวอร์กำหนดเองอัตโนมัติ
  userId: true, // omit userId ให้เซิร์ฟเวอร์กำหนดเองจาก session
  adminForceResult: true, // omit adminForceResult ให้แอดมินเป็นคนกำหนด
  adminNote: true, // omit adminNote ให้แอดมินเป็นคนกำหนด
  adminId: true, // omit adminId ให้เซิร์ฟเวอร์กำหนดเองจาก session
  notifiedAdmin: true, // omit notifiedAdmin ให้เซิร์ฟเวอร์กำหนดเอง
}).extend({
  duration: z.number().refine(val => [90, 120, 300].includes(val), {
    message: "ระยะเวลาต้องเป็น 90, 120 หรือ 300 วินาทีเท่านั้น"
  }),
  amount: z.number().min(100, "จำนวนเงินขั้นต่ำ 100 บาท"),
  direction: z.enum(["up", "down"]),
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type StockTrade = typeof stockTrades.$inferSelect;
export type InsertStockTrade = z.infer<typeof insertStockTradeSchema>;

// Stock Price History schema
export const stockPriceHistory = pgTable("stock_price_history", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: integer("volume").notNull(),
  interval: varchar("interval", { length: 10 }).notNull(), // 1min, 5min, 15min, 30min, 60min, daily
});

export const insertStockPriceHistorySchema = createInsertSchema(stockPriceHistory).omit({
  id: true,
});

export type StockPriceHistory = typeof stockPriceHistory.$inferSelect;
export type InsertStockPriceHistory = z.infer<typeof insertStockPriceHistorySchema>;

// Deposit schema
export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // in THB (smallest unit)
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  adminId: integer("admin_id"), // Admin who processed the deposit
  adminNote: text("admin_note"),
  fullName: text("full_name").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  slipImageUrl: text("slip_image_url"), // URL to the deposit slip
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({
  id: true,
  adminId: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
});

export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;

// Bank accounts schema for saving user bank accounts
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

// System settings schema for storing system-wide settings
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: jsonb("setting_value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;