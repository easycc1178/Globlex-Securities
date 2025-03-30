import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { InsertLoan, Loan } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, RefreshCw } from "lucide-react";
import BottomNavigation from "@/components/bottom-navigation";
import LoanSlider from "@/components/loan-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalChat } from "@/context/chat-context";

const loanFormSchema = z.object({
  amount: z.number().min(50000, "ยอดกู้ขั้นต่ำ 50,000 บาท").max(5000000, "ยอดกู้สูงสุด 5,000,000 บาท"),
  term: z.number().min(1, "ระยะเวลาขั้นต่ำ 1 เดือน").max(60, "ระยะเวลาสูงสุด 60 เดือน"),
  interestRate: z.number(),
  monthlyPayment: z.number(),
  fullName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล"),
  age: z.number().min(20, "อายุขั้นต่ำ 20 ปี"),
  phone: z.string().min(10, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง"),
  idCardNumber: z.string().min(13, "กรุณากรอกเลขบัตรประชาชน 13 หลัก").max(13),
  address: z.string().min(10, "กรุณากรอกที่อยู่"),
  occupation: z.string().min(2, "กรุณากรอกอาชีพ"),
  monthlyIncome: z.string().min(1, "กรุณากรอกรายได้"),
  remainingIncome: z.string().min(1, "กรุณากรอกรายได้คงเหลือ"),
  purpose: z.string().min(1, "กรุณาระบุจุดประสงค์การกู้"),
  frontIdCardImage: z.string().optional(),
  backIdCardImage: z.string().optional(),
  selfieWithIdCardImage: z.string().optional(),
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

export default function LoanPage() {
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasNewLoanUpdate, resetUpdateFlags } = useGlobalChat();
  const [loanAmount, setLoanAmount] = useState(50000); // ค่าเริ่มต้น 50,000 บาท
  const [loanTerm, setLoanTerm] = useState(12);
  const defaultInterestRate = 8.5; // อัตราดอกเบี้ยเริ่มต้น (%)

  // Get available loan info
  const { data: loanInfo, isLoading } = useQuery<{ interestRate: number, availableAmount: number }>({
    queryKey: ["/api/loans/available"],
    enabled: !!user,
  });
  
  // Get user's existing loans to show status with real-time updates
  const { data: existingLoans, refetch: refetchLoans } = useQuery<Loan[]>({
    queryKey: ["/api/loans"],
    enabled: !!user,
  });
  
  // Handle real-time loan updates from WebSocket
  useEffect(() => {
    if (hasNewLoanUpdate) {
      refetchLoans();
      toast({
        title: "การอัพเดตสถานะเงินกู้",
        description: "มีการเปลี่ยนแปลงสถานะคำขอสินเชื่อของคุณ",
        variant: "default",
      });
      resetUpdateFlags();
    }
  }, [hasNewLoanUpdate, refetchLoans, toast, resetUpdateFlags]);

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      amount: 50000, // ค่าเริ่มต้น 50,000 บาท
      term: 12,
      interestRate: 85,
      monthlyPayment: 4583,
      fullName: user?.fullName || "",
      age: undefined,
      phone: user?.phone || "",
      idCardNumber: user?.idCardNumber || "",
      address: user?.address || "",
      occupation: user?.occupation || "",
      monthlyIncome: "",
      remainingIncome: "",
      purpose: "",
      frontIdCardImage: "",
      backIdCardImage: "",
      selfieWithIdCardImage: "",
    },
  });
  
  // When loan amount or term changes, update form values
  const handleLoanChange = (amount: number, term: number) => {
    setLoanAmount(amount);
    setLoanTerm(term);
    form.setValue("amount", amount);
    form.setValue("term", term);

    // Update monthly payment
    const monthlyInterest = amount * (form.getValues("interestRate") / 10000);
    const principal = amount / term;
    const payment = Math.round(principal + monthlyInterest);
    form.setValue("monthlyPayment", payment);
  };

  // Submit loan application
  const submitLoanMutation = useMutation({
    mutationFn: async (data: InsertLoan) => {
      const res = await apiRequest("POST", "/api/loans", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "คำขอสินเชื่อถูกส่งเรียบร้อย",
        description: "เราจะทำการตรวจสอบและแจ้งผลให้ทราบเร็วๆ นี้",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoanFormValues) => {
    if (!user) return;

    // Convert monthly income and remaining income to number
    const monthlyIncome = parseInt(data.monthlyIncome.replace(/,/g, ""));
    const remainingIncome = parseInt(data.remainingIncome.replace(/,/g, ""));

    const loanData: InsertLoan = {
      userId: user.id,
      amount: data.amount,
      term: data.term,
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      purpose: data.purpose,
      // ข้อมูลส่วนตัว
      fullName: data.fullName,
      idCardNumber: data.idCardNumber,
      age: data.age,
      phone: data.phone,
      address: data.address, 
      occupation: data.occupation,
      income: monthlyIncome, // เปลี่ยนชื่อจาก monthlyIncome เป็น income ตาม schema ใหม่
      remainingIncome: remainingIncome,
      // รูปภาพ
      frontIdCardImage: data.frontIdCardImage,
      backIdCardImage: data.backIdCardImage,
      selfieWithIdCardImage: data.selfieWithIdCardImage,
    };

    submitLoanMutation.mutate(loanData);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 loan-page">
      <div className="gradient-bg text-white p-6 pb-12 rounded-b-3xl shadow-md">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 mr-4 hover:bg-white/30 transition-all shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold">ยื่นขอสินเชื่อ</h1>
        </div>
        <p className="text-white/80 text-sm mt-2 ml-14">กรอกข้อมูลเพื่อขอรับสินเชื่อกับเรา</p>
      </div>

      <div className="px-5 -mt-8">
        {existingLoans && existingLoans.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-5 animate-slide-up">
            <h3 className="text-lg font-semibold text-[var(--primary-color)] mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </span>
                สถานะเงินกู้ของคุณ
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 rounded-full" 
                onClick={() => refetchLoans()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </h3>
            
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {existingLoans.map((loan) => {
                const status = 
                  loan.status === 'approved' ? 'อนุมัติแล้ว' : 
                  loan.status === 'rejected' ? 'ปฏิเสธ' : 
                  loan.status === 'completed' ? 'เสร็จสมบูรณ์' : 'รอการอนุมัติ';
                
                const statusColor = 
                  loan.status === 'approved' ? 'bg-green-500 text-green-50' : 
                  loan.status === 'rejected' ? 'bg-red-500 text-red-50' : 
                  loan.status === 'completed' ? 'bg-blue-500 text-blue-50' : 'bg-yellow-500 text-yellow-50';
                
                const date = new Date(loan.createdAt).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
                
                return (
                  <div 
                    key={loan.id} 
                    className="bg-gray-50 border border-gray-100 rounded-lg p-4 relative overflow-hidden transition-all duration-300 hover:shadow-md"
                  >
                    <div className={`absolute left-0 top-0 h-full w-1.5 ${
                      loan.status === 'approved' ? 'bg-green-500' : 
                      loan.status === 'rejected' ? 'bg-red-500' : 
                      loan.status === 'completed' ? 'bg-blue-500' : 'bg-yellow-500'}`} 
                    />
                    
                    <div className="pl-1.5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-base font-medium">฿{loan.amount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">วันที่ยื่น: {date}</div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
                          {status}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">ระยะเวลา:</span> {loan.term} เดือน
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">ดอกเบี้ย:</span> {(loan.interestRate / 100).toFixed(2)}%
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">จ่ายต่อเดือน:</span> ฿{loan.monthlyPayment.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-5 animate-slide-up">
          <h3 className="text-lg font-semibold text-[var(--primary-color)] mb-4 flex items-center">
            <span className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                <circle cx="16" cy="16" r="4"/>
              </svg>
            </span>
            จำนวนเงินและระยะเวลา
          </h3>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-32 mx-auto" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <LoanSlider
              min={50000}
              max={5000000}
              step={10000}
              defaultValue={loanAmount}
              defaultTerm={loanTerm}
              interestRate={loanInfo?.interestRate || defaultInterestRate}
              onChange={handleLoanChange}
            />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 animate-slide-up">
          <h3 className="text-lg font-semibold text-[var(--primary-color)] mb-4 flex items-center">
            <span className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            ข้อมูลส่วนตัว
          </h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="idCardNumber"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      เลขบัตรประชาชน
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                        ชื่อ-นามสกุล
                      </FormLabel>
                      <FormControl>
                        <div className="pt-2">
                          <Input
                            {...field}
                            className="h-14 pt-4 border-gray-200 shadow-sm"
                            placeholder=" "
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                        อายุ
                      </FormLabel>
                      <FormControl>
                        <div className="pt-2">
                          <Input
                            {...field}
                            type="number"
                            className="h-14 pt-4 border-gray-200 shadow-sm"
                            placeholder=" "
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      เบอร์โทรศัพท์ติดต่อ
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      ที่อยู่
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      อาชีพ
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="monthlyIncome"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                        รายได้ต่อเดือน (บาท)
                      </FormLabel>
                      <FormControl>
                        <div className="pt-2">
                          <Input
                            {...field}
                            className="h-14 pt-4 border-gray-200 shadow-sm"
                            placeholder=" "
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remainingIncome"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                        รายได้คงเหลือ (บาท)
                      </FormLabel>
                      <FormControl>
                        <div className="pt-2">
                          <Input
                            {...field}
                            className="h-14 pt-4 border-gray-200 shadow-sm"
                            placeholder=" "
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="absolute left-3 top-2 text-xs text-gray-500 z-10">
                      จุดประสงค์การกู้
                    </FormLabel>
                    <FormControl>
                      <div className="pt-2">
                        <Input
                          {...field}
                          className="h-14 pt-4 border-gray-200 shadow-sm"
                          placeholder=" "
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 mt-8">
                <h4 className="text-md font-semibold text-[var(--primary-color)] flex items-center">
                  <span className="w-8 h-8 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 11.08V8l-6-6H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h6"/>
                      <path d="M14 3v5h5M18 21v-6M15 18h6"/>
                    </svg>
                  </span>
                  อัพโหลดเอกสาร
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="frontIdCardImage"
                    render={({ field }) => (
                      <FormItem>
                        <div className="border border-gray-200 border-dashed rounded-xl p-5 bg-gray-50/50 hover:bg-white hover:border-[var(--primary-color)]/30 transition-all duration-300">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center mr-4">
                              <Upload className="h-5 w-5 text-[var(--primary-color)]" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700 font-medium">รูปบัตรประชาชนด้านหน้า</p>
                              <p className="text-xs text-gray-500 mt-1">อัพโหลดไฟล์ JPG, PNG หรือ PDF</p>
                            </div>
                            <Input
                              type="file"
                              className="hidden"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  field.onChange(URL.createObjectURL(file));
                                }
                              }}
                              id="frontIdCardImage"
                            />
                            <label
                              htmlFor="frontIdCardImage"
                              className="px-4 py-2 rounded-full text-xs bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 transition-colors cursor-pointer"
                            >
                              เลือกไฟล์
                            </label>
                          </div>
                          {field.value && (
                            <div className="mt-2 text-sm text-green-600">
                              ✓ อัพโหลดไฟล์แล้ว
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="backIdCardImage"
                    render={({ field }) => (
                      <FormItem>
                        <div className="border border-gray-200 border-dashed rounded-xl p-5 bg-gray-50/50 hover:bg-white hover:border-[var(--primary-color)]/30 transition-all duration-300">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center mr-4">
                              <Upload className="h-5 w-5 text-[var(--primary-color)]" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700 font-medium">รูปบัตรประชาชนด้านหลัง</p>
                              <p className="text-xs text-gray-500 mt-1">อัพโหลดไฟล์ JPG, PNG หรือ PDF</p>
                            </div>
                            <Input
                              type="file"
                              className="hidden"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  field.onChange(URL.createObjectURL(file));
                                }
                              }}
                              id="backIdCardImage"
                            />
                            <label
                              htmlFor="backIdCardImage"
                              className="px-4 py-2 rounded-full text-xs bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 transition-colors cursor-pointer"
                            >
                              เลือกไฟล์
                            </label>
                          </div>
                          {field.value && (
                            <div className="mt-2 text-sm text-green-600">
                              ✓ อัพโหลดไฟล์แล้ว
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="selfieWithIdCardImage"
                    render={({ field }) => (
                      <FormItem>
                        <div className="border border-gray-200 border-dashed rounded-xl p-5 bg-gray-50/50 hover:bg-white hover:border-[var(--primary-color)]/30 transition-all duration-300">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 flex items-center justify-center mr-4">
                              <Upload className="h-5 w-5 text-[var(--primary-color)]" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700 font-medium">รูปคู่กับบัตรประชาชน</p>
                              <p className="text-xs text-gray-500 mt-1">อัพโหลดไฟล์ JPG, PNG หรือ PDF</p>
                            </div>
                            <Input
                              type="file"
                              className="hidden"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  field.onChange(URL.createObjectURL(file));
                                }
                              }}
                              id="selfieWithIdCardImage"
                            />
                            <label
                              htmlFor="selfieWithIdCardImage"
                              className="px-4 py-2 rounded-full text-xs bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 transition-colors cursor-pointer"
                            >
                              เลือกไฟล์
                            </label>
                          </div>
                          {field.value && (
                            <div className="mt-2 text-sm text-green-600">
                              ✓ อัพโหลดไฟล์แล้ว
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="pt-6">
                <Button
                  type="submit"
                  className="w-full py-6 bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] hover:shadow-lg text-white font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:translate-y-[-2px]"
                  disabled={submitLoanMutation.isPending}
                >
                  {submitLoanMutation.isPending ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      กำลังส่งข้อมูล...
                    </div>
                  ) : "ยืนยันการขอสินเชื่อ"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}