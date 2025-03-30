// This file contains static mock data for stocks to use during development
// In production, these would be replaced with real data from the Finnhub API

// Helper function to generate random sentiment data
export function generateSentiment(changePercent: number) {
  // Base sentiment on change percent, but add some randomness
  // Strong positive change tends to have positive sentiment
  // Strong negative change tends to have negative sentiment
  const baseScore = changePercent / 5; // Scale to -1 to 1 range approximately
  const randomFactor = (Math.random() - 0.5) * 0.5; // Add noise
  
  let sentimentScore = Math.max(-1, Math.min(1, baseScore + randomFactor));
  sentimentScore = parseFloat(sentimentScore.toFixed(2)); // Round to 2 decimal places
  
  const volume = Math.floor(Math.random() * 1500) + 50; // 50 to 1550
  
  let trend = 'neutral';
  if (sentimentScore > 0.4) trend = 'bullish';
  else if (sentimentScore < -0.4) trend = 'bearish';
  else if (Math.abs(sentimentScore) < 0.2) trend = 'neutral';
  else trend = 'mixed';
  
  return {
    sentimentScore,
    sentimentVolume: volume,
    sentimentTrend: trend
  };
}

export const mockStocks = [
  // คริปโตเคอร์เรนซี
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    exchange: 'BINANCE',
    currentPrice: 68254.75,
    previousClose: 67590.32,
    change: 664.43,
    changePercent: 0.98,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    sector: 'Cryptocurrency',
    description: 'Bitcoin is a decentralized digital currency.',
    asset_type: 'crypto'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    exchange: 'BINANCE',
    currentPrice: 3475.29,
    previousClose: 3447.18,
    change: 28.11,
    changePercent: 0.82,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
    sector: 'Cryptocurrency',
    description: 'Ethereum is a decentralized computing platform.',
    asset_type: 'crypto'
  },
  {
    symbol: 'XRP',
    name: 'Ripple',
    exchange: 'BINANCE',
    currentPrice: 0.523,
    previousClose: 0.516,
    change: 0.007,
    changePercent: 1.35,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png',
    sector: 'Cryptocurrency',
    description: 'XRP is a digital payment protocol.',
    asset_type: 'crypto'
  },
  {
    symbol: 'DOGE',
    name: 'Dogecoin',
    exchange: 'BINANCE',
    currentPrice: 0.127,
    previousClose: 0.125,
    change: 0.002,
    changePercent: 1.6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/74.png', 
    sector: 'Cryptocurrency',
    description: 'Dogecoin is a cryptocurrency featuring the likeness of the Shiba Inu dog.',
    asset_type: 'crypto'
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    exchange: 'BINANCE',
    currentPrice: 168.85,
    previousClose: 170.32,
    change: -1.47,
    changePercent: -0.86,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
    sector: 'Cryptocurrency',
    description: 'Solana is a high-performance blockchain supporting smart contracts and decentralized applications.',
    asset_type: 'crypto'
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    exchange: 'BINANCE',
    currentPrice: 0.457,
    previousClose: 0.442,
    change: 0.015,
    changePercent: 3.39,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png',
    sector: 'Cryptocurrency',
    description: 'Cardano is a proof-of-stake blockchain platform with a focus on sustainability and scalability.',
    asset_type: 'crypto'
  },
  {
    symbol: 'AVAX',
    name: 'Avalanche',
    exchange: 'BINANCE',
    currentPrice: 37.82,
    previousClose: 36.54,
    change: 1.28,
    changePercent: 3.5,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png',
    sector: 'Cryptocurrency',
    description: 'Avalanche is a layer one blockchain that functions as a platform for decentralized applications and custom blockchain networks.',
    asset_type: 'crypto'
  },
  {
    symbol: 'DOT',
    name: 'Polkadot',
    exchange: 'BINANCE',
    currentPrice: 7.34,
    previousClose: 7.12,
    change: 0.22,
    changePercent: 3.09,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png',
    sector: 'Cryptocurrency',
    description: 'Polkadot is a multi-chain framework enabling different blockchains to transfer messages and value.',
    asset_type: 'crypto'
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    exchange: 'BINANCE',
    currentPrice: 16.75,
    previousClose: 16.23,
    change: 0.52,
    changePercent: 3.2,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png',
    sector: 'Cryptocurrency',
    description: 'Chainlink is a decentralized oracle network that provides real-world data to smart contracts on the blockchain.',
    asset_type: 'crypto'
  },
  {
    symbol: 'MATIC',
    name: 'Polygon',
    exchange: 'BINANCE',
    currentPrice: 0.605,
    previousClose: 0.599,
    change: 0.006,
    changePercent: 1.0,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
    sector: 'Cryptocurrency',
    description: 'Polygon is a framework for building and connecting Ethereum-compatible blockchain networks.',
    asset_type: 'crypto'
  },
  // หุ้น
  {
    symbol: 'AAPL',
    name: 'Apple Inc',
    exchange: 'NASDAQ',
    currentPrice: 175.34,
    previousClose: 173.88,
    change: 1.46,
    changePercent: 0.84,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png',
    sector: 'Technology',
    description: 'https://www.apple.com/',
    asset_type: 'stock'
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    currentPrice: 419.23,
    previousClose: 415.47,
    change: 3.76,
    changePercent: 0.91,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png',
    sector: 'Technology',
    description: 'https://www.microsoft.com/'
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc',
    exchange: 'NASDAQ',
    currentPrice: 148.68,
    previousClose: 146.95,
    change: 1.73,
    changePercent: 1.18,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/GOOGL.png',
    sector: 'Technology',
    description: 'https://www.abc.xyz/'
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com Inc',
    exchange: 'NASDAQ',
    currentPrice: 178.15,
    previousClose: 175.90,
    change: 2.25,
    changePercent: 1.28,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.amazon.com/'
  },
  {
    symbol: 'META',
    name: 'Meta Platforms Inc',
    exchange: 'NASDAQ',
    currentPrice: 477.38,
    previousClose: 470.12,
    change: 7.26,
    changePercent: 1.54,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/META.png',
    sector: 'Technology',
    description: 'https://about.meta.com/'
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc',
    exchange: 'NASDAQ',
    currentPrice: 164.21,
    previousClose: 165.85,
    change: -1.64,
    changePercent: -0.99,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png',
    sector: 'Automotive',
    description: 'https://www.tesla.com/'
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    currentPrice: 898.08,
    previousClose: 918.35,
    change: -20.27,
    changePercent: -2.21,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png',
    sector: 'Technology',
    description: 'https://www.nvidia.com/'
  },
  {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co',
    exchange: 'NYSE',
    currentPrice: 194.69,
    previousClose: 192.67,
    change: 2.02,
    changePercent: 1.05,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/JPM.png',
    sector: 'Financial Services',
    description: 'https://www.jpmorganchase.com/'
  },
  {
    symbol: 'V',
    name: 'Visa Inc',
    exchange: 'NYSE',
    currentPrice: 276.97,
    previousClose: 277.50,
    change: -0.53,
    changePercent: -0.19,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/V.png',
    sector: 'Financial Services',
    description: 'https://www.visa.com/'
  },
  {
    symbol: 'WMT',
    name: 'Walmart Inc',
    exchange: 'NYSE',
    currentPrice: 59.96,
    previousClose: 59.81,
    change: 0.15,
    changePercent: 0.25,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/WMT.png',
    sector: 'Consumer Defensive',
    description: 'https://www.walmart.com/'
  },
  {
    symbol: 'JNJ',
    name: 'Johnson & Johnson',
    exchange: 'NYSE',
    currentPrice: 157.72,
    previousClose: 156.93,
    change: 0.79,
    changePercent: 0.50,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/JNJ.png',
    sector: 'Healthcare',
    description: 'https://www.jnj.com/'
  },
  {
    symbol: 'PG',
    name: 'Procter & Gamble Co',
    exchange: 'NYSE',
    currentPrice: 161.79,
    previousClose: 162.43,
    change: -0.64,
    changePercent: -0.39,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/PG.png',
    sector: 'Consumer Defensive',
    description: 'https://www.pg.com/'
  },
  {
    symbol: 'HD',
    name: 'Home Depot Inc',
    exchange: 'NYSE',
    currentPrice: 362.02,
    previousClose: 358.54,
    change: 3.48,
    changePercent: 0.97,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/HD.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.homedepot.com/'
  },
  {
    symbol: 'BAC',
    name: 'Bank of America Corp',
    exchange: 'NYSE',
    currentPrice: 38.03,
    previousClose: 38.29,
    change: -0.26,
    changePercent: -0.68,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BAC.png',
    sector: 'Financial Services',
    description: 'https://www.bankofamerica.com/'
  },
  {
    symbol: 'DIS',
    name: 'Walt Disney Co',
    exchange: 'NYSE',
    currentPrice: 110.34,
    previousClose: 108.82,
    change: 1.52,
    changePercent: 1.40,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/DIS.png',
    sector: 'Communication Services',
    description: 'https://www.disney.com/'
  },
  {
    symbol: 'ADBE',
    name: 'Adobe Inc',
    exchange: 'NASDAQ',
    currentPrice: 492.60,
    previousClose: 487.15,
    change: 5.45,
    changePercent: 1.12,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ADBE.png',
    sector: 'Technology',
    description: 'https://www.adobe.com/'
  },
  {
    symbol: 'CRM',
    name: 'Salesforce Inc',
    exchange: 'NYSE',
    currentPrice: 295.10,
    previousClose: 291.70,
    change: 3.40,
    changePercent: 1.17,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/CRM.png',
    sector: 'Technology',
    description: 'https://www.salesforce.com/'
  },
  {
    symbol: 'NFLX',
    name: 'Netflix Inc',
    exchange: 'NASDAQ',
    currentPrice: 616.91,
    previousClose: 613.00,
    change: 3.91,
    changePercent: 0.64,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NFLX.png',
    sector: 'Communication Services',
    description: 'https://www.netflix.com/'
  },
  {
    symbol: 'PYPL',
    name: 'PayPal Holdings Inc',
    exchange: 'NASDAQ',
    currentPrice: 64.02,
    previousClose: 61.95,
    change: 2.07,
    changePercent: 3.34,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/PYPL.png',
    sector: 'Financial Services',
    description: 'https://www.paypal.com/'
  },
  {
    symbol: 'KO',
    name: 'Coca-Cola Co',
    exchange: 'NYSE',
    currentPrice: 59.04,
    previousClose: 59.12,
    change: -0.08,
    changePercent: -0.14,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/KO.png',
    sector: 'Consumer Defensive',
    description: 'https://www.coca-colacompany.com/'
  },
  // เพิ่มหุ้นอีก 30+ รายการเพื่อให้มีมากกว่า 50 รายการตามต้องการ
  {
    symbol: 'INTC',
    name: 'Intel Corporation',
    exchange: 'NASDAQ',
    currentPrice: 34.78,
    previousClose: 33.92,
    change: 0.86,
    changePercent: 2.53,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/INTC.png',
    sector: 'Technology',
    description: 'https://www.intel.com/'
  },
  {
    symbol: 'CSCO',
    name: 'Cisco Systems Inc',
    exchange: 'NASDAQ',
    currentPrice: 47.84,
    previousClose: 48.01,
    change: -0.17,
    changePercent: -0.35,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/CSCO.png',
    sector: 'Technology',
    description: 'https://www.cisco.com/'
  },
  {
    symbol: 'VZ',
    name: 'Verizon Communications Inc',
    exchange: 'NYSE',
    currentPrice: 40.85,
    previousClose: 41.02,
    change: -0.17,
    changePercent: -0.41,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/VZ.png',
    sector: 'Communication Services',
    description: 'https://www.verizon.com/'
  },
  {
    symbol: 'PFE',
    name: 'Pfizer Inc',
    exchange: 'NYSE',
    currentPrice: 27.25,
    previousClose: 27.15,
    change: 0.10,
    changePercent: 0.37,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/PFE.png',
    sector: 'Healthcare',
    description: 'https://www.pfizer.com/'
  },
  {
    symbol: 'ORCL',
    name: 'Oracle Corporation',
    exchange: 'NYSE',
    currentPrice: 120.30,
    previousClose: 118.47,
    change: 1.83,
    changePercent: 1.54,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ORCL.png',
    sector: 'Technology',
    description: 'https://www.oracle.com/'
  },
  {
    symbol: 'UNH',
    name: 'UnitedHealth Group Inc',
    exchange: 'NYSE',
    currentPrice: 485.14,
    previousClose: 481.90,
    change: 3.24,
    changePercent: 0.67,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/UNH.png',
    sector: 'Healthcare',
    description: 'https://www.unitedhealthgroup.com/'
  },
  {
    symbol: 'MA',
    name: 'Mastercard Inc',
    exchange: 'NYSE',
    currentPrice: 458.71,
    previousClose: 461.13,
    change: -2.42,
    changePercent: -0.52,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MA.png',
    sector: 'Financial Services',
    description: 'https://www.mastercard.com/'
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices Inc',
    exchange: 'NASDAQ',
    currentPrice: 152.63,
    previousClose: 155.01,
    change: -2.38,
    changePercent: -1.54,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMD.png',
    sector: 'Technology',
    description: 'https://www.amd.com/'
  },
  {
    symbol: 'BABA',
    name: 'Alibaba Group Holding Ltd',
    exchange: 'NYSE',
    currentPrice: 72.45,
    previousClose: 70.32,
    change: 2.13,
    changePercent: 3.03,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BABA.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.alibabagroup.com/'
  },
  {
    symbol: 'MCD',
    name: 'McDonald\'s Corp',
    exchange: 'NYSE',
    currentPrice: 258.37,
    previousClose: 259.51,
    change: -1.14,
    changePercent: -0.44,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MCD.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.mcdonalds.com/'
  },
  {
    symbol: 'SBUX',
    name: 'Starbucks Corp',
    exchange: 'NASDAQ',
    currentPrice: 90.05,
    previousClose: 89.22,
    change: 0.83,
    changePercent: 0.93,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/SBUX.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.starbucks.com/'
  },
  {
    symbol: 'NKE',
    name: 'Nike Inc',
    exchange: 'NYSE',
    currentPrice: 89.88,
    previousClose: 88.76,
    change: 1.12,
    changePercent: 1.26,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NKE.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.nike.com/'
  },
  {
    symbol: 'TMO',
    name: 'Thermo Fisher Scientific Inc',
    exchange: 'NYSE',
    currentPrice: 550.10,
    previousClose: 547.25,
    change: 2.85,
    changePercent: 0.52,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TMO.png',
    sector: 'Healthcare',
    description: 'https://www.thermofisher.com/'
  },
  {
    symbol: 'XOM',
    name: 'Exxon Mobil Corp',
    exchange: 'NYSE',
    currentPrice: 110.42,
    previousClose: 109.50,
    change: 0.92,
    changePercent: 0.84,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/XOM.png',
    sector: 'Energy',
    description: 'https://www.exxonmobil.com/'
  },
  {
    symbol: 'CVX',
    name: 'Chevron Corp',
    exchange: 'NYSE',
    currentPrice: 147.21,
    previousClose: 147.87,
    change: -0.66,
    changePercent: -0.45,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/CVX.png',
    sector: 'Energy',
    description: 'https://www.chevron.com/'
  },
  {
    symbol: 'ABBV',
    name: 'AbbVie Inc',
    exchange: 'NYSE',
    currentPrice: 170.45,
    previousClose: 169.50,
    change: 0.95,
    changePercent: 0.56,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/ABBV.png',
    sector: 'Healthcare',
    description: 'https://www.abbvie.com/'
  },
  {
    symbol: 'MRK',
    name: 'Merck & Co Inc',
    exchange: 'NYSE',
    currentPrice: 122.75,
    previousClose: 121.42,
    change: 1.33,
    changePercent: 1.09,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MRK.png',
    sector: 'Healthcare',
    description: 'https://www.merck.com/'
  },
  {
    symbol: 'COST',
    name: 'Costco Wholesale Corp',
    exchange: 'NASDAQ',
    currentPrice: 712.35,
    previousClose: 709.21,
    change: 3.14,
    changePercent: 0.44,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/COST.png',
    sector: 'Consumer Defensive',
    description: 'https://www.costco.com/'
  },
  {
    symbol: 'AVGO',
    name: 'Broadcom Inc',
    exchange: 'NASDAQ',
    currentPrice: 1302.55,
    previousClose: 1299.98,
    change: 2.57,
    changePercent: 0.20,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AVGO.png',
    sector: 'Technology',
    description: 'https://www.broadcom.com/'
  },
  {
    symbol: 'TXN',
    name: 'Texas Instruments Inc',
    exchange: 'NASDAQ',
    currentPrice: 170.12,
    previousClose: 168.97,
    change: 1.15,
    changePercent: 0.68,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TXN.png',
    sector: 'Technology',
    description: 'https://www.ti.com/'
  },
  {
    symbol: 'TMUS',
    name: 'T-Mobile US Inc',
    exchange: 'NASDAQ',
    currentPrice: 161.47,
    previousClose: 160.09,
    change: 1.38,
    changePercent: 0.86,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TMUS.png',
    sector: 'Communication Services',
    description: 'https://www.t-mobile.com/'
  },
  {
    symbol: 'IBM',
    name: 'International Business Machines Corp',
    exchange: 'NYSE',
    currentPrice: 174.50,
    previousClose: 173.85,
    change: 0.65,
    changePercent: 0.37,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/IBM.png',
    sector: 'Technology',
    description: 'https://www.ibm.com/'
  },
  {
    symbol: 'AMAT',
    name: 'Applied Materials Inc',
    exchange: 'NASDAQ',
    currentPrice: 195.40,
    previousClose: 192.75,
    change: 2.65,
    changePercent: 1.37,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMAT.png',
    sector: 'Technology',
    description: 'https://www.appliedmaterials.com/'
  },
  {
    symbol: 'QCOM',
    name: 'Qualcomm Inc',
    exchange: 'NASDAQ',
    currentPrice: 170.30,
    previousClose: 167.82,
    change: 2.48,
    changePercent: 1.48,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/QCOM.png',
    sector: 'Technology',
    description: 'https://www.qualcomm.com/'
  },
  {
    symbol: 'LLY',
    name: 'Eli Lilly and Co',
    exchange: 'NYSE',
    currentPrice: 750.15,
    previousClose: 742.55,
    change: 7.60,
    changePercent: 1.02,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/LLY.png',
    sector: 'Healthcare',
    description: 'https://www.lilly.com/'
  },
  {
    symbol: 'LOW',
    name: 'Lowe\'s Companies Inc',
    exchange: 'NYSE',
    currentPrice: 238.50,
    previousClose: 236.20,
    change: 2.30,
    changePercent: 0.97,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/LOW.png',
    sector: 'Consumer Cyclical',
    description: 'https://www.lowes.com/'
  },
  {
    symbol: 'UPS',
    name: 'United Parcel Service Inc',
    exchange: 'NYSE',
    currentPrice: 140.87,
    previousClose: 141.25,
    change: -0.38,
    changePercent: -0.27,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/UPS.png',
    sector: 'Industrials',
    description: 'https://www.ups.com/'
  },
  {
    symbol: 'AMT',
    name: 'American Tower Corp',
    exchange: 'NYSE',
    currentPrice: 201.42,
    previousClose: 198.95,
    change: 2.47,
    changePercent: 1.24,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMT.png',
    sector: 'Real Estate',
    description: 'https://www.americantower.com/'
  },
  {
    symbol: 'GS',
    name: 'Goldman Sachs Group Inc',
    exchange: 'NYSE',
    currentPrice: 455.52,
    previousClose: 452.30,
    change: 3.22,
    changePercent: 0.71,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/GS.png',
    sector: 'Financial Services',
    description: 'https://www.goldmansachs.com/'
  },
  {
    symbol: 'GOOG',
    name: 'Alphabet Inc Class C',
    exchange: 'NASDAQ',
    currentPrice: 147.30,
    previousClose: 145.92,
    change: 1.38,
    changePercent: 0.95,
    logoUrl: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/GOOG.png',
    sector: 'Technology',
    description: 'https://www.abc.xyz/'
  }
];