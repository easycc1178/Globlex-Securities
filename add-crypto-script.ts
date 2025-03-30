import { db } from './server/db';
import { stocks } from './shared/schema';
import { log } from './server/vite';
import { mockCryptos } from './server/mock-cryptos';

async function addCryptosToDB() {
  try {
    // เช็คว่ามีคริปโตในฐานข้อมูลแล้วหรือไม่
    const existingCrypto = await db.select().from(stocks).where({
      asset_type: 'crypto'
    }).limit(1);
    
    if (existingCrypto.length > 0) {
      log('Cryptocurrencies already exist in database, skipping...', 'crypto-script');
      process.exit(0);
    }

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
    log(`Added ${cryptoValues.length} cryptocurrencies to database successfully`, 'crypto-script');
  } catch (error) {
    log(`Error adding cryptocurrencies to database: ${error}`, 'crypto-script');
  } finally {
    process.exit(0);
  }
}

addCryptosToDB();