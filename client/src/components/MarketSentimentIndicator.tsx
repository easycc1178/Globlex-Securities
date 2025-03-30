import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle, 
  BarChart, 
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { BarChart2 } from 'lucide-react';

interface MarketSentimentIndicatorProps {
  sentimentScore: number; // -1.0 ถึง 1.0
  sentimentVolume: number; // ปริมาณข้อมูลที่ใช้คำนวณ sentiment
  sentimentTrend: string; // 'bullish', 'bearish', 'neutral', 'mixed'
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MarketSentimentIndicator({
  sentimentScore,
  sentimentVolume,
  sentimentTrend,
  showDetails = false,
  size = 'md',
  className,
}: MarketSentimentIndicatorProps) {
  // คำนวณสีตามคะแนน sentiment
  const getColor = () => {
    if (sentimentScore > 0.5) return 'text-green-500';
    if (sentimentScore > 0.2) return 'text-green-400';
    if (sentimentScore > 0) return 'text-green-300';
    if (sentimentScore === 0) return 'text-gray-400';
    if (sentimentScore > -0.2) return 'text-red-300';
    if (sentimentScore > -0.5) return 'text-red-400';
    return 'text-red-500';
  };

  // คำนวณไอคอนตาม trend
  const getTrendIcon = () => {
    switch (sentimentTrend) {
      case 'bullish':
        return <TrendingUp className={cn("mr-1", getColor())} />;
      case 'bearish':
        return <TrendingDown className={cn("mr-1", getColor())} />;
      case 'neutral':
        return <Minus className={cn("mr-1", getColor())} />;
      case 'mixed':
        return <AlertCircle className={cn("mr-1", getColor())} />;
      default:
        return <BarChart className={cn("mr-1", getColor())} />;
    }
  };

  // คำนวณคำอธิบาย sentiment
  const getSentimentLabel = () => {
    if (sentimentScore > 0.7) return 'เเข็งแกร่งมาก';
    if (sentimentScore > 0.3) return 'เป็นบวก';
    if (sentimentScore > 0.1) return 'ค่อนข้างบวก';
    if (sentimentScore < -0.7) return 'อ่อนแอมาก';
    if (sentimentScore < -0.3) return 'เป็นลบ';
    if (sentimentScore < -0.1) return 'ค่อนข้างลบ';
    return 'ปานกลาง';
  };

  // คำนวณคำอธิบาย volume
  const getVolumeLabel = () => {
    if (sentimentVolume > 1000) return 'ปริมาณมาก';
    if (sentimentVolume > 100) return 'ปริมาณปานกลาง';
    if (sentimentVolume > 10) return 'ปริมาณน้อย';
    return 'ปริมาณน้อยมาก';
  };

  // คำนวณคำอธิบาย trend
  const getTrendLabel = () => {
    switch (sentimentTrend) {
      case 'bullish': return 'กำลังขึ้น';
      case 'bearish': return 'กำลังลง';
      case 'neutral': return 'ทรงตัว';
      case 'mixed': return 'ผสม';
      default: return 'ไม่ชัดเจน';
    }
  };

  // scale score จาก -1,1 เป็น 0-100 สำหรับแสดงใน progress bar
  const progressValue = ((sentimentScore + 1) / 2) * 100;

  // กำหนดขนาดตาม prop
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col', className)}>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn('flex items-center', sizeClasses[size])}>
                {getTrendIcon()}
                <span className={cn('font-medium', getColor())}>
                  ความคิดเห็นตลาด: {getSentimentLabel()}
                </span>
                {!showDetails && (
                  <span className="text-gray-400 ml-1">
                    ({sentimentScore.toFixed(2)})
                  </span>
                )}
                <Activity className="ml-2 h-4 w-4 text-gray-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 p-1">
                <div className="flex items-center justify-between text-xs">
                  <span>ความคิดเห็น:</span>
                  <span className={getColor()}>{getSentimentLabel()} ({sentimentScore.toFixed(2)})</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>แนวโน้ม:</span>
                  <span>{getTrendLabel()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>ปริมาณข้อมูล:</span>
                  <span>{getVolumeLabel()} ({sentimentVolume})</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {showDetails && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500">ลบ</span>
              <Progress 
                value={progressValue} 
                className={cn(
                  "h-2 relative overflow-hidden rounded",
                  progressValue > 50 ? "bg-gray-200" : "bg-red-100"
                )}
              />
              <span className="text-xs text-green-500">บวก</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center">
                <BarChart2 className="h-3 w-3 mr-1" />
                <span>ปริมาณข้อมูล: {getVolumeLabel()} ({sentimentVolume})</span>
              </div>
              <div>
                แนวโน้ม: {getTrendLabel()}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}