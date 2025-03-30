import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loan, User } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { Check, Clock, ChevronRight, Banknote, MessageSquareText, User as UserIcon, RefreshCw, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import BottomNavigation from "@/components/bottom-navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SimpleImageSlider from "@/components/SimpleImageSlider";
import { useGlobalChat } from "@/context/chat-context";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { hasNewLoanUpdate, hasNewAccountUpdate, resetUpdateFlags } = useGlobalChat();

  // Get available loan amount
  const { data: loanInfo, isLoading: isLoanInfoLoading } = useQuery({
    queryKey: ["/api/loans/available"],
    enabled: !!user,
  });

  // Get loan history with real-time updates
  const { data: loans, isLoading: isLoansLoading, refetch: refetchLoans } = useQuery<Loan[]>({
    queryKey: ["/api/loans"],
    enabled: !!user,
  });
  
  // Get account info with real-time updates
  const { data: account } = useQuery({
    queryKey: ["/api/account"],
    enabled: !!user,
  });
  
  // Handle real-time updates
  useEffect(() => {
    if (hasNewLoanUpdate) {
      // Refresh loans data when there's a new loan update
      refetchLoans();
      toast({
        title: "การอัพเดตสถานะเงินกู้",
        description: "คำขอสินเชื่อของคุณมีการเปลี่ยนแปลงสถานะ",
        variant: "default",
      });
      resetUpdateFlags();
    }
  }, [hasNewLoanUpdate, refetchLoans, toast, resetUpdateFlags]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-light pb-20">
      {/* Header */}
      <div className="gradient-bg text-white p-6 pb-16 rounded-b-3xl shadow-lg">
        {/* Brand Logo */}
        <div className="flex justify-center mb-4 animate-fade-in">
          <div className="w-48 h-48 flex items-center justify-center animate-scale-up">
            <img src="/img/logo.png" alt="GLOBLEX SECURITIES Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        
        <div className="flex justify-between items-center animate-fade-in">
          <div>
            <h1 className="text-xl font-semibold hero-animation">
              สวัสดี, {user.fullName ? user.fullName.split(' ')[0] : user.username}
            </h1>
            <p className="text-sm opacity-80 hero-animation" style={{ animationDelay: "0.1s" }}>ยินดีต้อนรับกลับมา</p>
          </div>
          <Link href="/profile">
            <a className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-scale-up">
              <UserIcon className="w-5 h-5" />
            </a>
          </Link>
        </div>
      </div>

      {/* Image Slider */}
      <div className="px-4 -mt-10 mb-4 animate-slide-down" style={{ animationDelay: "0.2s" }}>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">ข่าวสารและโปรโมชั่น</h3>
          <div className="aspect-[16/9] relative">
            <SimpleImageSlider 
              images={[
                "/img/slides/slide1.webp",
                "/img/slides/slide2.webp",
                "/img/slides/slide3.jpg",
                "/img/slides/slide4.jpg",
                "/img/slides/slide5.jpg",
                "/img/slides/slide2.webp", // แทนที่ slide6.jpg ด้วยไฟล์ที่รู้ว่าทำงานได้
                "/img/slides/slide7.webp",
                "/img/slides/slide8.jpg"
              ]}
              autoSlideInterval={6000}
              className="h-52 sm:h-64 md:h-72"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 -mt-4">
        <Card className="rounded-xl shadow-lg animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-[#1a2942] mb-4 animate-slide-right">
              ดำเนินการต่อ
            </h3>

            <div 
              onClick={() => navigate("/loan")}
              className="w-full bg-[#16a5a3]/10 rounded-lg p-4 flex justify-between items-center mb-3 transition hover:bg-[#16a5a3]/20 cursor-pointer button-animation stagger-item animate-slide-right"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#16a5a3]/20 flex items-center justify-center text-[#16a5a3] mr-3 animate-wave">
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium">ยื่นกู้เงิน</h4>
                  <p className="text-sm text-gray-500">เริ่มกระบวนการยื่นกู้</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>

            <div
              className="w-full bg-[#e6b54a]/10 rounded-lg p-4 flex justify-between items-center mb-3 transition hover:bg-[#e6b54a]/20 cursor-pointer button-animation stagger-item animate-slide-right"
              style={{ animationDelay: "0.15s" }}
              onClick={() => navigate("/chat")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#e6b54a]/20 flex items-center justify-center text-[#e6b54a] mr-3 animate-wave">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium">ติดต่อเจ้าหน้าที่</h4>
                  <p className="text-sm text-gray-500">ปรึกษาเกี่ยวกับการกู้</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            
            <div
              className="w-full bg-[#4CAF50]/10 rounded-lg p-4 flex justify-between items-center transition hover:bg-[#4CAF50]/20 cursor-pointer button-animation stagger-item animate-slide-right"
              style={{ animationDelay: "0.3s" }}
              onClick={() => navigate("/stock-trading")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#4CAF50]/20 flex items-center justify-center text-[#4CAF50] mr-3 animate-wave">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium">เทรดหุ้นทันที</h4>
                  <p className="text-sm text-gray-500">ลงทุนในตลาดหุ้นแบบเรียลไทม์</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="rounded-xl shadow-lg mt-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-[#1a2942] mb-4 animate-slide-right" style={{ animationDelay: "0.6s" }}>
              ประวัติการทำรายการ
            </h3>

            {isLoansLoading ? (
              // Loading skeleton
              <div className="space-y-4 animate-pulse-effect">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center py-3 border-b">
                    <Skeleton className="w-10 h-10 rounded-full mr-3" />
                    <div className="flex-grow">
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-5 w-16 mb-1" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loans && loans.length > 0 ? (
              <div className="space-y-4">
                {loans.map((loan, index) => (
                  <div
                    key={loan.id}
                    className="flex items-center py-3 border-b last:border-0 animate-slide-right stagger-item"
                    style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 ${
                        loan.status === "approved"
                          ? "text-[#2ecc71] animate-pulse-effect"
                          : loan.status === "rejected"
                          ? "text-[#e74c3c]"
                          : "text-[#f39c12] animate-wave"
                      }`}
                    >
                      {loan.status === "approved" ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-medium">
                        {loan.status === "approved"
                          ? "ได้รับการอนุมัติเงินกู้"
                          : loan.status === "rejected"
                          ? "คำขอถูกปฏิเสธ"
                          : "ยื่นขอสินเชื่อ"}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {format(
                          new Date(loan.createdAt),
                          "d MMM yyyy",
                          { locale: th }
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-medium ${
                          loan.status === "approved"
                            ? "text-[#2ecc71]"
                            : loan.status === "rejected"
                            ? "text-[#e74c3c]"
                            : "text-[#f39c12]"
                        }`}
                      >
                        {loan.status === "approved" ? (
                          `฿${loan.amount.toLocaleString()}`
                        ) : loan.status === "rejected" ? (
                          "ไม่อนุมัติ"
                        ) : (
                          "รอดำเนินการ"
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {loan.status === "approved"
                          ? "เสร็จสิ้น"
                          : loan.status === "rejected"
                          ? "ถูกปฏิเสธ"
                          : "กำลังตรวจสอบ"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 animate-fade-in">
                <p>ยังไม่มีประวัติการทำรายการ</p>
                <Button
                  variant="link"
                  className="text-[#16a5a3] mt-2 button-animation animate-scale-up"
                  style={{ animationDelay: "0.3s" }}
                  onClick={() => navigate("/loan")}
                >
                  เริ่มยื่นกู้เงินตอนนี้
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loan Info Section */}
      <div className="px-4 mt-6 mb-4">
        <Card className="rounded-xl shadow-lg animate-slide-up" style={{ animationDelay: "0.7s" }}>
          <CardContent className="p-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[#1a2942] mb-2 animate-slide-right">
                วงเงินที่สามารถกู้ได้
              </h3>
              <span className="text-xs px-2 py-1 bg-[#2ecc71]/20 rounded-full text-[#2ecc71] animate-pulse-effect">
                พร้อมกู้
              </span>
            </div>
            
            {isLoanInfoLoading ? (
              <Skeleton className="h-8 w-32 bg-gray-200 my-2" />
            ) : (
              <h2 className="text-2xl font-bold my-2 text-[#16a5a3] animate-scale-up" style={{ animationDelay: "0.2s" }}>
                ฿{(loanInfo as any)?.availableAmount?.toLocaleString() || "50,000"}
              </h2>
            )}
            
            <div className="flex items-center text-xs mt-1 text-gray-600 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                อัตราดอกเบี้ย{" "}
                {loanInfo ? ((loanInfo as any).interestRate / 100).toFixed(2) : "0.85"}%
                ต่อเดือน
              </span>
            </div>
            
            <Button
              variant="default"
              className="w-full mt-4 bg-[#16a5a3] hover:bg-[#16a5a3]/90"
              onClick={() => navigate("/loan")}
            >
              ยื่นขอสินเชื่อเลย
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Copyright Section */}
      <div className="px-4 pb-24 text-center">
        <p className="text-xs text-gray-500 mt-2">
          &copy; {new Date().getFullYear()} GLOBLEX SECURITIES. สงวนลิขสิทธิ์ทั้งหมด
        </p>
      </div>

      <BottomNavigation />
    </div>
  );
}