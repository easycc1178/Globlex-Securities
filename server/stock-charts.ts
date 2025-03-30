import { Express, Request, Response } from 'express';
import axios from 'axios';
import { log } from './vite';
import { storage } from './storage';

// ฟังก์ชันตรวจสอบว่ามีการยืนยันตัวตนหรือไม่
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
};

// ฟังก์ชันสร้างข้อมูลกราฟจำลอง
function generateSimulatedChartData(points: number) {
  const data = [];
  const now = new Date();
  let price = 100 + Math.random() * 100; // ราคาเริ่มต้นระหว่าง 100-200
  
  // สร้างข้อมูลย้อนหลังไป {points} จุด
  for (let i = points; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000); // ย้อนหลังทุก 5 นาที
    
    // สุ่มการเปลี่ยนแปลงราคาแบบต่อเนื่อง ±0.5%
    const change = price * (Math.random() * 0.01 - 0.005);
    price += change;
    
    data.push({
      time: time.toISOString(),
      price: parseFloat(price.toFixed(2))
    });
  }
  
  return data;
}

// ฟังก์ชันสร้างข้อมูล sentiment analysis จากข้อมูลการเปลี่ยนแปลงราคาหุ้น
function generateSentimentData(changePercent: number, priceChange: number, currentPrice: number) {
  // ค่าที่ได้อยู่ระหว่าง -100 ถึง 100
  let sentimentScore = Math.min(Math.max(changePercent * 10, -100), 100);
  
  // คำนวณความแรงของ sentiment (volume) โดยใช้ขนาดของการเปลี่ยนแปลงราคา
  const sentimentVolume = Math.min(Math.abs(priceChange) / (currentPrice * 0.01) * 100, 100);
  
  // กำหนดแนวโน้ม (trend) ตามขนาดและทิศทางของการเปลี่ยนแปลง
  let sentimentTrend = 'neutral';
  if (changePercent > 1.5) {
    sentimentTrend = 'strongly_bullish';
  } else if (changePercent > 0.5) {
    sentimentTrend = 'bullish';
  } else if (changePercent < -1.5) {
    sentimentTrend = 'strongly_bearish';
  } else if (changePercent < -0.5) {
    sentimentTrend = 'bearish';
  } else if (Math.abs(changePercent) <= 0.2) {
    sentimentTrend = 'neutral';
  } else {
    sentimentTrend = changePercent > 0 ? 'slightly_bullish' : 'slightly_bearish';
  }
  
  // สร้างคำอธิบายสั้นๆ ถึงสถานการณ์
  let description;
  if (sentimentTrend.includes('bullish')) {
    description = `ตลาดกำลังดีขึ้น ${changePercent.toFixed(2)}% มีแนวโน้มเป็นบวก`;
  } else if (sentimentTrend.includes('bearish')) {
    description = `ตลาดกำลังลดลง ${Math.abs(changePercent).toFixed(2)}% มีแนวโน้มเป็นลบ`;
  } else {
    description = `ตลาดค่อนข้างคงที่ มีการเปลี่ยนแปลงเพียง ${Math.abs(changePercent).toFixed(2)}%`;
  }
  
  // เพิ่มข้อความแนะนำตามแนวโน้ม (สำหรับใช้แสดงผลในหน้าเว็บ)
  let advice;
  if (sentimentTrend.includes('strongly_bullish')) {
    advice = 'โอกาสที่ดีในการลงทุนระยะสั้น แต่ระวังการปรับฐาน';
  } else if (sentimentTrend.includes('bullish')) {
    advice = 'แนวโน้มดี เหมาะสำหรับการลงทุนระยะกลาง';
  } else if (sentimentTrend.includes('strongly_bearish')) {
    advice = 'ระวังการลงทุนในช่วงนี้ ตลาดมีความผันผวนสูง';
  } else if (sentimentTrend.includes('bearish')) {
    advice = 'อาจรอจังหวะที่ดีกว่านี้ในการลงทุนเพิ่ม';
  } else {
    advice = 'ตลาดค่อนข้างนิ่ง เหมาะสำหรับการวางแผนลงทุนระยะยาว';
  }
  
  return {
    score: parseFloat(sentimentScore.toFixed(2)),
    volume: parseFloat(sentimentVolume.toFixed(2)), 
    trend: sentimentTrend,
    description,
    advice,
    timestamp: new Date()
  };
}

// ฟังก์ชันสำหรับดึงข้อมูลหุ้นจาก Alpha Vantage API
async function fetchStockData(symbol: string, interval: string = '5min') {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      log('ALPHA_VANTAGE_API_KEY not set', 'api');
      return null;
    }

    const response = await axios.get(`https://www.alphavantage.co/query`, {
      params: {
        function: 'TIME_SERIES_INTRADAY',
        symbol,
        interval,
        apikey: apiKey,
        outputsize: 'compact'
      }
    });

    return response.data;
  } catch (error) {
    log(`Error fetching stock data for ${symbol}: ${error}`, 'api');
    return null;
  }
}

// ฟังก์ชันสำหรับลงทะเบียน routes ของ stock charts
export function registerStockChartRoutes(app: Express) {
  // ดึงข้อมูล Sentiment Analysis ของตลาดหรือหุ้นเฉพาะ
  app.get('/api/stocks/sentiment', async (req, res) => {
    try {
      const symbol = req.query.symbol as string;
      
      if (symbol) {
        // ถ้ามีการระบุ symbol ให้ดึงข้อมูลหุ้นเฉพาะ
        const stock = await storage.getStockBySymbol(symbol);
        if (!stock) {
          return res.status(404).json({ message: 'Stock not found' });
        }
        
        // คำนวณค่า sentiment จากข้อมูลการเปลี่ยนแปลงราคา
        const sentimentData = generateSentimentData(
          stock.changePercent, // เปอร์เซ็นต์การเปลี่ยนแปลง
          Math.abs(stock.change), // ขนาดของการเปลี่ยนแปลง
          stock.currentPrice // ราคาปัจจุบัน
        );
        
        return res.json({
          symbol,
          stockId: stock.id,
          stockName: stock.name,
          sentimentData,
          lastUpdated: new Date()
        });
      } else {
        // ถ้าไม่ระบุ symbol ให้คำนวณ sentiment ของตลาดโดยรวม
        const allStocks = await storage.getAllStocks();
        
        if (!allStocks || allStocks.length === 0) {
          return res.status(404).json({ message: 'No stocks found' });
        }
        
        // คำนวณค่าเฉลี่ยการเปลี่ยนแปลงของตลาด
        const avgChangePercent = allStocks.reduce((sum, stock) => sum + stock.changePercent, 0) / allStocks.length;
        const avgChange = allStocks.reduce((sum, stock) => sum + Math.abs(stock.change), 0) / allStocks.length;
        const avgPrice = allStocks.reduce((sum, stock) => sum + stock.currentPrice, 0) / allStocks.length;
        
        // คำนวณ sentiment ของตลาดโดยรวม
        const marketSentiment = generateSentimentData(avgChangePercent, avgChange, avgPrice);
        
        // คำนวณจำนวนหุ้นที่ขึ้น/ลง/คงที่
        const upStocks = allStocks.filter(stock => stock.changePercent > 0).length;
        const downStocks = allStocks.filter(stock => stock.changePercent < 0).length;
        const flatStocks = allStocks.filter(stock => stock.changePercent === 0).length;
        
        // คำนวณสัดส่วนหุ้นขึ้น/ลง
        const upDownRatio = upStocks / (downStocks || 1); // ป้องกันการหารด้วย 0
        
        return res.json({
          market: true,
          stockCount: allStocks.length,
          upStocks,
          downStocks,
          flatStocks,
          upDownRatio,
          avgChangePercent,
          marketSentiment,
          lastUpdated: new Date()
        });
      }
    } catch (error) {
      log(`Get sentiment error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get sentiment data' });
    }
  });

  // ดึงข้อมูลสรุปตลาดหุ้น (Market Summary) แสดงหุ้นที่มีการเปลี่ยนแปลงมากที่สุด
  app.get('/api/stocks/market-summary', async (req, res) => {
    try {
      // ดึงข้อมูลหุ้นทั้งหมด
      const allStocks = await storage.getAllStocks();
      
      if (!allStocks || allStocks.length === 0) {
        return res.status(404).json({ message: 'No stocks found' });
      }
      
      // คัดกรองและหาหุ้นที่มีการเปลี่ยนแปลงสูงสุด
      const topGainers = [...allStocks]
        .filter(stock => stock.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);
      
      // คัดกรองและหาหุ้นที่มีการเปลี่ยนแปลงต่ำสุด (ลดลงมากที่สุด)
      const topLosers = [...allStocks]
        .filter(stock => stock.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);
      
      // คัดกรองและหาหุ้นที่มีการซื้อขายมากที่สุด (สมมติว่ามี volume)
      // สำหรับตอนนี้เราอาจสุ่มหุ้นขึ้นมาแสดง 5 ตัว
      const mostActive = [...allStocks]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
        
      // คำนวณค่าเฉลี่ยของตลาดโดยรวม
      const marketAverage = {
        totalChange: allStocks.reduce((sum, stock) => sum + stock.change, 0) / allStocks.length,
        totalChangePercent: allStocks.reduce((sum, stock) => sum + stock.changePercent, 0) / allStocks.length,
        totalVolume: allStocks.reduce((sum, _) => sum + Math.floor(Math.random() * 1000000), 0),
        stockCount: allStocks.length,
        lastUpdated: new Date()
      };
      
      return res.json({
        summary: {
          topGainers,
          topLosers,
          mostActive,
          marketAverage
        }
      });
    } catch (error) {
      log(`Get market summary error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get market summary' });
    }
  });
  // ดึงข้อมูลกราฟแท่งเทียน (OHLC) ตามช่วงเวลาที่กำหนด
  app.get('/api/stocks/:symbol/historical', async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = req.query.interval as string || '1day';
      const timeframe = req.query.timeframe as string || 'week'; // 'day', 'week', 'month', 'year'
      
      // ค้นหาข้อมูลหุ้นตาม symbol
      const stock = await storage.getStockBySymbol(symbol);
      if (!stock) {
        return res.status(404).json({ message: 'Stock not found' });
      }
      
      // กำหนดช่วงเวลาตาม timeframe
      const now = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 7); // ค่าเริ่มต้น 1 สัปดาห์
      }
      
      // ดึงข้อมูลจากฐานข้อมูลตามช่วงเวลา
      // สมมติว่าเรามีเมธอด getStockPriceHistoryByTimeRange ในคลาส Storage
      // หากไม่มี ให้ดัดแปลงจาก getStockPriceHistory
      // อนาคตเราควรเพิ่มเมธอดนี้ในอินเตอร์เฟซและคลาสการเก็บข้อมูล
      
      // ใช้วิธีดึงข้อมูลทั้งหมดก่อนและกรองด้วย JavaScript
      const allPriceHistory = await storage.getStockPriceHistory(stock.id, interval, 1000);
      
      // กรองข้อมูลตามช่วงเวลา
      const filteredHistory = allPriceHistory.filter(item => {
        return item.timestamp >= startDate && item.timestamp <= now;
      });
      
      if (filteredHistory.length > 0) {
        // แปลงข้อมูลให้อยู่ในรูปแบบ OHLC สำหรับ TradingView
        const candlestickData = filteredHistory.map(item => ({
          time: item.timestamp.getTime(),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        }));
        
        return res.json({
          symbol,
          stockId: stock.id,
          timeframe,
          interval,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          data: candlestickData,
          count: candlestickData.length,
          fromDatabase: true
        });
      } else {
        // ถ้าไม่มีข้อมูลในฐานข้อมูล ให้ส่งข้อมูลจำลอง
        const simulatedData = generateCandlestickData(stock, 
          timeframe === 'day' ? 24 : 
          timeframe === 'week' ? 7 * 24 : 
          timeframe === 'month' ? 30 * 24 : 365);
        
        return res.json({
          symbol,
          stockId: stock.id,
          timeframe,
          interval,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          data: simulatedData,
          simulatedData: true
        });
      }
    } catch (error) {
      log(`Get historical chart error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get historical data' });
    }
  });
  
  // ดึงข้อมูลกราฟแท่งเทียน (OHLC) จากฐานข้อมูล - ไม่ต้องการ authentication เพื่อการทดสอบ
  app.get('/api/stocks/:symbol/candlestick', async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = req.query.interval as string || '1min';
      const limit = parseInt(req.query.limit as string || '100');
      
      // ค้นหาข้อมูลหุ้นตาม symbol
      const stock = await storage.getStockBySymbol(symbol);
      if (!stock) {
        return res.status(404).json({ message: 'Stock not found' });
      }
      
      // ดึงข้อมูลราคาหุ้นย้อนหลังจากฐานข้อมูล
      const priceHistory = await storage.getStockPriceHistory(stock.id, interval, limit);
      
      if (priceHistory.length > 0) {
        // แปลงข้อมูลให้อยู่ในรูปแบบ OHLC สำหรับ TradingView
        const candlestickData = priceHistory.map(item => ({
          time: item.timestamp.getTime(),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        }));
        
        return res.json({
          symbol,
          stockId: stock.id,
          data: candlestickData,
          fromDatabase: true
        });
      } else {
        // ถ้าไม่มีข้อมูลในฐานข้อมูล ให้ลองดึงจาก API ภายนอก
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (apiKey) {
          // เรียกข้อมูลจาก Alpha Vantage
          const data = await fetchStockData(symbol, interval);
          
          if (data && data[`Time Series (${interval})`]) {
            // แปลงข้อมูลให้อยู่ในรูปแบบที่ใช้งานได้
            const timeSeries = data[`Time Series (${interval})`];
            const timestamps = Object.keys(timeSeries).sort();
            
            const candlestickData = [];
            
            // บันทึกข้อมูลที่ได้ลงฐานข้อมูล
            for (const timestamp of timestamps) {
              const time = new Date(timestamp);
              const dataPoint = timeSeries[timestamp];
              
              // เพิ่มข้อมูลในตาราง stock_price_history
              try {
                const priceHistory = await storage.saveStockPriceHistory({
                  stockId: stock.id,
                  timestamp: time,
                  open: parseFloat(dataPoint['1. open']),
                  high: parseFloat(dataPoint['2. high']),
                  low: parseFloat(dataPoint['3. low']),
                  close: parseFloat(dataPoint['4. close']),
                  volume: parseInt(dataPoint['5. volume']),
                  interval
                });
                
                candlestickData.push({
                  time: time.getTime(),
                  open: priceHistory.open,
                  high: priceHistory.high,
                  low: priceHistory.low,
                  close: priceHistory.close,
                  volume: priceHistory.volume
                });
              } catch (error) {
                log(`Error saving stock price history: ${error}`, 'api');
              }
            }
            
            log(`Saved ${candlestickData.length} price points for ${symbol}`, 'api');
            
            return res.json({
              symbol,
              stockId: stock.id,
              data: candlestickData,
              fromApi: true,
              savedToDatabase: true
            });
          }
        }
        
        // ถ้าไม่มีข้อมูลในฐานข้อมูลและไม่สามารถดึงจาก API ได้ ให้ส่งข้อมูลจำลอง
        const simulatedData = generateCandlestickData(stock, limit);
        
        return res.json({
          symbol,
          stockId: stock.id,
          data: simulatedData,
          simulatedData: true
        });
      }
    } catch (error) {
      log(`Get candlestick chart error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get candlestick data' });
    }
  });
  
  // ดึงข้อมูลกราฟหุ้นจาก Alpha Vantage (เดิม - สำหรับความเข้ากันได้กับโค้ดเก่า)
  app.get('/api/stocks/:symbol/chart', isAuthenticated, async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = req.query.interval as string || '5min';
      
      // ตรวจสอบ API key
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        return res.status(200).json({ 
          message: 'API key is not configured',
          symbol,
          simulatedData: true,
          data: generateSimulatedChartData(30) // ส่งข้อมูลจำลองกลับไปถ้าไม่มี API key
        });
      }
      
      try {
        // เรียกข้อมูล intraday จาก Alpha Vantage
        const data = await fetchStockData(symbol, interval);
        
        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (data && data[`Time Series (${interval})`]) {
          // แปลงข้อมูลให้อยู่ในรูปแบบที่ใช้งานง่าย
          const timeSeries = data[`Time Series (${interval})`];
          const timestamps = Object.keys(timeSeries).sort(); // เรียงตามเวลา
          
          const chartData = timestamps.map(timestamp => ({
            time: timestamp,
            price: parseFloat(timeSeries[timestamp]['4. close'])
          }));
          
          return res.json({
            symbol,
            data: chartData,
            simulatedData: false
          });
        } else {
          throw new Error('Invalid API response');
        }
      } catch (error) {
        log(`Error fetching chart data for ${symbol}: ${error}`, 'api');
        
        // ถ้าเกิดข้อผิดพลาด ส่งข้อมูลจำลองกลับไป
        return res.json({
          symbol,
          simulatedData: true,
          data: generateSimulatedChartData(30)
        });
      }
    } catch (error) {
      log(`Get stock chart error: ${error}`, 'api');
      res.status(500).json({ message: 'Failed to get stock chart data' });
    }
  });
}

// ฟังก์ชันสร้างข้อมูลแท่งเทียนจำลองสำหรับกราฟหุ้น
function generateCandlestickData(stock: any, points: number) {
  const data = [];
  const now = new Date();
  let price = stock.currentPrice;
  let basePrice = price * 0.99; // ราคาเริ่มต้นประมาณ 99% ของราคาปัจจุบัน
  
  // สร้างข้อมูลย้อนหลังไป {points} จุด
  for (let i = points; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60 * 1000); // ย้อนหลังทุก 5 นาที
    
    // สุ่มเปอร์เซ็นต์การเปลี่ยนแปลงของราคาในแต่ละช่วง ระหว่าง -1% ถึง +1%
    const changePercent = (Math.random() * 2 - 1) * 0.01;
    basePrice = basePrice * (1 + changePercent);
    
    // สุ่มค่า open, high, low, close
    const range = basePrice * 0.005; // ช่วงราคาประมาณ 0.5%
    const open = basePrice;
    const close = basePrice * (1 + (Math.random() * 0.008 - 0.004)); // เปลี่ยนแปลง ±0.4%
    const high = Math.max(open, close) + Math.random() * range;
    const low = Math.min(open, close) - Math.random() * range;
    
    // สุ่มปริมาณการซื้อขาย
    const volume = Math.floor(Math.random() * 10000) + 1000;
    
    data.push({
      time: time.getTime(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    });
  }
  
  return data;
}