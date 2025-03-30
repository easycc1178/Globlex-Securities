import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWebSocket } from '@/hooks/use-websocket';
import { formatThaiCurrency } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { Stock, StockTrade } from '@shared/schema';
import { MarketSentimentIndicator } from '@/components/MarketSentimentIndicator';
import WinnerTicker from '@/components/WinnerTicker';
// นำเข้า TradingView Chart
import { AdvancedChart } from 'react-tradingview-embed';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  ChevronUp,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Timer,
  Clock,
  Sparkles,
  BarChart3,
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// ลงทะเบียนคอมโพเนนต์ที่จำเป็นสำหรับ Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ส่วนของ Stock Card ที่แสดงข้อมูลหุ้นแต่ละตัว
function StockCard({ stock, onSelect }: { stock: Stock; onSelect: (stock: Stock) => void }) {
  const isPositive = stock.change >= 0;
  const lastUpdate = useRef(new Date());
  const [animatePulse, setAnimatePulse] = useState(false);
  
  // เมื่อราคาเปลี่ยน ให้แสดงอนิเมชั่นกระพริบ
  useEffect(() => {
    lastUpdate.current = new Date();
    setAnimatePulse(true);
    
    // หยุดอนิเมชั่นหลังจาก 2 วินาที
    const timer = setTimeout(() => {
      setAnimatePulse(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [stock.currentPrice]);
  
  return (
    <Card 
      className="cursor-pointer hover:border-primary/30 hover:shadow-[0_0_15px_rgba(0,120,255,0.15)] transition-all bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700/50 shadow-md"
      onClick={() => onSelect(stock)}
    >
      <div className="flex items-center p-2 gap-2">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-800 border border-primary/20 rounded-md shadow-[0_0_10px_rgba(0,120,255,0.15)]">
          <span className="text-sm font-bold text-primary">{stock.symbol}</span>
        </div>
        
        <div className="flex-grow overflow-hidden">
          <div className="text-sm font-medium truncate text-white">{stock.name}</div>
          <div className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'} ${animatePulse ? 'animate-pulse' : ''}`}>
            {formatThaiCurrency(stock.currentPrice)}
          </div>
        </div>
        
        <div className="flex-shrink-0 flex flex-col items-end">
          {isPositive ? (
            <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-[10px] flex items-center gap-0.5 h-4 mb-0.5 font-normal shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <TrendingUp className="h-2.5 w-2.5" />
              {stock.changePercent.toFixed(2)}%
            </Badge>
          ) : (
            <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-red-600 text-[10px] flex items-center gap-0.5 h-4 mb-0.5 font-normal shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <TrendingDown className="h-2.5 w-2.5" />
              {stock.changePercent.toFixed(2)}%
            </Badge>
          )}
          
          <div className={`text-[10px] ${isPositive ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-0.5 font-medium`}>
            {isPositive ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {isPositive ? '+' : ''}{stock.change.toFixed(2)}
          </div>
        </div>
      </div>
      
      <div className="px-2 pb-1.5">
        <div className="flex justify-between items-center mb-1">
          <MarketSentimentIndicator 
            sentimentScore={stock.sentimentScore} 
            sentimentVolume={stock.sentimentVolume} 
            sentimentTrend={stock.sentimentTrend} 
            size="sm"
          />
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] text-slate-300">เรียลไทม์</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// คอมโพเนนท์สำหรับแสดงกราฟแท่งเทียน (Candlestick) แบบเรียลไทม์ด้วย TradingView
function StockChart({ stock }: { stock: Stock | null }) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [animatePrice, setAnimatePrice] = useState(false);
  
  // ถ้าไม่มีหุ้นที่เลือก แสดงข้อความ
  if (!stock) return <div className="h-72 flex justify-center items-center text-xs text-white/80">เลือกหุ้นเพื่อดูกราฟ</div>;
  
  // อัพเดทเวลาล่าสุดเมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    if (stock) {
      const now = new Date();
      setLastUpdate(now);
      setAnimatePrice(true);
      
      // ยกเลิกการเอนิเมทหลังจาก 2 วินาที
      const timer = setTimeout(() => {
        setAnimatePrice(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [stock.currentPrice]);
  
  // คำนวณเวลาที่ผ่านไปตั้งแต่การอัพเดทล่าสุด
  const timeSinceUpdate = Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000);
  const formattedTime = timeSinceUpdate < 60 
    ? `${timeSinceUpdate} วินาทีที่แล้ว` 
    : `${Math.floor(timeSinceUpdate / 60)} นาทีที่แล้ว`;
  
  const isPositive = stock.change >= 0;
  
  // กำหนดค่าตัวเลือกสำหรับ TradingView Chart
  const widgetOptions = {
    symbol: stock.asset_type === 'crypto' 
      ? `BINANCE:${stock.symbol}USDT` // สำหรับคริปโต ใช้ format BINANCE:BTCUSDT
      : `${stock.exchange || 'NYSE'}:${stock.symbol}`, // สำหรับหุ้นปกติ
    interval: '1', // กำหนดเป็น 1 นาที
    timezone: 'Asia/Bangkok',
    theme: 'dark',
    style: '1', // แบบแท่งเทียน (Candlestick)
    locale: 'th',
    toolbar_bg: '#1e293b',
    enable_publishing: false,
    hide_side_toolbar: true,
    allow_symbol_change: false,
    container_id: `tradingview_${stock.symbol}`,
    width: "100%",
    height: "100%", // เปลี่ยนจาก 400 เป็น 100% เพื่อให้กราฟเต็ม parent container
  };
  
  return (
    <div className="h-[520px] bg-slate-800/70 rounded-lg border border-slate-700/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-2 z-10 bg-gradient-to-b from-slate-900 to-transparent">
        <div className="text-xs text-slate-300 flex items-center">
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-800 border border-primary/20 rounded-md shadow-[0_0_5px_rgba(0,120,255,0.15)] mr-2">
            <span className="text-[10px] font-bold text-primary">{stock.symbol}</span>
          </div>
          <span>{stock.name}</span>
        </div>
        <div className={`text-xs font-bold flex flex-col items-end ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={animatePrice ? 'animate-pulse' : ''}>{formatThaiCurrency(stock.currentPrice)}</span>
          <span className="text-[10px] text-slate-400 flex items-center">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
            อัพเดทล่าสุด {formattedTime}
          </span>
        </div>
      </div>
      
      {/* แสดงกราฟ TradingView จริง */}
      <div className="w-full h-full pt-12">
        <AdvancedChart 
          widgetProps={widgetOptions} 
        />
      </div>
      
      {/* ตัวแสดงสถานะ */}
      <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-slate-300 bg-slate-900/80 px-2 py-1 rounded-full">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
        <span>ตลาดปิดทำการ</span>
      </div>
    </div>
  );
}

// ส่วนของหน้าต่างเทรดแบบพับเปิดที่แสดงหลังจากคลิกที่หุ้น
function StockTradingDrawer({ 
  isOpen,
  onClose,
  stock,
  onTrade
}: { 
  isOpen: boolean;
  onClose: () => void;
  stock: Stock | null;
  onTrade: (data: { stockId: number; direction: 'up' | 'down'; amount: number; duration: number; multiplier: number; startPrice: number; potentialPayout: number }) => void;
}) {
  const [amount, setAmount] = useState<string>('100');
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [duration, setDuration] = useState<number>(90);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  // ตัวเลือกจำนวนเงินด่วน
  const quickAmounts = [100, 500, 1000, 5000];
  
  const multiplier = duration === 300 ? 2.6 : 1.8;
  const potentialPayout = parseFloat(amount) * multiplier;
  
  useEffect(() => {
    if (!isOpen) {
      // Reset form when drawer closes
      setAmount('100');
      setDirection('up');
      setDuration(90);
      setIsConfirmOpen(false);
    }
  }, [isOpen]);
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setAmount(value);
  };
  
  const handleSubmit = () => {
    if (!stock) return;
    setIsConfirmOpen(true);
  };
  
  const handleConfirmTrade = () => {
    if (!stock) return;
    
    onTrade({
      stockId: stock.id,
      direction,
      amount: parseFloat(amount),
      duration,
      multiplier,
      startPrice: stock.currentPrice,
      potentialPayout
    });
    
    setIsConfirmOpen(false);
    onClose();
  };
  
  if (!stock) return null;
  
  const isPositive = stock.change >= 0;
  
  // ใช้ drawer แบบครึ่งหน้าจอทั้งโมบายและเดสก์ท็อป
  return (
    <>
      <Drawer open={isOpen} onOpenChange={onClose} direction="bottom">
        <DrawerContent className="max-h-[85vh] rounded-t-xl bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-primary/30 border-t-2 shadow-[0_-4px_20px_rgba(0,120,255,0.25)] text-white">
          <div className="w-full mx-auto">
            <DrawerHeader className="p-3 pb-0">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary/15 border border-primary/30 rounded-md shadow-[0_0_10px_rgba(0,120,255,0.15)]">
                    <span className="text-base font-bold text-primary">{stock.symbol}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-semibold truncate max-w-[150px]">{stock.name}</span>
                    <span className={`text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'} font-medium`}>
                      {formatThaiCurrency(stock.currentPrice)}
                      <span className="ml-1 text-xs">
                        {isPositive ? '+' : ''}{stock.change.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>
                {isPositive ? (
                  <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-xs h-5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stock.changePercent.toFixed(2)}%
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-red-600 text-xs h-5 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {stock.changePercent.toFixed(2)}%
                  </Badge>
                )}
              </div>
            </DrawerHeader>
            
            <ScrollArea className="px-4 pb-4 h-[calc(80vh-140px)]">
              <div className="py-2">
                <div className="bg-gradient-to-br from-transparent to-emerald-900/20 rounded-xl p-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] border border-emerald-900/10">
                  <div className="h-[320px]">
                    {/* ใช้ข้อมูลสำหรับกราฟคล้ายกับกราฟหลักแต่ปรับขนาดให้เล็กลง */}
                    <AdvancedChart 
                      widgetProps={{
                        symbol: stock.asset_type === 'crypto' 
                          ? `BINANCE:${stock.symbol}USDT` // สำหรับคริปโต ใช้ format BINANCE:BTCUSDT
                          : `${stock.exchange || 'NYSE'}:${stock.symbol}`, // สำหรับหุ้นปกติ
                        interval: '1', // กำหนดเป็น 1 นาที
                        timezone: 'Asia/Bangkok',
                        theme: 'dark',
                        style: '1', // แบบแท่งเทียน (Candlestick)
                        locale: 'th',
                        toolbar_bg: '#1e293b',
                        enable_publishing: false,
                        hide_side_toolbar: true,
                        allow_symbol_change: false,
                        container_id: `tradingview_drawer_${stock.symbol}`,
                        width: "100%",
                        height: 320
                      }}
                    />
                  </div>
                </div>
                
                <div className="mt-2 bg-slate-800/40 rounded-lg border border-slate-700/50 p-2 shadow-[0_0_10px_rgba(0,120,255,0.05)]">
                  <MarketSentimentIndicator 
                    sentimentScore={stock.sentimentScore} 
                    sentimentVolume={stock.sentimentVolume} 
                    sentimentTrend={stock.sentimentTrend} 
                    showDetails={true}
                    size="md"
                    className="py-1"
                  />
                </div>
              </div>
              
              <div className="mt-2">
                <div className="mb-3">
                  <label className="text-xs font-medium mb-1 block">จำนวนเงิน</label>
                  <Input 
                    value={amount}
                    onChange={handleAmountChange} 
                    placeholder="ใส่จำนวนเงิน" 
                    className="text-right h-9 text-sm bg-slate-600 border-slate-500 text-white placeholder:text-slate-300"
                  />
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {quickAmounts.map(amt => (
                      <Button 
                        key={amt}
                        variant={amount === amt.toString() ? "default" : "outline"} 
                        size="sm" 
                        className={`h-7 text-xs ${amount === amt.toString() ? "bg-primary text-white" : ""}`} 
                        onClick={() => setAmount(amt.toString())}
                      >
                        ฿{amt >= 1000 ? `${amt/1000}K` : amt}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="text-xs font-medium mb-1 block">ระยะเวลา</label>
                  <div className="grid grid-cols-3 gap-1">
                    <Button 
                      variant={duration === 90 ? "default" : "outline"}
                      className={`h-16 p-1 ${duration === 90 ? "bg-primary" : "bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"}`}
                      onClick={() => setDuration(90)}
                    >
                      <div className="flex flex-col items-center">
                        <Timer className="h-3 w-3 mb-1" />
                        <span className="text-xs font-semibold">90 วินาที</span>
                        <span className="text-[10px]">x1.8</span>
                      </div>
                    </Button>
                    <Button 
                      variant={duration === 120 ? "default" : "outline"}
                      className={`h-16 p-1 ${duration === 120 ? "bg-primary" : "bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"}`}
                      onClick={() => setDuration(120)}
                    >
                      <div className="flex flex-col items-center">
                        <Timer className="h-3 w-3 mb-1" />
                        <span className="text-xs font-semibold">120 วินาที</span>
                        <span className="text-[10px]">x1.8</span>
                      </div>
                    </Button>
                    <Button 
                      variant={duration === 300 ? "default" : "outline"}
                      className={`h-16 p-1 ${duration === 300 ? "bg-primary" : "bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"}`}
                      onClick={() => setDuration(300)}
                    >
                      <div className="flex flex-col items-center">
                        <Timer className="h-3 w-3 mb-1" />
                        <span className="text-xs font-semibold">5 นาที</span>
                        <span className="text-[10px]">x2.6</span>
                      </div>
                    </Button>
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="text-xs font-medium mb-1 block">คาดการณ์ทิศทาง</label>
                  <div className="grid grid-cols-2 gap-1">
                    <Button 
                      variant={direction === 'up' ? "default" : "outline"}
                      className={`h-20 p-1 ${direction === 'up' ? "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700" : "bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"}`}
                      onClick={() => setDirection('up')}
                    >
                      <div className="flex flex-col items-center">
                        <TrendingUp className="h-6 w-6 mb-1" />
                        <span className="text-sm font-semibold mb-0.5">ราคาขึ้น</span>
                        <div className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">ได้รับ x{multiplier}</div>
                      </div>
                    </Button>
                    <Button 
                      variant={direction === 'down' ? "default" : "outline"}
                      className={`h-20 p-1 ${direction === 'down' ? "bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700" : "bg-slate-600 border-slate-500 hover:bg-slate-500 text-white"}`}
                      onClick={() => setDirection('down')}
                    >
                      <div className="flex flex-col items-center">
                        <TrendingDown className="h-6 w-6 mb-1" />
                        <span className="text-sm font-semibold mb-0.5">ราคาลง</span>
                        <div className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">ได้รับ x{multiplier}</div>
                      </div>
                    </Button>
                  </div>
                </div>
                
                <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3 mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-slate-200">จำนวนเงิน:</span>
                    <span className="text-xs font-medium">{formatThaiCurrency(parseFloat(amount) || 0)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-slate-200">ตัวคูณ:</span>
                    <span className="text-xs font-medium">x{multiplier}</span>
                  </div>
                  <div className="border-t border-slate-700 my-2 pt-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-200">โอกาสได้รับ:</span>
                      <span className="text-xs font-bold text-emerald-400">{formatThaiCurrency(potentialPayout)}</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-[0_0_15px_rgba(0,120,255,0.3)]"
                  onClick={handleSubmit}
                  disabled={parseFloat(amount) <= 0}
                >
                  เริ่มการเทรด
                </Button>
              </div>
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>
      
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 text-white border border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการเทรด</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              คุณต้องการยืนยันการเทรดนี้หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-slate-800/70 rounded-lg border border-slate-700/40 p-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-300">{stock.asset_type === 'crypto' ? 'คริปโต:' : 'หุ้น:'}</span>
              <span className="text-xs font-medium">{stock.symbol} - {stock.name}</span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-300">ราคาปัจจุบัน:</span>
              <span className="text-xs font-medium">{formatThaiCurrency(stock.currentPrice)}</span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-300">ทิศทาง:</span>
              <span className="text-xs font-medium flex items-center">
                {direction === 'up' ? (
                  <>
                    <TrendingUp className="h-3 w-3 mr-1 text-emerald-400" />
                    <span className="text-emerald-400">ขึ้น</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 mr-1 text-red-400" />
                    <span className="text-red-400">ลง</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-300">จำนวนเงิน:</span>
              <span className="text-xs font-medium">{formatThaiCurrency(parseFloat(amount) || 0)}</span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-300">ระยะเวลา:</span>
              <span className="text-xs font-medium">{duration >= 60 ? `${duration / 60} นาที` : `${duration} วินาที`}</span>
            </div>
            <div className="border-t border-slate-700 mt-2 pt-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-300">โอกาสได้รับ:</span>
                <span className="text-xs font-bold text-emerald-400">{formatThaiCurrency(potentialPayout)}</span>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTrade} className="bg-primary hover:bg-primary/90">ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// คอมโพเนนท์แสดงรายการเทรดที่กำลังดำเนินอยู่
function ActiveTradeCard({ trade, stock }: { trade: StockTrade; stock: Stock | null }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  
  // คำนวณเวลาที่เหลือ
  useEffect(() => {
    if (!trade) return;
    
    const tradeStartTime = new Date(trade.startTime).getTime();
    const tradeDuration = trade.duration * 1000;
    const tradeEndTime = tradeStartTime + tradeDuration;
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = tradeEndTime - now;
      
      if (distance <= 0) {
        setTimeLeft(0);
        setProgress(100);
        return;
      }
      
      setTimeLeft(Math.floor(distance / 1000));
      const progressValue = 100 - (distance / tradeDuration) * 100;
      setProgress(progressValue);
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(timer);
  }, [trade]);
  
  if (!trade || !stock) return null;
  
  const directionColor = trade.direction === 'up' ? 'text-emerald-400' : 'text-red-400';
  const directionBgColor = trade.direction === 'up' ? 'bg-emerald-500/20' : 'bg-red-500/20';
  const directionBorderColor = trade.direction === 'up' ? 'border-emerald-500/30' : 'border-red-500/30';
  
  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <Card className="mb-2 bg-slate-800/70 border-slate-700/50">
      <CardContent className="p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 border border-primary/20 rounded-md mr-2">
              <span className="text-xs font-bold text-primary">{stock.symbol}</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white">
                {stock.name} 
                <span className="ml-1 text-[10px] text-slate-400">
                  ({stock.asset_type === 'crypto' ? 'คริปโต' : 'หุ้น'})
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" /> 
                {new Date(trade.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <Badge className={`px-1.5 py-0.5 h-5 ${directionBgColor} ${directionBorderColor} border`}>
            <span className={`text-[10px] flex items-center gap-0.5 ${directionColor}`}>
              {trade.direction === 'up' ? (
                <>
                  <TrendingUp className="h-3 w-3" /> ขึ้น
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3" /> ลง
                </>
              )}
            </span>
          </Badge>
        </div>
        
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-300">ราคาเริ่มต้น:</span>
          <span className="font-medium text-white">{formatThaiCurrency(trade.startPrice)}</span>
        </div>
        
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-300">จำนวนเงิน:</span>
          <span className="font-medium text-white">{formatThaiCurrency(trade.amount)}</span>
        </div>
        
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-300">คาดหวังผลตอบแทน:</span>
          <span className="font-medium text-emerald-400">{formatThaiCurrency(trade.potentialPayout)}</span>
        </div>
        
        <div className="mt-2">
          <div className="flex justify-between text-[10px] mb-1">
            <span>เหลือเวลา:</span>
            <span className="font-medium">{formatTime(timeLeft)}</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}

// คอมโพเนนท์แสดงประวัติการเทรด
function TradeHistoryCard({ trade, stock }: { trade: StockTrade; stock: Stock | null }) {
  if (!trade || !stock) return null;
  
  const isWin = trade.status === 'win';
  const isLoss = trade.status === 'loss';
  
  const statusBgColor = 
    isWin ? 'bg-emerald-500/15' : 
    isLoss ? 'bg-red-500/15' : 
    'bg-amber-500/15';
  
  const statusBorderColor = 
    isWin ? 'border-emerald-500/20' : 
    isLoss ? 'border-red-500/20' : 
    'border-amber-500/20';
  
  const statusTextColor = 
    isWin ? 'text-emerald-400' : 
    isLoss ? 'text-red-400' : 
    'text-amber-400';
  
  const statusText = 
    isWin ? 'ชนะ' : 
    isLoss ? 'แพ้' : 
    'กำลังประมวลผล';

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <Card className="mb-2 bg-slate-800/70 border-slate-700/50">
      <CardContent className="p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 border border-primary/20 rounded-md mr-2">
              <span className="text-xs font-bold text-primary">{stock.symbol}</span>
            </div>
            <div>
              <div className="text-xs font-medium text-white">
                {stock.name}
                <span className="ml-1 text-[10px] text-slate-400">
                  ({stock.asset_type === 'crypto' ? 'คริปโต' : 'หุ้น'})
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                {formatDate(trade.startTime)}
              </div>
            </div>
          </div>
          <Badge className={`px-1.5 py-0.5 h-5 ${statusBgColor} ${statusBorderColor} border`}>
            <span className={`text-[10px] flex items-center gap-0.5 ${statusTextColor}`}>
              {isWin && <Sparkles className="h-3 w-3" />}
              {statusText}
            </span>
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-1">
          <div className="flex justify-between">
            <span className="text-slate-300">ทิศทาง:</span>
            <span className={`font-medium ${trade.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trade.direction === 'up' ? 'ขึ้น' : 'ลง'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-300">จำนวนเงิน:</span>
            <span className="font-medium text-white">{formatThaiCurrency(trade.amount)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-300">ราคาเริ่ม:</span>
            <span className="font-medium text-white">{formatThaiCurrency(trade.startPrice)}</span>
          </div>
          
          {trade.endPrice && (
            <div className="flex justify-between">
              <span className="text-slate-300">ราคาปิด:</span>
              <span className="font-medium text-white">{formatThaiCurrency(trade.endPrice)}</span>
            </div>
          )}
        </div>
        
        {isWin && (
          <div className="mt-2 bg-emerald-900/20 rounded-md p-1.5 border border-emerald-900/30">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">ผลตอบแทน:</span>
              <span className="font-medium text-emerald-400">{formatThaiCurrency(trade.potentialPayout)}</span>
            </div>
          </div>
        )}
        
        {isLoss && (
          <div className="mt-2 bg-red-900/20 rounded-md p-1.5 border border-red-900/30">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">ขาดทุน:</span>
              <span className="font-medium text-red-400">-{formatThaiCurrency(trade.amount)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// คอมโพเนนท์นับถอยหลังเมื่อกำลังเทรด
function CountdownDialog({ 
  isOpen, 
  onClose, 
  trade, 
  stock,
  onCountdownComplete
}: { 
  isOpen: boolean; 
  onClose: () => void;
  trade: StockTrade | null;
  stock: Stock | null;
  onCountdownComplete: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<'win' | 'loss' | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [countdownComplete, setCountdownComplete] = useState<boolean>(false);
  
  // คำนวณเวลาที่เหลือ
  useEffect(() => {
    if (!trade || !stock || !isOpen) return;
    
    setResult(null);
    setCountdownComplete(false);
    setCurrentPrice(stock.currentPrice);
    
    const tradeStartTime = new Date(trade.startTime).getTime();
    const tradeDuration = trade.duration * 1000;
    const tradeEndTime = tradeStartTime + tradeDuration;
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = tradeEndTime - now;
      
      if (distance <= 0) {
        setTimeLeft(0);
        setProgress(100);
        setCountdownComplete(true);
        
        // Determine result
        const isUp = stock.currentPrice > trade.startPrice;
        const wantedUp = trade.direction === 'up';
        const tradeResult = isUp === wantedUp ? 'win' : 'loss';
        setResult(tradeResult as 'win' | 'loss');
        
        // Callback
        onCountdownComplete();
        return;
      }
      
      setTimeLeft(Math.floor(distance / 1000));
      const progressValue = 100 - (distance / tradeDuration) * 100;
      setProgress(progressValue);
      
      // Update current price (in real system this would be a websocket update)
      setCurrentPrice(stock.currentPrice);
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(timer);
  }, [trade, stock, isOpen, onCountdownComplete]);
  
  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!trade || !stock) return null;
  
  const directionColor = trade.direction === 'up' ? 'text-emerald-400' : 'text-red-400';
  const priceChangeColor = currentPrice && currentPrice > trade.startPrice ? 'text-emerald-400' : 'text-red-400';
  const priceChange = currentPrice ? currentPrice - trade.startPrice : 0;
  const priceChangePercent = (priceChange / trade.startPrice) * 100;
  
  const resultBgColor = result === 'win' ? 'bg-emerald-500/30' : result === 'loss' ? 'bg-red-500/30' : 'bg-slate-700';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 text-white border border-slate-700">
        <DialogHeader>
          <DialogTitle>การเทรดกำลังดำเนินการ</DialogTitle>
          <DialogDescription className="text-slate-300">
            กรุณารอจนกว่าจะครบกำหนดเวลา
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-slate-800/70 rounded-lg border border-slate-700/50 p-3 mb-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <div className="w-10 h-10 flex items-center justify-center bg-slate-800 border border-primary/20 rounded-md mr-2 shadow-[0_0_5px_rgba(0,120,255,0.15)]">
                <span className="text-sm font-bold text-primary">{stock.symbol}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-white truncate max-w-[180px]">
                  {stock.name}
                  <span className="ml-1 text-[10px] text-slate-400">
                    ({stock.asset_type === 'crypto' ? 'คริปโต' : 'หุ้น'})
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(trade.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">ทิศทางที่เลือก:</span>
              <span className={`font-medium ${directionColor} flex items-center`}>
                {trade.direction === 'up' ? (
                  <>
                    <TrendingUp className="h-3 w-3 mr-1" /> ขึ้น
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 mr-1" /> ลง
                  </>
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">ราคาเริ่มต้น:</span>
              <span className="font-medium text-white">{formatThaiCurrency(trade.startPrice)}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">ราคาปัจจุบัน:</span>
              <span className={`font-medium ${priceChangeColor}`}>
                {formatThaiCurrency(currentPrice || 0)}
                <span className="ml-1 text-[10px]">
                  ({priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">จำนวนเงิน:</span>
              <span className="font-medium text-white">{formatThaiCurrency(trade.amount)}</span>
            </div>
          </div>
          
          <div className={`p-2 rounded-md ${resultBgColor} ${countdownComplete ? 'block' : 'hidden'}`}>
            {result === 'win' && (
              <div className="text-center">
                <Sparkles className="h-5 w-5 mx-auto mb-1 text-yellow-300" />
                <div className="text-sm font-bold text-emerald-400 mb-0.5">คุณชนะ! 🎉</div>
                <div className="text-xs text-slate-300 mb-1">ยินดีด้วย! คุณทำนายทิศทางได้ถูกต้อง</div>
                <div className="text-xs font-medium text-emerald-400">
                  ได้รับ: {formatThaiCurrency(trade.potentialPayout)}
                </div>
              </div>
            )}
            
            {result === 'loss' && (
              <div className="text-center">
                <div className="text-sm font-bold text-red-400 mb-0.5">คุณแพ้ 😢</div>
                <div className="text-xs text-slate-300 mb-1">เสียใจด้วย! ลองใหม่อีกครั้ง</div>
                <div className="text-xs font-medium text-red-400">
                  เสีย: {formatThaiCurrency(trade.amount)}
                </div>
              </div>
            )}
          </div>
          
          <div className={countdownComplete ? 'hidden' : 'block'}>
            <div className="flex justify-between text-xs mb-1">
              <span>เหลือเวลา:</span>
              <span className="font-medium">{formatTime(timeLeft)}</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-700" />
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700">
            {countdownComplete ? 'ปิด' : 'รอในพื้นหลัง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StockTradingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const webSocket = useWebSocket();

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isCountdownOpen, setIsCountdownOpen] = useState<boolean>(false);
  const [currentTrade, setCurrentTrade] = useState<StockTrade | null>(null);
  const [activeTrade, setActiveTrade] = useState<StockTrade | null>(null);
  // เพิ่มตัวแปรควบคุมการกรองคริปโต หรือหุ้น
  const [assetFilter, setAssetFilter] = useState<string>("all"); // 'all', 'stock', 'crypto'
  
  // helper function to check if a stock is crypto
  const isCrypto = (stock: Stock) => stock.asset_type === 'crypto';

  // Query สำหรับดึงข้อมูลหุ้นทั้งหมด
  const stocksQuery = useQuery({
    queryKey: ['/api/stocks'],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Query สำหรับดึงข้อมูล trade ของผู้ใช้
  const tradesQuery = useQuery({
    queryKey: ['/api/stock-trades'],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Query สำหรับดึงข้อมูลบัญชีของผู้ใช้
  const accountQuery = useQuery({
    queryKey: ['/api/account'],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    gcTime: Infinity,
  });

  // Mutation สำหรับทำการเทรด
  const tradeMutation = useMutation({
    mutationFn: async (data: { stockId: number; direction: 'up' | 'down'; amount: number; duration: number; multiplier: number; startPrice: number; potentialPayout: number }) => {
      const response = await apiRequest('POST', '/api/stock-trades', data);
      const json = await response.json();
      return json as StockTrade;
    },
    onSuccess: (data) => {
      setCurrentTrade(data);
      setIsCountdownOpen(true);
      queryClient.invalidateQueries({ queryKey: ['/api/stock-trades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts/me'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถทำการเทรดได้ โปรดลองอีกครั้ง",
      });
    },
  });

  // Handle การเลือกหุ้น
  const handleSelectStock = (stock: Stock) => {
    setSelectedStock(stock);
    setIsDrawerOpen(true);
  };

  // Handle การทำเทรด
  const handleTrade = (data: { stockId: number; direction: 'up' | 'down'; amount: number; duration: number }) => {
    if (!selectedStock) return;
    
    const multiplier = data.duration === 300 ? 2.6 : 1.8;
    const potentialPayout = data.amount * multiplier;
    
    tradeMutation.mutate({
      ...data,
      multiplier,
      startPrice: selectedStock.currentPrice,
      potentialPayout
    });
  };

  // อัพเดทรายการเทรดที่กำลังทำอยู่
  useEffect(() => {
    if (tradesQuery.data && Array.isArray(tradesQuery.data)) {
      const activeTradeData = tradesQuery.data.find((trade: StockTrade) => trade.status === 'active');
      setActiveTrade(activeTradeData || null);
    }
  }, [tradesQuery.data]);

  // แสดงตอนโหลดข้อมูล
  if (stocksQuery.isLoading) {
    return (
      <div className="h-screen flex justify-center items-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-primary border-slate-300/30 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-sm text-white">กำลังโหลดข้อมูล...</div>
        </div>
      </div>
    );
  }

  // แสดงตอนเกิดข้อผิดพลาด
  if (stocksQuery.error) {
    return (
      <div className="h-screen flex justify-center items-center">
        <div className="text-center p-4">
          <div className="text-lg font-semibold text-red-400 mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
          <div className="text-sm text-white mb-4">{(stocksQuery.error as Error).message || "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้"}</div>
          <Button onClick={() => stocksQuery.refetch()}>ลองใหม่</Button>
        </div>
      </div>
    );
  }

  // ถอดข้อมูลจาก query result
  const stocks = Array.isArray(stocksQuery.data) ? stocksQuery.data : [];
  const trades = Array.isArray(tradesQuery.data) ? tradesQuery.data : [];
  
  // แก้ไขการอ่านค่าจาก API ให้ถูกต้อง
  console.log('Account query data:', accountQuery.data);
  
  let accountBalance = 0;
  if (accountQuery.data) {
    // ลองแสดงผลรูปแบบข้อมูลที่ได้รับเพื่อดู structure
    console.log('Account data type:', typeof accountQuery.data);
    
    if (typeof accountQuery.data === 'object') {
      if ('balance' in accountQuery.data) {
        const balanceValue = accountQuery.data.balance;
        console.log('Balance value:', balanceValue, 'type:', typeof balanceValue);
        
        if (typeof balanceValue === 'number') {
          accountBalance = balanceValue;
        } else if (typeof balanceValue === 'string') {
          accountBalance = parseFloat(balanceValue);
        }
      } else {
        // ถ้า key balance ไม่มี ให้ลอง log ดูว่ามี key อะไรบ้าง
        console.log('Available keys in account data:', Object.keys(accountQuery.data));
      }
    }
  } else {
    console.log('Account data is null or undefined');
  }
  
  const account = { balance: accountBalance };
  console.log('Final account balance:', accountBalance);

  // ฟิลเตอร์เฉพาะรายการเทรดที่กำลังทำอยู่
  const activeTrades = trades.filter((trade: StockTrade) => trade.status === 'active');
  
  // ฟิลเตอร์เฉพาะรายการเทรดที่เสร็จสิ้นแล้ว เรียงลำดับตามเวลาล่าสุด
  const completedTrades = trades
    .filter((trade: StockTrade) => trade.status !== 'active')
    .sort((a: StockTrade, b: StockTrade) => 
      new Date(b.endTime || b.startTime).getTime() - 
      new Date(a.endTime || a.startTime).getTime()
    );

  // Helper function to get stock data by ID
  const getStockById = (id: number) => {
    return stocks.find((s: Stock) => s.id === id) || null;
  };

  // Handle countdown completion
  const handleCountdownComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/stock-trades'] });
    queryClient.invalidateQueries({ queryKey: ['/api/accounts/me'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white">
      <WinnerTicker />
      
      <div className="container max-w-md mx-auto px-2 py-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">เทรดหุ้น</h1>
            <p className="text-xs text-slate-300">เลือกหุ้นที่ต้องการเทรด</p>
          </div>
          {account && (
            <div className="bg-slate-800/60 rounded-xl px-3 py-1.5 border border-slate-700/50 shadow">
              <div className="text-xs text-slate-300">ยอดเงิน</div>
              <div className="text-base font-bold text-white">
                {formatThaiCurrency(account.balance)}
              </div>
            </div>
          )}
        </div>
        
        {selectedStock && (
          <div className="mb-3">
            <StockChart stock={selectedStock} />
          </div>
        )}
        
        <Tabs defaultValue="stocks" className="mb-4">
          <TabsList className="grid grid-cols-4 bg-slate-800 border border-slate-700/50">
            <TabsTrigger value="stocks">หุ้น</TabsTrigger>
            <TabsTrigger value="crypto">คริปโต</TabsTrigger>
            <TabsTrigger value="active">กำลังเทรด</TabsTrigger>
            <TabsTrigger value="history">ประวัติ</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stocks" className="mt-2">
            <div className="grid grid-cols-1 gap-2">
              {/* แสดงแบนเนอร์สำหรับหุ้น */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-2 rounded-lg border border-primary/20 shadow-md mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-br from-primary to-blue-500 rounded-md shadow-[0_0_10px_rgba(0,120,255,0.3)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-white">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                        <polyline points="16 7 22 7 22 13"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-white font-bold">หุ้นเทรดดิ้ง</h2>
                      <p className="text-xs text-slate-300">พบหุ้นในระบบ {stocks.filter((stock: Stock) => !stock.asset_type || stock.asset_type === 'stock').length} รายการ</p>
                    </div>
                  </div>
                  <Badge className="bg-gradient-to-r from-primary to-blue-500 shadow-[0_0_10px_rgba(0,120,255,0.2)]">เรียลไทม์</Badge>
                </div>
              </div>
              
              {/* แสดงรายการหุ้น */}
              {stocks
                .filter((stock: Stock) => !stock.asset_type || stock.asset_type === 'stock')
                .map((stock: Stock) => (
                  <StockCard 
                    key={stock.id} 
                    stock={stock} 
                    onSelect={handleSelectStock} 
                  />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="crypto" className="mt-2">
            <div className="grid grid-cols-1 gap-2">
              {/* แสดงแบนเนอร์สำหรับคริปโต */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-2 rounded-lg border border-primary/20 shadow-md mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 rounded-md shadow-[0_0_10px_rgba(124,58,237,0.3)]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-white">
                        <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-white font-bold">คริปโตเคอเรนซี</h2>
                      <p className="text-xs text-slate-300">พบคริปโตในระบบ {stocks.filter((stock: Stock) => stock.asset_type === 'crypto').length} รายการ</p>
                    </div>
                  </div>
                  <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-[0_0_10px_rgba(124,58,237,0.2)]">เรียลไทม์</Badge>
                </div>
              </div>
              
              {/* แสดงรายการคริปโต */}
              {stocks
                .filter((stock: Stock) => stock.asset_type === 'crypto')
                .map((stock: Stock) => (
                  <StockCard 
                    key={stock.id} 
                    stock={stock} 
                    onSelect={handleSelectStock} 
                  />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="active" className="mt-2">
            {activeTrades.length > 0 ? (
              <div>
                {activeTrades.map((trade: StockTrade) => (
                  <ActiveTradeCard 
                    key={trade.id} 
                    trade={trade} 
                    stock={getStockById(trade.stockId)} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-base font-medium text-white mb-1">ไม่มีการเทรดที่กำลังทำอยู่</h3>
                <p className="text-sm text-slate-400">เลือกหุ้นในแท็บ "หุ้น" เพื่อเริ่มเทรด</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="mt-2">
            {completedTrades.length > 0 ? (
              <div>
                {completedTrades.map((trade: StockTrade) => (
                  <TradeHistoryCard 
                    key={trade.id} 
                    trade={trade} 
                    stock={getStockById(trade.stockId)} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-base font-medium text-white mb-1">ไม่มีประวัติการเทรด</h3>
                <p className="text-sm text-slate-400">เริ่มเทรดเพื่อดูประวัติของคุณที่นี่</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      <StockTradingDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        stock={selectedStock}
        onTrade={handleTrade}
      />
      
      <CountdownDialog 
        isOpen={isCountdownOpen}
        onClose={() => setIsCountdownOpen(false)}
        trade={currentTrade}
        stock={currentTrade ? getStockById(currentTrade.stockId) : null}
        onCountdownComplete={handleCountdownComplete}
      />
    </div>
  );
}