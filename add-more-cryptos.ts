import { db } from './server/db';
import { stocks } from './shared/schema';
import { mockCryptos } from './server/mock-cryptos';

// This function adds more cryptocurrencies from the mock-cryptos.ts file to the database
async function addMoreCryptosToDatabase() {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  
  try {
    console.log(`Starting to add cryptocurrencies from mock-cryptos.ts to the database...`);
    
    // ดึงข้อมูลคริปโตที่มีอยู่แล้วในฐานข้อมูล
    const existingCrypto = await db.select({
      symbol: stocks.symbol,
      asset_type: stocks.asset_type
    }).from(stocks);
    
    // สร้าง map ของคริปโตที่มีอยู่แล้วเพื่อการค้นหาที่รวดเร็วขึ้น
    const existingCryptoMap = new Map();
    existingCrypto.forEach(crypto => {
      existingCryptoMap.set(crypto.symbol, crypto.asset_type);
    });
    
    // วนลูปเพิ่มคริปโตจาก mockCryptos
    for (const crypto of mockCryptos) {
      const existingAssetType = existingCryptoMap.get(crypto.symbol);
      
      if (existingAssetType === undefined) {
        // ถ้าคริปโตยังไม่มีในฐานข้อมูล ให้เพิ่มเข้าไป
        try {
          await db.insert(stocks).values({
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
            asset_type: 'crypto', // สำคัญ: ต้องใช้ asset_type ไม่ใช่ assetType
            sentimentScore: Math.random() * 2 - 1, // -1 ถึง 1
            sentimentVolume: Math.floor(Math.random() * 10000),
            sentimentTrend: ['bullish', 'bearish', 'neutral', 'mixed'][Math.floor(Math.random() * 4)]
          });
          
          console.log(`Added ${crypto.symbol} (${crypto.name}) to the database.`);
          added++;
        } catch (err) {
          console.error(`Error adding ${crypto.symbol}: ${err.message}`);
        }
      } else if (existingAssetType !== 'crypto') {
        // ถ้าคริปโตมีอยู่แล้วแต่ asset_type ไม่ถูกต้อง ให้อัพเดท
        try {
          await db.update(stocks)
            .set({ asset_type: 'crypto' })
            .where({ symbol: crypto.symbol });
          
          console.log(`Updated ${crypto.symbol} asset_type from '${existingAssetType}' to 'crypto'.`);
          updated++;
        } catch (err) {
          console.error(`Error updating ${crypto.symbol}: ${err.message}`);
        }
      } else {
        // ถ้าคริปโตมีอยู่แล้วและ asset_type ถูกต้อง ข้ามไป
        skipped++;
      }
    }
    
    console.log(`
      Summary:
      - Added: ${added} new cryptocurrencies
      - Updated: ${updated} existing cryptocurrencies
      - Skipped: ${skipped} cryptocurrencies (already exist with correct asset_type)
      - Total: ${added + updated + skipped} cryptocurrencies processed
    `);
  } catch (error) {
    console.error('Error adding cryptocurrencies to the database:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
addMoreCryptosToDatabase();