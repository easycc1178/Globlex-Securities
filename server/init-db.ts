import { db } from './db';
import { 
  users, 
  accounts, 
  loans, 
  notifications, 
  messages, 
  withdrawals, 
  deposits, 
  bankAccounts, 
  stocks, 
  stockTrades,
  stockPriceHistory,
  systemSettings,
} from '@shared/schema';
import { log } from './vite';
import { mockStocks } from './mock-stocks';
import { mockCryptos } from './mock-cryptos';
import { eq } from 'drizzle-orm';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function initializeDatabase() {
  // 1. สร้างตารางทั้งหมด
  try {
    log('Creating database tables...', 'init-db');
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        age INTEGER,
        birth_date TEXT,
        address TEXT,
        occupation TEXT,
        monthly_income INTEGER,
        remaining_income INTEGER,
        id_card_number TEXT,
        bank_name TEXT,
        bank_account_number TEXT,
        profile_picture TEXT,
        front_id_card_image TEXT,
        back_id_card_image TEXT,
        selfie_with_id_card_image TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        google_id TEXT UNIQUE,
        facebook_id TEXT UNIQUE,
        auth_provider TEXT
      );
      
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        term INTEGER NOT NULL,
        interest_rate INTEGER NOT NULL,
        monthly_payment INTEGER NOT NULL,
        purpose TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_id INTEGER,
        admin_note TEXT,
        full_name TEXT,
        id_card_number TEXT,
        age INTEGER,
        phone TEXT,
        address TEXT,
        occupation TEXT,
        income INTEGER,
        remaining_income INTEGER,
        front_id_card_image TEXT,
        back_id_card_image TEXT,
        selfie_with_id_card_image TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        file_mime_type TEXT,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        type TEXT NOT NULL,
        related_entity_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_id INTEGER,
        admin_note TEXT,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL UNIQUE,
        name TEXT NOT NULL,
        exchange VARCHAR(10) NOT NULL,
        current_price REAL NOT NULL,
        previous_close REAL NOT NULL,
        change REAL NOT NULL,
        change_percent REAL NOT NULL,
        logo_url TEXT,
        sector TEXT,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        asset_type TEXT NOT NULL DEFAULT 'stock',
        sentiment_score REAL NOT NULL DEFAULT 0,
        sentiment_volume INTEGER NOT NULL DEFAULT 0,
        sentiment_trend TEXT NOT NULL DEFAULT 'neutral',
        last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS stock_trades (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        stock_id INTEGER NOT NULL,
        direction TEXT NOT NULL,
        amount INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        multiplier REAL NOT NULL,
        start_price REAL NOT NULL,
        end_price REAL,
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        end_time TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'active',
        potential_payout INTEGER NOT NULL,
        payout_amount INTEGER,
        admin_force_result TEXT,
        admin_note TEXT,
        admin_id INTEGER,
        notified_admin BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS stock_price_history (
        id SERIAL PRIMARY KEY,
        stock_id INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume INTEGER NOT NULL,
        interval VARCHAR(10) NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_id INTEGER,
        admin_note TEXT,
        full_name TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        slip_image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value JSONB,
        description TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    log('Database tables created successfully', 'init-db');
  } catch (error) {
    log(`Error creating database tables: ${error}`, 'init-db');
    throw error;
  }

  // 2. สร้างผู้ใช้ admin ถ้ายังไม่มี
  try {
    // ตรวจสอบว่ามีผู้ใช้ admin แล้วหรือไม่
    const adminUser = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
    
    if (adminUser.length === 0) {
      const hashedPassword = await hashPassword('admin123');
      
      // สร้างผู้ใช้ admin
      const newAdmin = await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@cashluxe.com',
        fullName: 'System Administrator',
        phone: '0812345678',
        isAdmin: true,
        authProvider: 'local',
      }).returning();
      
      log(`Admin user created with ID: ${newAdmin[0].id}`, 'storage');
      
      // สร้างบัญชีเงินสำหรับ admin
      await db.insert(accounts).values({
        userId: newAdmin[0].id,
        balance: 1000000, // 1,000,000 บาท
      });
    } else {
      log(`Admin user already exists with ID: ${adminUser[0].id}`, 'storage');
    }
  } catch (error) {
    log(`Error creating admin user: ${error}`, 'storage');
  }

  // 3. เพิ่มข้อมูลหุ้นเริ่มต้น
  try {
    // ตรวจสอบว่ามีข้อมูลหุ้นในฐานข้อมูลแล้วหรือไม่
    const existingStocks = await db.select().from(stocks).limit(1);
    
    if (existingStocks.length === 0) {
      // เพิ่มข้อมูลหุ้น
      const stockValues = mockStocks.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        currentPrice: stock.currentPrice,
        previousClose: stock.previousClose,
        change: stock.change,
        changePercent: stock.changePercent,
        logoUrl: stock.logoUrl,
        sector: stock.sector,
        description: stock.description,
        asset_type: 'stock',
        sentimentScore: Math.random() * 2 - 1, // -1 ถึง 1
        sentimentVolume: Math.floor(Math.random() * 10000),
        sentimentTrend: ['bullish', 'bearish', 'neutral', 'mixed'][Math.floor(Math.random() * 4)],
      }));
      
      await db.insert(stocks).values(stockValues);
      
      // เพิ่มข้อมูล crypto
      const cryptoValues = mockCryptos.map(crypto => ({
        symbol: crypto.symbol,
        name: crypto.name,
        exchange: 'CRYPTO',
        currentPrice: crypto.currentPrice,
        previousClose: crypto.previousClose,
        change: crypto.change,
        changePercent: crypto.changePercent,
        logoUrl: crypto.logoUrl,
        sector: 'Cryptocurrency',
        description: crypto.description || `${crypto.name} cryptocurrency`,
        asset_type: 'crypto',
        sentimentScore: Math.random() * 2 - 1, // -1 ถึง 1
        sentimentVolume: Math.floor(Math.random() * 10000),
        sentimentTrend: ['bullish', 'bearish', 'neutral', 'mixed'][Math.floor(Math.random() * 4)],
      }));
      
      await db.insert(stocks).values(cryptoValues);
      log('Stock and crypto data initialized successfully', 'storage');
    } else {
      log('Stocks already exist in database, skipping initialization', 'storage');
    }
  } catch (error) {
    log(`Error initializing stock data: ${error}`, 'storage');
  }

  // 4. สร้างข้อมูลอื่นๆ ที่จำเป็น
  try {
    // เพิ่มการตั้งค่าระบบ
    const existingSettings = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, 'trading_multipliers')).limit(1);
    
    if (existingSettings.length === 0) {
      await db.insert(systemSettings).values({
        settingKey: 'trading_multipliers',
        settingValue: {
          '90': 1.8,
          '120': 1.8,
          '300': 2.6
        },
        description: 'Multipliers for different trading durations (in seconds)'
      });
      
      await db.insert(systemSettings).values({
        settingKey: 'bank_info',
        settingValue: {
          banks: [
            { name: 'ธนาคารกสิกรไทย', code: 'KBANK', color: '#138f2d' },
            { name: 'ธนาคารกรุงเทพ', code: 'BBL', color: '#1e4598' },
            { name: 'ธนาคารกรุงไทย', code: 'KTB', color: '#12aaeb' },
            { name: 'ธนาคารกรุงศรีอยุธยา', code: 'BAY', color: '#fec43b' },
            { name: 'ธนาคารไทยพาณิชย์', code: 'SCB', color: '#4e2e7f' },
            { name: 'ธนาคารทหารไทยธนชาต', code: 'TTB', color: '#fe5000' },
          ],
          company_account: {
            bank_name: 'ธนาคารกสิกรไทย',
            account_number: '123-4-56789-0',
            account_name: 'บริษัท แคชลุกซ์ จำกัด'
          }
        },
        description: 'ข้อมูลธนาคารที่รองรับและบัญชีธนาคารของบริษัท'
      });
      
      log('System settings initialized successfully', 'storage');
    }
  } catch (error) {
    log(`Error initializing system settings: ${error}`, 'storage');
  }
}