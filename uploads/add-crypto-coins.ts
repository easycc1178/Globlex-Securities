import { db } from './server/db';
import { stocks } from './shared/schema';
import { log } from './server/vite';
import { mockCryptos } from './server/mock-cryptos';

async function addCryptoCoins() {
  try {
    // เช็คว่ามีคริปโตในฐานข้อมูลแล้วหรือไม่
    const existingCrypto = await db.select().from(stocks).where({
      asset_type: 'crypto'
    }).limit(1);
    
    if (existingCrypto.length > 0) {
      log('Cryptocurrencies already exist in database, skipping...', 'crypto-script');
      return;
    }

    // เตรียมข้อมูล crypto
    log('Preparing cryptocurrency data...', 'crypto-script');
    const cryptoValues = mockCryptos.map(crypto => ({
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
      // แก้ไขปัญหาชื่อฟิลด์ - ใน mockCryptos คือ assetType แต่ในสคีมาคือ asset_type
      asset_type: 'crypto',
      isActive: true,
      sentimentScore: Math.random() * 2 - 1, // -1 ถึง 1
      sentimentVolume: Math.floor(Math.random() * 10000),
      sentimentTrend: ['bullish', 'bearish', 'neutral', 'mixed'][Math.floor(Math.random() * 4)],
    }));
    
    log(`Inserting ${cryptoValues.length} cryptocurrencies to database...`, 'crypto-script');
    await db.insert(stocks).values(cryptoValues);
    log(`Added ${cryptoValues.length} cryptocurrencies to database successfully!`, 'crypto-script');
  } catch (error) {
    log(`Error adding cryptocurrencies to database: ${error}`, 'crypto-script');
  }
}

// เรียกใช้ฟังก์ชัน
addCryptoCoins().then(() => {
  log('Script finished executing', 'crypto-script');
  process.exit(0);
}).catch(err => {
  log(`Unhandled error: ${err}`, 'crypto-script');
  process.exit(1);
});