import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface LoanSliderProps {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  defaultTerm?: number;
  interestRate: number;
  onChange?: (value: number, term: number) => void;
}

export default function LoanSlider({
  min,
  max,
  step,
  defaultValue,
  defaultTerm = 12,
  interestRate,
  onChange,
}: LoanSliderProps) {
  const [amount, setAmount] = useState(defaultValue);
  const [term, setTerm] = useState(defaultTerm);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

  // Sync with props when they change
  useEffect(() => {
    setAmount(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    setTerm(defaultTerm);
  }, [defaultTerm]);

  // Calculate monthly payment when amount, interest rate or term changes
  useEffect(() => {
    const monthlyInterest = amount * (interestRate / 10000);
    const principal = amount / term;
    const payment = Math.round(principal + monthlyInterest);
    setMonthlyPayment(payment);
  }, [amount, interestRate, term]);

  const handleAmountChange = (values: number[]) => {
    const newAmount = Math.max(min, Math.min(max, values[0]));
    setAmount(newAmount);
    onChange?.(newAmount, term);
  };

  const handleTermChange = (values: number[]) => {
    const newTerm = values[0];
    setTerm(newTerm);
    onChange?.(amount, newTerm);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-4xl font-bold text-[var(--primary-color)] mb-2">
          ฿{amount.toLocaleString()}
        </div>
        <p className="text-xs text-gray-500 mb-4">เลือกจำนวนเงินที่ต้องการกู้</p>

        <div className="space-y-4">
          <div className="px-2">
            <Slider
              value={[amount]}
              min={min}
              max={max}
              step={step}
              onValueChange={handleAmountChange}
              className="cursor-pointer"
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>฿{min.toLocaleString()}</span>
            <span>฿{max.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-700 mb-2">ระยะเวลาผ่อนชำระ</p>
        <div className="text-2xl font-bold text-[var(--primary-color)] mb-2">
          {term} เดือน
        </div>

        <div className="space-y-4">
          <div className="px-2">
            <Slider
              value={[term]}
              min={1}
              max={60}
              step={1}
              onValueChange={handleTermChange}
              className="cursor-pointer"
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>1 เดือน</span>
            <span>60 เดือน</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-5 space-y-3 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">อัตราดอกเบี้ย:</span>
          <span className="font-medium bg-gray-100 px-3 py-1 rounded-full text-sm">
            {(interestRate / 100).toFixed(2)}% ต่อเดือน
          </span>
        </div>
        <div className="border-t border-gray-100 pt-3"></div>
        <div className="flex justify-between items-center">
          <span className="text-gray-700 font-medium">ชำระรายเดือน:</span>
          <span className="font-bold text-[var(--primary-color)] text-lg">
            ฿{monthlyPayment.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}