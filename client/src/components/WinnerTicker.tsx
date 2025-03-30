import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatThaiCurrency } from '@/lib/utils';

interface Winner {
  name: string;
  amount: number;
  stock: string;
}

// ข้อมูลตัวอย่าง
const mockWinners: Winner[] = [
  { name: 'คุณ กนกพร', amount: 8500, stock: 'AAPL' },
  { name: 'คุณ วิชัย', amount: 12300, stock: 'GOOGL' },
  { name: 'คุณ สมหมาย', amount: 5600, stock: 'TSLA' },
  { name: 'คุณ นภัส', amount: 9800, stock: 'META' },
  { name: 'คุณ สมชาย', amount: 15200, stock: 'MSFT' },
  { name: 'คุณ ปิยะ', amount: 7400, stock: 'AMZN' },
  { name: 'คุณ วิภา', amount: 11000, stock: 'AAPL' },
  { name: 'คุณ ณัฐพล', amount: 6300, stock: 'GOOGL' },
];

export default function WinnerTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % mockWinners.length);
    }, 3000); // เปลี่ยนทุกๆ 3 วินาที

    return () => clearInterval(interval);
  }, []);

  const currentWinner = mockWinners[currentIndex];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-green-900/50 to-slate-900 py-1.5 overflow-hidden border-b border-green-900/20">
      <div className="container max-w-md mx-auto px-2">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-1.5 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 font-medium">ผู้ชนะล่าสุด</span>
          </div>
          
          <div className="flex items-center text-xs overflow-hidden whitespace-nowrap">
            <span className="text-slate-300 mr-1.5">{currentWinner.name}</span>
            <span className="text-green-400 font-medium mr-1.5">ได้รับ {formatThaiCurrency(currentWinner.amount)}</span>
            <span className="text-slate-300">จาก {currentWinner.stock}</span>
            <ChevronRight className="h-3 w-3 text-green-500 ml-1.5" />
          </div>
        </div>
      </div>
    </div>
  );
}