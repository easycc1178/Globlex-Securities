import { db } from './server/db';
import { stocks } from './shared/schema';
import { log } from './server/vite';
import { mockCryptos } from './server/mock-cryptos';

async function updateCryptoTypes() {
  try {
    // รายชื่อสัญลักษณ์ของคริปโตที่เรารู้จัก
    const cryptoSymbols = mockCryptos.map(crypto => crypto.symbol);
    log(`Found ${cryptoSymbols.length} cryptocurrencies in mock data`, 'crypto-update');
    
    // อัปเดตประเภทของหุ้นที่มีอยู่แล้ว ให้เป็นคริปโต
    const updateResult = await db
      .update(stocks)
      .set({ 
        asset_type: 'crypto',
        sector: 'Cryptocurrency'
      })
      .where(stock => stock.symbol.in(cryptoSymbols));
    
    log(`Updated ${updateResult.rowCount} existing stocks to 'crypto' type`, 'crypto-update');
    
    // ตรวจสอบว่ามีคริปโตใดบ้างที่ยังไม่มีในฐานข้อมูล
    const existingStocks = await db
      .select({ symbol: stocks.symbol })
      .from(stocks);
    
    const existingSymbols = existingStocks.map(s => s.symbol);
    const missingCryptos = mockCryptos.filter(crypto => !existingSymbols.includes(crypto.symbol));
    
    log(`Found ${missingCryptos.length} cryptocurrencies missing from database`, 'crypto-update');
    
    if (missingCryptos.length > 0) {
      // เพิ่มคริปโตที่ยังไม่มีในฐานข้อมูล
      const cryptoValues = missingCryptos.map(crypto => ({
        symbol: crypto.symbol,
        name: crypto.name,
        exchange: crypto.exchange,
        currentPrice: crypto.currentPrice,
        previousClose: crypto.previousClose,
        change: crypto.change,
        changePercent: crypto.changePercent,
        logoUrl: crypto.logoUrl,
        sector: 'Cryptocurrency',
        description: crypto.description || `${crypto.name} cryptocurrency`,
        asset_type: 'crypto',
        isActive: true,
        sentimentScore: Math.random() * 2 - 1,
        sentimentVolume: Math.floor(Math.random() * 10000),
        sentimentTrend: ['bullish', 'bearish', 'neutral', 'mixed'][Math.floor(Math.random() * 4)],
      }));
      
      await db.insert(stocks).values(cryptoValues);
      log(`Added ${cryptoValues.length} new cryptocurrencies to database`, 'crypto-update');
    }
    
    // ตรวจสอบจำนวนคริปโตทั้งหมดในฐานข้อมูล
    const cryptoCount = await db
      .select({ count: stocks.id })
      .from(stocks)
      .where({ asset_type: 'crypto' });
    
    log(`Total cryptocurrencies in database: ${cryptoCount[0]?.count || 0}`, 'crypto-update');
    
  } catch (error) {
    log(`Error updating cryptocurrencies: ${error}`, 'crypto-update');
  }
}

// เรียกใช้ฟังก์ชัน
updateCryptoTypes().then(() => {
  log('Script finished executing', 'crypto-update');
  process.exit(0);
}).catch(err => {
  log(`Unhandled error: ${err}`, 'crypto-update');
  process.exit(1);
});