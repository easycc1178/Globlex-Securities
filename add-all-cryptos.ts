// Script to add all remaining cryptocurrencies to the database in a single run
import { db } from './server/db';
import { mockCryptos } from './server/mock-cryptos';
import { generateSentiment } from './server/mock-stocks';
import { stocks } from './shared/schema';
import { eq } from 'drizzle-orm';

async function addAllCryptosToDatabase() {
  console.log('Starting to add all remaining cryptocurrencies to the database...');
  
  try {
    // Get existing cryptos from the database
    const existingStocks = await db.select().from(stocks);
    const existingCryptoSymbols = existingStocks
      .filter(stock => stock.asset_type === 'crypto')
      .map(crypto => crypto.symbol);
    
    console.log(`Found ${existingCryptoSymbols.length} cryptos in database and ${mockCryptos.length} cryptos in mock data`);
    
    // Find cryptos that are not yet in the database
    const cryptosToAdd = mockCryptos.filter(crypto => !existingCryptoSymbols.includes(crypto.symbol));
    console.log(`Found ${cryptosToAdd.length} cryptocurrencies to add`);
    
    if (cryptosToAdd.length === 0) {
      console.log('All cryptocurrencies are already in the database');
      return;
    }
    
    // Add all cryptos at once using a batch insert
    const batchValues = cryptosToAdd.map(crypto => {
      const sentimentData = generateSentiment(crypto.changePercent);
      return {
        symbol: crypto.symbol,
        name: crypto.name,
        exchange: crypto.exchange,
        currentPrice: crypto.currentPrice,
        previousClose: crypto.previousClose,
        change: crypto.change,
        changePercent: crypto.changePercent,
        logoUrl: crypto.logoUrl,
        sector: crypto.sector,
        description: crypto.description,
        asset_type: 'crypto',
        sentimentScore: sentimentData.sentimentScore,
        sentimentVolume: sentimentData.sentimentVolume,
        sentimentTrend: sentimentData.sentimentTrend,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    
    // Insert in smaller batches to avoid potential timeout issues
    const batchSize = 20;
    for (let i = 0; i < batchValues.length; i += batchSize) {
      const batch = batchValues.slice(i, i + batchSize);
      await db.insert(stocks).values(batch);
      console.log(`Added batch ${i/batchSize + 1} of ${Math.ceil(batchValues.length/batchSize)}`);
    }
    
    // Verify the update
    const updatedCryptos = await db
      .select()
      .from(stocks)
      .where(eq(stocks.asset_type, 'crypto'));
    
    console.log(`Successfully added all cryptocurrencies. Now have ${updatedCryptos.length} cryptos in database.`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to add cryptocurrencies: ${error.message}`);
    } else {
      console.error(`Failed to add cryptocurrencies: ${String(error)}`);
    }
  }
}

// Run the function
addAllCryptosToDatabase().then(() => {
  console.log('Script execution complete');
  process.exit(0);
}).catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});