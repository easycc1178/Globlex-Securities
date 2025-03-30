// Script to add cryptocurrencies to the database
import { db } from './server/db';
import { mockCryptos } from './server/mock-cryptos';
import { generateSentiment } from './server/mock-stocks';
import { stocks } from './shared/schema';
import { eq } from 'drizzle-orm';

async function addCryptosToDatabase() {
  console.log('Starting to add cryptocurrencies to the database...');
  
  try {
    // Get existing cryptos from the database
    const existingStocks = await db.select().from(stocks);
    const existingCryptos = existingStocks.filter(stock => stock.asset_type === 'crypto');
    const existingCryptoSymbols = existingCryptos.map(crypto => crypto.symbol);
    
    console.log(`Found ${existingCryptos.length} cryptos in database and ${mockCryptos.length} cryptos in mock data`);
    
    let addedCount = 0;
    
    // Add each missing crypto
    for (const mockCrypto of mockCryptos) {
      try {
        // Skip if this crypto already exists
        if (existingCryptoSymbols.includes(mockCrypto.symbol)) {
          console.log(`Crypto ${mockCrypto.symbol} already exists, skipping`);
          continue;
        }
        
        // Generate sentiment data
        const sentimentData = generateSentiment(mockCrypto.changePercent);
        
        // Insert the crypto into the database
        await db.insert(stocks).values({
          symbol: mockCrypto.symbol,
          name: mockCrypto.name,
          exchange: mockCrypto.exchange,
          currentPrice: mockCrypto.currentPrice,
          previousClose: mockCrypto.previousClose,
          change: mockCrypto.change,
          changePercent: mockCrypto.changePercent,
          logoUrl: mockCrypto.logoUrl,
          sector: mockCrypto.sector,
          description: mockCrypto.description,
          asset_type: 'crypto',
          sentimentScore: sentimentData.sentimentScore,
          sentimentVolume: sentimentData.sentimentVolume,
          sentimentTrend: sentimentData.sentimentTrend,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        addedCount++;
        console.log(`Added crypto ${mockCrypto.symbol} to database`);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error adding crypto ${mockCrypto.symbol}: ${error.message}`);
        } else {
          console.error(`Error adding crypto ${mockCrypto.symbol}: ${String(error)}`);
        }
      }
    }
    
    console.log(`Added ${addedCount} new cryptocurrencies to the database`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to add cryptocurrencies: ${error.message}`);
    } else {
      console.error(`Failed to add cryptocurrencies: ${String(error)}`);
    }
  }
}

// Run the function
addCryptosToDatabase().then(() => {
  console.log('Script execution complete');
  process.exit(0);
}).catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});