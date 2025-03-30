// Script to update cryptocurrencies in the database
import { db } from './server/db';
import { mockCryptos } from './server/mock-cryptos';
import { stocks } from './shared/schema';
import { eq } from 'drizzle-orm';

async function updateCryptosInDatabase() {
  console.log('Starting to update cryptocurrencies in the database...');
  
  try {
    // Get a list of all crypto symbols from mock data
    const cryptoSymbols = mockCryptos.map(crypto => crypto.symbol);
    console.log(`Found ${cryptoSymbols.length} crypto symbols in mock data`);
    
    // Get all existing stocks
    const existingStocks = await db.select().from(stocks);
    console.log(`Found ${existingStocks.length} total stocks in database`);
    
    // Find all crypto symbols that exist in the database
    const existingCryptoSymbols = existingStocks
      .filter(stock => cryptoSymbols.includes(stock.symbol))
      .map(stock => stock.symbol);
    
    console.log(`Found ${existingCryptoSymbols.length} crypto symbols already in the database`);
    
    if (existingCryptoSymbols.length === 0) {
      console.log('No existing cryptos found in database to update');
      return;
    }
    
    // Update each crypto individually to have asset_type = 'crypto'
    let updatedCount = 0;
    for (const symbol of existingCryptoSymbols) {
      try {
        await db.update(stocks)
          .set({ asset_type: 'crypto' })
          .where(eq(stocks.symbol, symbol));
        
        updatedCount++;
        console.log(`Updated ${symbol} to have asset_type 'crypto'`);
      } catch (error) {
        console.error(`Error updating ${symbol}: ${error}`);
      }
    }
    
    console.log(`Updated ${updatedCount} cryptocurrencies to have asset_type = 'crypto'`);
    
    // Verify the update
    const updatedCryptos = await db
      .select()
      .from(stocks)
      .where(eq(stocks.asset_type, 'crypto'));
    
    console.log(`After update, found ${updatedCryptos.length} stocks with asset_type = 'crypto'`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to update cryptocurrencies: ${error.message}`);
    } else {
      console.error(`Failed to update cryptocurrencies: ${String(error)}`);
    }
  }
}

// Run the function
updateCryptosInDatabase().then(() => {
  console.log('Script execution complete');
  process.exit(0);
}).catch(error => {
  console.error('Script execution failed:', error);
  process.exit(1);
});