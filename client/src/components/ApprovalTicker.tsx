import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// สร้างข้อมูลจำลองสำหรับการแสดงผล (เฉพาะหลักหมื่นขึ้นไป 50,000 - 5,000,000 บาท)
const mockApprovals = [
  { id: 1, name: 'ธน**** พ.', amount: '550,000', timestamp: '1 นาทีที่แล้ว' },
  { id: 2, name: 'สม**** ส.', amount: '750,000', timestamp: '2 นาทีที่แล้ว' },
  { id: 3, name: 'วิ**** จ.', amount: '1,200,000', timestamp: '3 นาทีที่แล้ว' },
  { id: 4, name: 'ศ**** ก.', amount: '950,000', timestamp: '4 นาทีที่แล้ว' },
  { id: 5, name: 'ป**** ร.', amount: '3,500,000', timestamp: '5 นาทีที่แล้ว' },
  { id: 6, name: 'กั**** ม.', amount: '2,800,000', timestamp: '6 นาทีที่แล้ว' },
  { id: 7, name: 'สุ**** บ.', amount: '500,000', timestamp: '7 นาทีที่แล้ว' },
  { id: 8, name: 'ชา**** ว.', amount: '1,350,000', timestamp: '8 นาทีที่แล้ว' },
  { id: 9, name: 'อร**** น.', amount: '4,850,000', timestamp: '9 นาทีที่แล้ว' },
  { id: 10, name: 'พร**** ศ.', amount: '690,000', timestamp: '10 นาทีที่แล้ว' },
  // เพิ่มข้อมูลจำลองอีก 40 รายการ โดยสุ่มจากรายการด้านบน
  ...Array.from({ length: 40 }, (_, i) => ({
    id: i + 11,
    name: ['ธน**** พ.', 'สม**** ส.', 'วิ**** จ.', 'ศ**** ก.', 'ป**** ร.'][Math.floor(Math.random() * 5)],
    amount: ['550,000', '1,200,000', '3,500,000', '950,000', '2,800,000'][Math.floor(Math.random() * 5)],
    timestamp: `${Math.floor(Math.random() * 60)} นาทีที่แล้ว`
  }))
];

const ApprovalTicker = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mockApprovals.length);
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-2">การอนุมัติล่าสุด</h3>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#16a5a3] to-[#107e7c] rounded-full flex items-center justify-center text-white text-xs">
              {mockApprovals[currentIndex].name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{mockApprovals[currentIndex].name}</p>
              <p className="text-xs text-gray-500">{mockApprovals[currentIndex].timestamp}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#16a5a3]">฿{mockApprovals[currentIndex].amount}</p>
            <p className="text-xs text-green-600">อนุมัติแล้ว</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ApprovalTicker;