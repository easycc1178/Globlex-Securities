import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatThaiCurrency, formatDate } from "@/lib/utils";
import { Account, Loan, Withdrawal } from "@shared/schema";
import { 
  ArrowLeft, 
  User, 
  Edit, 
  Lock, 
  Bell, 
  Shield, 
  UserCog, 
  LogOut,
  CalendarClock,
  CreditCard,
  BanknoteIcon,
  ClockIcon,
  Plus,
  Wallet,
  ArrowUpFromLine,
  ArrowDownToLine,
  History,
  Eye
} from "lucide-react";
import BottomNavigation from "@/components/bottom-navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// เพิ่ม userId และเนื่องจากเราไม่แก้ไข email จึงทำเป็น optional
const profileSchema = z.object({
  fullName: z.string().min(3, "กรุณากรอกชื่อ-นามสกุล"),
  phone: z.string().min(10, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง"),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
});

// สร้าง Schema สำหรับการเปลี่ยนรหัสผ่าน
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  newPassword: z.string().min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"),
  confirmPassword: z.string().min(8, "การยืนยันรหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

// สร้าง Schema สำหรับการตั้งค่าการแจ้งเตือน
const notificationsSchema = z.object({
  loanUpdates: z.boolean().default(true),
  withdrawalUpdates: z.boolean().default(true),
  marketingUpdates: z.boolean().default(false),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(true),
});

// สร้าง Schema สำหรับการตั้งค่าความเป็นส่วนตัว
const privacySchema = z.object({
  showLoanHistory: z.boolean().default(true),
  showWithdrawalHistory: z.boolean().default(true),
  allowDataCollection: z.boolean().default(true),
  allowThirdPartySharing: z.boolean().default(false),
});

// Schema สำหรับฟอร์มฝากเงิน
const depositFormSchema = z.object({
  fullName: z.string().min(3, "กรุณาระบุชื่อ-นามสกุล"),
  accountNumber: z.string()
    .min(10, "เลขบัญชีต้องมีอย่างน้อย 10 ตัว")
    .max(15, "เลขบัญชีต้องไม่เกิน 15 ตัว")
    .regex(/^\d+$/, "เลขบัญชีต้องเป็นตัวเลขเท่านั้น"),
  bankName: z.string().min(1, "กรุณาเลือกธนาคาร"),
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุจำนวนเงิน" })
      .positive("จำนวนเงินต้องเป็นตัวเลขบวก")
      .min(100, "จำนวนเงินขั้นต่ำคือ 100 บาท")
  ),
  slipImage: z.instanceof(File, {
    message: "กรุณาอัพโหลดสลิปการโอนเงิน",
  }).optional(),
});

type DepositFormValues = z.infer<typeof depositFormSchema>;

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [viewLoanDetails, setViewLoanDetails] = useState<Loan | null>(null);
  const [viewWithdrawalDetails, setViewWithdrawalDetails] = useState<Withdrawal | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);

  // ดึงข้อมูลเงินกู้ทั้งหมดของผู้ใช้
  const { data: loans, isLoading: isLoansLoading } = useQuery<Loan[]>({
    queryKey: ["/api/loans"],
    enabled: !!user,
  });

  // ดึงข้อมูลการถอนเงินทั้งหมดของผู้ใช้
  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/withdrawals"],
    enabled: !!user,
  });
  
  // ดึงข้อมูลการฝากเงินทั้งหมดของผู้ใช้
  const { data: deposits, isLoading: isDepositsLoading } = useQuery<any[]>({
    queryKey: ["/api/deposits"],
    enabled: !!user,
  });
  
  // ดึงข้อมูลบัญชีของผู้ใช้
  const { data: account, isLoading: isAccountLoading, refetch: refetchAccount } = useQuery<Account>({
    queryKey: ["/api/account"],
    enabled: !!user,
  });
  
  // State สำหรับเก็บรูปภาพที่อัปโหลด
  const [slipImagePreview, setSlipImagePreview] = useState<string | null>(null);
  
  // ฟังก์ชันจัดการการอัปโหลดรูปภาพ
  const handleSlipImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      depositForm.setValue("slipImage", file);
      
      // สร้าง URL สำหรับแสดงตัวอย่างรูปภาพ
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // ฟอร์มสำหรับการฝากเงิน
  const depositForm = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      accountNumber: "",
      bankName: "",
      amount: undefined,
    },
  });
  
  // Mutation สำหรับการฝากเงิน
  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormValues) => {
      const res = await apiRequest("POST", "/api/deposit", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ฝากเงินสำเร็จ",
        description: "เงินได้ถูกเพิ่มเข้าในบัญชีของคุณเรียบร้อยแล้ว",
      });
      depositForm.reset();
      setDepositDialogOpen(false);
      refetchAccount();
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถฝากเงินได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    },
  });
  
  // ฟังก์ชันจัดการการส่งฟอร์มฝากเงิน
  const onDepositSubmit = (values: DepositFormValues) => {
    if (!user) return;
    
    // สร้าง FormData สำหรับอัปโหลดรูปภาพ
    if (values.slipImage) {
      const formData = new FormData();
      formData.append('fullName', values.fullName);
      formData.append('accountNumber', values.accountNumber);
      formData.append('bankName', values.bankName);
      formData.append('amount', String(values.amount));
      formData.append('slipImage', values.slipImage);
      
      // ส่ง FormData ไปยัง API
      fetch('/api/deposit', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })
      .then(res => {
        if (!res.ok) throw new Error('ไม่สามารถฝากเงินได้');
        return res.json();
      })
      .then(() => {
        toast({
          title: "ส่งคำขอฝากเงินสำเร็จ",
          description: "คำขอฝากเงินของคุณกำลังรอการอนุมัติจากแอดมิน",
        });
        depositForm.reset();
        setDepositDialogOpen(false);
        refetchAccount();
        queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      })
      .catch(error => {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: error.message || "ไม่สามารถฝากเงินได้ กรุณาลองใหม่อีกครั้ง",
          variant: "destructive",
        });
      });
    } else {
      toast({
        title: "กรุณาอัปโหลดสลิป",
        description: "กรุณาอัปโหลดสลิปการโอนเงินเพื่อยืนยันการฝากเงิน",
        variant: "destructive",
      });
    }
  };

  // Get membership date
  const memberSince = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long'
      })
    : 'มิถุนายน 2023';
    
  // แสดงสถานะของการกู้ในภาษาไทย
  const getLoanStatusText = (status: string) => {
    switch (status) {
      case "pending": return "รอดำเนินการ";
      case "approved": return "อนุมัติแล้ว";
      case "rejected": return "ปฏิเสธ";
      case "completed": return "ชำระแล้ว";
      default: return status;
    }
  };
  
  // แสดงสถานะของการถอนเงินในภาษาไทย
  const getWithdrawalStatusText = (status: string) => {
    switch (status) {
      case "pending": return "รอดำเนินการ";
      case "approved": return "อนุมัติแล้ว";
      case "rejected": return "ปฏิเสธ";
      default: return status;
    }
  };
  
  // คำนวณยอดชำระรายเดือน
  const calculateMonthlyPayment = (amount: number, term: number, interestRate: number) => {
    const monthlyInterest = interestRate / 100 / 12;
    return (amount * monthlyInterest * Math.pow(1 + monthlyInterest, term)) / 
           (Math.pow(1 + monthlyInterest, term) - 1);
  };

  // Form for profile editing
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      birthDate: user?.birthDate || "",
      address: user?.address || "",
      occupation: user?.occupation || "",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema> & { userId?: number }) => {
      try {
        console.log("Submitting profile update:", data);
        
        // ตรวจสอบว่ามี userId หรือไม่
        if (!data.userId) {
          throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        }
        
        // เพิ่ม logging ให้มากขึ้น
        console.log(`Sending request to /api/admin/users/${data.userId} with data:`, JSON.stringify({
          fullName: data.fullName,
          phone: data.phone,
          address: data.address,
          occupation: data.occupation,
          birthDate: data.birthDate,
        }));
        
        // ใช้ API ของแอดมินซึ่งมีความยืดหยุ่นมากกว่า
        const updatedProfile = await apiRequest(
          "PATCH", 
          `/api/admin/users/${data.userId}`, 
          {
            fullName: data.fullName,
            phone: data.phone,
            address: data.address,
            occupation: data.occupation,
            birthDate: data.birthDate,
          }
        );
        
        // แสดงผลลัพธ์
        const result = await updatedProfile.json();
        console.log("Profile updated successfully:", result);
        return result;
      } catch (error) {
        console.error("Profile update error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Profile updated successfully:", data);
      toast({
        title: "อัพเดทโปรไฟล์สำเร็จ",
        description: "ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว",
      });
      
      // อัพเดตข้อมูลผู้ใช้ในระบบทั้ง user และ profile endpoints
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถอัพเดทโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
      console.error("Profile update error:", error);
    },
  });

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    console.log("Form submitted with data:", data);
    // เพิ่ม userId เข้าไปในข้อมูลที่ส่งไป เพื่อแก้ปัญหากรณีที่ session ไม่ทำงาน
    updateProfileMutation.mutate({
      ...data,
      userId: user?.id // เพิ่ม userId เข้าไปด้วย
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        navigate("/auth");
      },
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-light pb-20">
      <div className="gradient-bg text-white p-6 pb-16">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 mr-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-semibold">โปรไฟล์</h1>
        </div>

        <div className="flex flex-col items-center mt-6">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            <User className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-semibold mt-3">{user.fullName}</h2>
          <p className="text-sm opacity-80">สมาชิกตั้งแต่: {memberSince}</p>
        </div>
      </div>

      <div className="px-4 -mt-10">
        {/* บัญชีและยอดเงิน */}
        <Card className="rounded-xl shadow-lg animate-slide-up mb-4">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-[#1a2942] mb-4">บัญชีของฉัน</h3>
            <p className="text-sm text-gray-500 mb-2">ข้อมูลบัญชีและยอดเงินของคุณ</p>
            
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm text-gray-500">ยอดเงินในบัญชี</p>
              <p className="text-2xl font-bold text-[#1a2942] mt-1">
                {account ? formatThaiCurrency(account.balance) : "฿0.00"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                อัพเดทล่าสุด: {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                className="flex-1 bg-[#16a5a3] hover:bg-[#138280] text-white"
                onClick={() => navigate("/deposit")}
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" /> ฝากเงิน
              </Button>
              <Button 
                variant="outline"
                className="flex-1 border-[#16a5a3] text-[#16a5a3] hover:bg-[#16a5a3]/10"
                onClick={() => navigate("/withdrawal")}
              >
                <ArrowUpFromLine className="h-4 w-4 mr-2" /> ถอนเงิน
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* ข้อมูลส่วนตัว */}
        <Card className="rounded-xl shadow-lg animate-slide-up">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-[#1a2942] mb-4">ข้อมูลส่วนตัว</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">ชื่อผู้ใช้</p>
                <p className="font-medium">{user.username}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">อีเมล</p>
                <p className="font-medium">{user.email}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">เบอร์โทรศัพท์</p>
                <p className="font-medium">{user.phone}</p>
              </div>

              {user.birthDate && (
                <div>
                  <p className="text-sm text-gray-500">วันเกิด</p>
                  <p className="font-medium">{user.birthDate}</p>
                </div>
              )}

              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="link" className="text-[#16a5a3] font-medium mt-2 p-0 flex items-center h-auto">
                    <Edit className="mr-2 h-4 w-4" /> แก้ไขข้อมูลส่วนตัว
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>แก้ไขข้อมูลส่วนตัว</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ชื่อ-นามสกุล</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>เบอร์โทรศัพท์</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="birthDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>วันเกิด (วว/ดด/ปปปป)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ที่อยู่</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="occupation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>อาชีพ</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setEditDialogOpen(false)}
                        >
                          ยกเลิก
                        </Button>
                        <Button 
                          type="submit"
                          disabled={updateProfileMutation.isPending}
                        >
                          บันทึก
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>



        {/* ประวัติธุรกรรมทั้งหมด */}
        <Card className="rounded-xl shadow-lg mt-4 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-lg text-[#1a2942] flex items-center">
              <History className="h-5 w-5 mr-2 text-[#16a5a3]" /> 
              ประวัติธุรกรรม
            </CardTitle>
            <CardDescription>
              ประวัติการทำธุรกรรมทั้งหมดของคุณ
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <Accordion type="single" collapsible className="w-full">
              {/* ประวัติการฝากเงิน */}
              <AccordionItem value="deposits">
                <AccordionTrigger className="text-base font-medium">
                  <div className="flex items-center">
                    <ArrowDownToLine className="h-4 w-4 mr-2 text-green-600" /> 
                    ประวัติการฝากเงิน
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {isDepositsLoading && (
                    <div className="text-center py-4">
                      <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                    </div>
                  )}
                  
                  {!isDepositsLoading && (!deposits || deposits.length === 0) && (
                    <div className="text-center py-4">
                      <p className="text-gray-500">ไม่พบข้อมูลการฝากเงิน</p>
                    </div>
                  )}
                  
                  {!isDepositsLoading && deposits && deposits.length > 0 && (
                    <div className="space-y-3">
                      {deposits.map((deposit) => (
                        <div 
                          key={deposit.id} 
                          className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{formatThaiCurrency(deposit.amount)}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(deposit.createdAt).toLocaleDateString('th-TH')}
                              </div>
                            </div>
                            <div>
                              <Badge className={
                                deposit.status === "approved" ? "bg-green-100 text-green-800 hover:bg-green-200" :
                                deposit.status === "rejected" ? "bg-red-100 text-red-800 hover:bg-red-200" :
                                "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                              }>
                                {getWithdrawalStatusText(deposit.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              
              {/* ประวัติการถอนเงิน */}
              <AccordionItem value="withdrawals">
                <AccordionTrigger className="text-base font-medium">
                  <div className="flex items-center">
                    <ArrowUpFromLine className="h-4 w-4 mr-2 text-red-600" /> 
                    ประวัติการถอนเงิน
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {isWithdrawalsLoading && (
                    <div className="text-center py-4">
                      <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
                    </div>
                  )}
                  
                  {!isWithdrawalsLoading && (!withdrawals || withdrawals.length === 0) && (
                    <div className="text-center py-4">
                      <p className="text-gray-500">ไม่พบข้อมูลการถอนเงิน</p>
                    </div>
                  )}
                  
                  {!isWithdrawalsLoading && withdrawals && withdrawals.length > 0 && (
                    <div className="space-y-3">
                      {withdrawals.map((withdrawal) => (
                        <div 
                          key={withdrawal.id} 
                          className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => setViewWithdrawalDetails(withdrawal)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{formatThaiCurrency(withdrawal.amount)}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                ไปยัง: {withdrawal.bankName} {withdrawal.accountNumber}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(withdrawal.createdAt).toLocaleDateString('th-TH')}
                              </div>
                            </div>
                            <div>
                              <Badge className={
                                withdrawal.status === "approved" ? "bg-green-100 text-green-800 hover:bg-green-200" :
                                withdrawal.status === "rejected" ? "bg-red-100 text-red-800 hover:bg-red-200" :
                                "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                              }>
                                {getWithdrawalStatusText(withdrawal.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* ส่วนแสดงประวัติการกู้เงิน */}
        <Card className="rounded-xl shadow-lg mt-4 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-lg text-[#1a2942] flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-[#16a5a3]" /> 
              ประวัติการกู้เงิน
            </CardTitle>
            <CardDescription>
              ข้อมูลการกู้เงินของคุณทั้งหมด
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            {isLoansLoading && (
              <div className="text-center py-8">
                <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
              </div>
            )}
            
            {!isLoansLoading && (!loans || loans.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500">ไม่พบข้อมูลการกู้เงิน</p>
              </div>
            )}
            
            {!isLoansLoading && loans && loans.length > 0 && (
              <div className="space-y-3">
                {loans.map((loan) => (
                  <div 
                    key={loan.id} 
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setViewLoanDetails(loan)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{formatThaiCurrency(loan.amount)}</div>
                        <div className="text-sm text-gray-500">
                          ระยะเวลา {loan.term} เดือน • {new Date(loan.createdAt).toLocaleDateString('th-TH')}
                        </div>
                      </div>
                      <div>
                        <Badge className={
                          loan.status === "approved" ? "bg-green-100 text-green-800 hover:bg-green-200" :
                          loan.status === "rejected" ? "bg-red-100 text-red-800 hover:bg-red-200" :
                          loan.status === "completed" ? "bg-blue-100 text-blue-800 hover:bg-blue-200" :
                          "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        }>
                          {getLoanStatusText(loan.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              variant="link" 
              className="text-[#16a5a3] p-0 h-auto"
              onClick={() => navigate("/loan")}
            >
              ขอสินเชื่อเพิ่มเติม
            </Button>
          </CardFooter>
        </Card>



        {/* ส่วนบัญชีและความปลอดภัย */}
        <Card className="rounded-xl shadow-lg mt-4 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-lg text-[#1a2942]">
              บัญชีและความปลอดภัย
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 px-5 pb-5">
            <div className="space-y-3">
              <Button 
                variant="ghost" 
                className="w-full flex justify-between items-center py-2 h-auto"
                onClick={() => setChangePasswordOpen(true)}
              >
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 mr-3">
                    <Lock className="h-4 w-4" />
                  </div>
                  <span>เปลี่ยนรหัสผ่าน</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>

              <Button 
                variant="ghost" 
                className="w-full flex justify-between items-center py-2 h-auto"
                onClick={() => setNotificationsOpen(true)}
              >
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 mr-3">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span>การแจ้งเตือน</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>

              <Button 
                variant="ghost" 
                className="w-full flex justify-between items-center py-2 h-auto"
                onClick={() => setPrivacyOpen(true)}
              >
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 mr-3">
                    <Shield className="h-4 w-4" />
                  </div>
                  <span>ความเป็นส่วนตัว</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 animate-slide-up">
          {user.isAdmin && (
            <Button 
              variant="outline"
              className="w-full bg-white rounded-lg p-4 flex justify-between items-center shadow-md mb-3 h-auto"
              onClick={() => navigate("/admin")}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#1a2942]/20 flex items-center justify-center text-[#1a2942] mr-3">
                  <UserCog className="h-5 w-5" />
                </div>
                <span>เข้าสู่หน้าแอดมิน</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full bg-white rounded-lg p-4 flex justify-between items-center shadow-md text-[#e74c3c] h-auto"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-[#e74c3c]/20 flex items-center justify-center text-[#e74c3c] mr-3">
                <LogOut className="h-5 w-5" />
              </div>
              <span>{logoutMutation.isPending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Button>
        </div>
      </div>

      <BottomNavigation />
      
      {/* ไดอะล็อกฝากเงิน */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="sm:max-w-[425px] px-0 pb-0 overflow-hidden bg-[#333333] text-white relative">
          <button className="absolute right-2 top-2 rounded-full text-gray-400 hover:text-white" onClick={() => setDepositDialogOpen(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base mb-6">จำนวนเงิน (บาท)</h3>
            <FormField
              control={depositForm.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="number" 
                      placeholder="ระบุจำนวนเงิน"
                      value={field.value || ""}
                      className="bg-[#333333] border-gray-600 h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="mt-4 space-y-3 px-6">
            <h3 className="text-base mb-2">ข้อมูลธนาคารสำหรับการโอนเงิน</h3>
            
            {/* QR Code สำหรับการโอนเงิน */}
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-lg">
                <svg 
                  width="150" 
                  height="150" 
                  viewBox="0 0 150 150" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto"
                >
                  <rect width="150" height="150" fill="white"/>
                  <path d="M10 10H30V30H10V10ZM35 10H40V15H35V10ZM45 10H50V15H45V10ZM60 10H65V15H60V10ZM75 10H80V15H75V10ZM85 10H95V15H85V10ZM100 10H105V15H100V10ZM110 10H130V30H110V10ZM10 35H15V45H10V35ZM25 35H30V45H25V35ZM35 35H40V40H35V35ZM45 35H55V40H45V35ZM60 35H65V40H60V35ZM75 35H85V40H75V35ZM100 35H105V40H100V35ZM110 35H115V45H110V35ZM125 35H130V45H125V35ZM10 50H15V55H10V50ZM25 50H30V55H25V50ZM35 50H45V55H35V50ZM55 50H65V55H55V50ZM80 50H85V55H80V50ZM95 50H105V55H95V50ZM110 50H115V55H110V50ZM125 50H130V55H125V50ZM10 60H15V65H10V60ZM25 60H30V65H25V60ZM35 60H40V65H35V60ZM55 60H70V65H55V60ZM75 60H80V65H75V60ZM90 60H95V65H90V60ZM110 60H115V65H110V60ZM125 60H130V65H125V60ZM10 70H15V75H10V70ZM25 70H30V75H25V70ZM40 70H45V75H40V70ZM55 70H60V75H55V70ZM70 70H75V75H70V70ZM95 70H100V75H95V70ZM110 70H115V75H110V70ZM125 70H130V75H125V70ZM10 80H30V100H10V80ZM35 80H50V85H35V80ZM60 80H70V85H60V80ZM80 80H85V85H80V80ZM110 80H130V100H110V80ZM35 90H40V95H35V90ZM50 90H55V95H50V90ZM75 90H85V95H75V90ZM35 100H40V105H35V100ZM50 100H55V105H50V100ZM60 100H65V105H60V100ZM75 100H80V105H75V100ZM90 100H95V105H90V100ZM100 100H105V105H100V100ZM35 110H40V115H35V110ZM45 110H70V115H45V110ZM75 110H85V115H75V110ZM90 110H95V115H90V110ZM100 110H105V115H100V110ZM10 110H30V130H10V110ZM60 120H65V125H60V120ZM75 120H80V125H75V120ZM90 120H95V125H90V120ZM100 120H105V125H100V120ZM110 120H115V125H110V120ZM125 120H130V125H125V120ZM35 130H40V135H35V130ZM45 130H50V135H45V130ZM55 130H60V135H55V130ZM75 130H80V135H75V130ZM90 130H95V135H90V130ZM100 130H105V135H100V130ZM110 130H115V135H110V130ZM125 130H130V135H125V130ZM75 140H80V145H75V140ZM85 140H95V145H85V140ZM110 140H130V145H110V140Z" fill="black"/>
                </svg>
                <p className="text-black text-center text-xs mt-2">สแกนเพื่อโอนเงิน</p>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">ชื่อบัญชี</span>
                <span className="font-medium">บริษัท ไทยฟินเทค จำกัด</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">เลขบัญชี</span>
                <span className="font-medium">123-4-56789-0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ธนาคาร</span>
                <span className="font-medium">กสิกรไทย</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ประเภทบัญชี</span>
                <span className="font-medium">ออมทรัพย์</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 px-6 pb-28 mt-6">
            <h3 className="text-base mb-1">ข้อมูลของคุณ</h3>
            
            <Form {...depositForm}>
              <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-3">
                <FormField
                  control={depositForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-400">ชื่อ-นามสกุล (ผู้โอน)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="ระบุชื่อผู้โอน" 
                          className="bg-[#333333] border-gray-600"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={depositForm.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-400">เลขบัญชีของคุณ</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="เลขบัญชีธนาคารของคุณ" 
                          className="bg-[#333333] border-gray-600"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={depositForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-400">ธนาคารของคุณ</FormLabel>
                      <FormControl>
                        <select 
                          {...field}
                          className="flex h-10 w-full rounded-md border border-gray-600 bg-[#333333] px-3 py-2 text-sm text-white ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">เลือกธนาคาร</option>
                          <option value="กสิกรไทย">ธนาคารกสิกรไทย</option>
                          <option value="กรุงเทพ">ธนาคารกรุงเทพ</option>
                          <option value="กรุงไทย">ธนาคารกรุงไทย</option>
                          <option value="ไทยพาณิชย์">ธนาคารไทยพาณิชย์</option>
                          <option value="กรุงศรีอยุธยา">ธนาคารกรุงศรีอยุธยา</option>
                          <option value="ทหารไทยธนชาต">ธนาคารทหารไทยธนชาต</option>
                          <option value="ออมสิน">ธนาคารออมสิน</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          
          {/* ป๊อปอัพแสดงด้านล่าง */}
          <div className="absolute bottom-0 left-0 right-0 bg-white text-black p-6 rounded-t-xl shadow-lg">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold mb-2">ฝากเงินเข้าบัญชี</h3>
              <p className="text-sm text-gray-500">
                กรอกจำนวนเงินที่ต้องการฝากเข้าบัญชี ขั้นต่ำ 100 บาท
              </p>
            </div>
            
            <Form {...depositForm}>
              <form onSubmit={depositForm.handleSubmit(onDepositSubmit)}>
                <div className="mb-4">
                  <FormField
                    control={depositForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>จำนวนเงิน (บาท)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            placeholder="ระบุจำนวนเงิน"
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* อัปโหลดสลิปการโอนเงิน */}
                <div className="mb-4">
                  <FormLabel>อัปโหลดสลิปการโอนเงิน</FormLabel>
                  <div className="mt-2">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {slipImagePreview ? (
                        <div className="relative">
                          <img 
                            src={slipImagePreview} 
                            alt="สลิปการโอนเงิน" 
                            className="h-40 max-w-full mx-auto object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSlipImagePreview(null);
                              depositForm.setValue("slipImage", undefined);
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div>
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="mt-2 flex justify-center">
                            <label
                              htmlFor="file-upload"
                              className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-medium text-[#16a5a3] hover:bg-[#16a5a3]/10"
                            >
                              <span>อัปโหลดรูปภาพ</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={handleSlipImageChange}
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF สูงสุด 10MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {depositForm.formState.errors.slipImage && (
                    <p className="text-xs text-red-500 mt-1">
                      {depositForm.formState.errors.slipImage.message}
                    </p>
                  )}
                </div>
                
                <div className="flex justify-between gap-3 mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDepositDialogOpen(false)}
                    className="flex-1"
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    type="submit"
                    disabled={depositMutation.isPending}
                    className="bg-[#16a5a3] hover:bg-[#138280] flex-1"
                  >
                    {depositMutation.isPending ? 'กำลังทำรายการ...' : 'ยืนยันการฝากเงิน'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* ไดอะล็อกเปลี่ยนรหัสผ่าน */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle>
            <DialogDescription>
              รหัสผ่านใหม่ของคุณจะต้องมีความยาวอย่างน้อย 8 ตัวอักษร
            </DialogDescription>
          </DialogHeader>
          
          <Form {...useForm({
            resolver: zodResolver(changePasswordSchema),
            defaultValues: {
              currentPassword: "",
              newPassword: "",
              confirmPassword: "",
            },
          })}>
            {({ formState, control, handleSubmit }) => (
              <form 
                onSubmit={handleSubmit(async (data) => {
                  try {
                    await apiRequest("POST", "/api/change-password", data);
                    toast({
                      title: "เปลี่ยนรหัสผ่านสำเร็จ",
                      description: "รหัสผ่านของคุณถูกอัพเดทเรียบร้อยแล้ว",
                    });
                    setChangePasswordOpen(false);
                  } catch (error) {
                    toast({
                      title: "เกิดข้อผิดพลาด",
                      description: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนรหัสผ่านได้",
                      variant: "destructive",
                    });
                  }
                })} 
                className="space-y-4"
              >
                <FormField
                  control={control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสผ่านปัจจุบัน</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รหัสผ่านใหม่</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ยืนยันรหัสผ่านใหม่</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setChangePasswordOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    type="submit"
                    disabled={formState.isSubmitting}
                  >
                    บันทึก
                  </Button>
                </div>
              </form>
            )}
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* ไดอะล็อกตั้งค่าการแจ้งเตือน */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>การแจ้งเตือน</DialogTitle>
            <DialogDescription>
              กำหนดประเภทการแจ้งเตือนที่คุณต้องการรับ
            </DialogDescription>
          </DialogHeader>
          
          <Form {...useForm({
            resolver: zodResolver(notificationsSchema),
            defaultValues: {
              loanUpdates: true,
              withdrawalUpdates: true,
              marketingUpdates: false,
              emailNotifications: true,
              smsNotifications: true,
            },
          })}>
            {({ formState, control, handleSubmit }) => (
              <form 
                onSubmit={handleSubmit(async (data) => {
                  try {
                    await apiRequest("POST", "/api/notifications-settings", data);
                    toast({
                      title: "บันทึกการตั้งค่าสำเร็จ",
                      description: "การตั้งค่าการแจ้งเตือนถูกบันทึกเรียบร้อยแล้ว",
                    });
                    setNotificationsOpen(false);
                  } catch (error) {
                    toast({
                      title: "เกิดข้อผิดพลาด",
                      description: error instanceof Error ? error.message : "ไม่สามารถบันทึกการตั้งค่าได้",
                      variant: "destructive",
                    });
                  }
                })} 
                className="space-y-4"
              >
                <div className="space-y-4 pt-4">
                  <h3 className="font-medium text-sm">ประเภทการแจ้งเตือน</h3>
                  <FormField
                    control={control}
                    name="loanUpdates"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">การอัพเดทสถานะการกู้เงิน</FormLabel>
                          <FormDescription>
                            รับแจ้งเตือนเมื่อสถานะการกู้เงินมีการเปลี่ยนแปลง
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="withdrawalUpdates"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">การอัพเดทสถานะการถอนเงิน</FormLabel>
                          <FormDescription>
                            รับแจ้งเตือนเมื่อสถานะการถอนเงินมีการเปลี่ยนแปลง
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="marketingUpdates"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">โปรโมชั่นและข่าวสาร</FormLabel>
                          <FormDescription>
                            รับข้อมูลข่าวสาร โปรโมชั่น และสิทธิพิเศษต่างๆ
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <h3 className="font-medium text-sm">ช่องทางการแจ้งเตือน</h3>
                  <FormField
                    control={control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">อีเมล</FormLabel>
                          <FormDescription>
                            รับการแจ้งเตือนทางอีเมล
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="smsNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">SMS</FormLabel>
                          <FormDescription>
                            รับการแจ้งเตือนทาง SMS
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setNotificationsOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    type="submit"
                    disabled={formState.isSubmitting}
                  >
                    บันทึก
                  </Button>
                </div>
              </form>
            )}
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* ไดอะล็อกตั้งค่าความเป็นส่วนตัว */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ความเป็นส่วนตัว</DialogTitle>
            <DialogDescription>
              จัดการการแสดงข้อมูลและการใช้ข้อมูลส่วนตัวของคุณ
            </DialogDescription>
          </DialogHeader>
          
          <Form {...useForm({
            resolver: zodResolver(privacySchema),
            defaultValues: {
              showLoanHistory: true,
              showWithdrawalHistory: true,
              allowDataCollection: true,
              allowThirdPartySharing: false,
            },
          })}>
            {({ formState, control, handleSubmit }) => (
              <form 
                onSubmit={handleSubmit(async (data) => {
                  try {
                    await apiRequest("POST", "/api/privacy-settings", data);
                    toast({
                      title: "บันทึกการตั้งค่าสำเร็จ",
                      description: "การตั้งค่าความเป็นส่วนตัวถูกบันทึกเรียบร้อยแล้ว",
                    });
                    setPrivacyOpen(false);
                  } catch (error) {
                    toast({
                      title: "เกิดข้อผิดพลาด",
                      description: error instanceof Error ? error.message : "ไม่สามารถบันทึกการตั้งค่าได้",
                      variant: "destructive",
                    });
                  }
                })} 
                className="space-y-4"
              >
                <div className="space-y-4 pt-4">
                  <h3 className="font-medium text-sm">การแสดงข้อมูล</h3>
                  <FormField
                    control={control}
                    name="showLoanHistory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">ประวัติการกู้เงิน</FormLabel>
                          <FormDescription>
                            แสดงประวัติการกู้เงินในโปรไฟล์ของคุณ
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="showWithdrawalHistory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">ประวัติการถอนเงิน</FormLabel>
                          <FormDescription>
                            แสดงประวัติการถอนเงินในโปรไฟล์ของคุณ
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <h3 className="font-medium text-sm">การใช้ข้อมูล</h3>
                  <FormField
                    control={control}
                    name="allowDataCollection"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">การเก็บข้อมูลการใช้งาน</FormLabel>
                          <FormDescription>
                            อนุญาตให้เราเก็บข้อมูลการใช้งานเพื่อปรับปรุงบริการ
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="allowThirdPartySharing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">การแบ่งปันข้อมูลกับบุคคลที่สาม</FormLabel>
                          <FormDescription>
                            อนุญาตให้เราแบ่งปันข้อมูลกับพันธมิตรทางธุรกิจ
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setPrivacyOpen(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    type="submit"
                    disabled={formState.isSubmitting}
                  >
                    บันทึก
                  </Button>
                </div>
              </form>
            )}
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog แสดงรายละเอียดการกู้เงิน */}
      <Dialog open={!!viewLoanDetails} onOpenChange={() => setViewLoanDetails(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดการกู้เงิน</DialogTitle>
          </DialogHeader>
          
          {viewLoanDetails && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <h4 className="text-sm text-gray-500">สถานะ</h4>
                  <p className="font-medium">
                    <Badge className={
                      viewLoanDetails.status === "approved" ? "bg-green-100 text-green-800" :
                      viewLoanDetails.status === "rejected" ? "bg-red-100 text-red-800" :
                      viewLoanDetails.status === "completed" ? "bg-blue-100 text-blue-800" :
                      "bg-yellow-100 text-yellow-800"
                    }>
                      {getLoanStatusText(viewLoanDetails.status)}
                    </Badge>
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">วันที่ยื่นคำขอ</h4>
                  <p className="font-medium">{new Date(viewLoanDetails.createdAt).toLocaleDateString('th-TH')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">จำนวนเงิน</h4>
                  <p className="font-medium">{formatThaiCurrency(viewLoanDetails.amount)}</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">ระยะเวลาผ่อนชำระ</h4>
                  <p className="font-medium">{viewLoanDetails.term} เดือน</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">อัตราดอกเบี้ย</h4>
                  <p className="font-medium">{viewLoanDetails.interestRate}% ต่อปี</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">ผ่อนชำระรายเดือน</h4>
                  <p className="font-medium">
                    {formatThaiCurrency(
                      calculateMonthlyPayment(
                        viewLoanDetails.amount, 
                        viewLoanDetails.term, 
                        viewLoanDetails.interestRate
                      )
                    )}
                  </p>
                </div>
                
                {viewLoanDetails.purpose && (
                  <div className="col-span-2">
                    <h4 className="text-sm text-gray-500">วัตถุประสงค์</h4>
                    <p className="font-medium">{viewLoanDetails.purpose}</p>
                  </div>
                )}
                
                {viewLoanDetails.adminNote && (
                  <div className="col-span-2">
                    <h4 className="text-sm text-gray-500">หมายเหตุจากผู้ดูแลระบบ</h4>
                    <p className="font-medium">{viewLoanDetails.adminNote}</p>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">รายละเอียดส่วนตัว</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {viewLoanDetails.fullName && (
                    <div>
                      <h4 className="text-sm text-gray-500">ชื่อ-นามสกุล</h4>
                      <p className="font-medium">{viewLoanDetails.fullName}</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.idCardNumber && (
                    <div>
                      <h4 className="text-sm text-gray-500">เลขบัตรประชาชน</h4>
                      <p className="font-medium">{viewLoanDetails.idCardNumber}</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.age && (
                    <div>
                      <h4 className="text-sm text-gray-500">อายุ</h4>
                      <p className="font-medium">{viewLoanDetails.age} ปี</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.occupation && (
                    <div>
                      <h4 className="text-sm text-gray-500">อาชีพ</h4>
                      <p className="font-medium">{viewLoanDetails.occupation}</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.income && (
                    <div>
                      <h4 className="text-sm text-gray-500">รายได้ต่อเดือน</h4>
                      <p className="font-medium">{formatThaiCurrency(viewLoanDetails.income)}</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.remainingIncome && (
                    <div>
                      <h4 className="text-sm text-gray-500">รายได้คงเหลือ</h4>
                      <p className="font-medium">{formatThaiCurrency(viewLoanDetails.remainingIncome)}</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.phone && (
                    <div>
                      <h4 className="text-sm text-gray-500">เบอร์โทรศัพท์</h4>
                      <p className="font-medium">{viewLoanDetails.phone}</p>
                    </div>
                  )}
                  
                  {viewLoanDetails.address && (
                    <div className="col-span-2">
                      <h4 className="text-sm text-gray-500">ที่อยู่</h4>
                      <p className="font-medium">{viewLoanDetails.address}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {(viewLoanDetails.frontIdCardImage || viewLoanDetails.backIdCardImage || viewLoanDetails.selfieWithIdCardImage) && (
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">เอกสารแนบ</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {viewLoanDetails.frontIdCardImage && (
                      <div>
                        <h4 className="text-xs text-gray-500 mb-1">บัตรประชาชน (ด้านหน้า)</h4>
                        <img 
                          src={viewLoanDetails.frontIdCardImage} 
                          alt="บัตรประชาชนด้านหน้า" 
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                    
                    {viewLoanDetails.backIdCardImage && (
                      <div>
                        <h4 className="text-xs text-gray-500 mb-1">บัตรประชาชน (ด้านหลัง)</h4>
                        <img 
                          src={viewLoanDetails.backIdCardImage} 
                          alt="บัตรประชาชนด้านหลัง" 
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                    
                    {viewLoanDetails.selfieWithIdCardImage && (
                      <div>
                        <h4 className="text-xs text-gray-500 mb-1">เซลฟี่พร้อมบัตรประชาชน</h4>
                        <img 
                          src={viewLoanDetails.selfieWithIdCardImage} 
                          alt="เซลฟี่พร้อมบัตรประชาชน" 
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => setViewLoanDetails(null)}
            >
              ปิด
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Dialog แสดงรายละเอียดการถอนเงิน */}
      <Dialog open={!!viewWithdrawalDetails} onOpenChange={() => setViewWithdrawalDetails(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>รายละเอียดการถอนเงิน</DialogTitle>
          </DialogHeader>
          
          {viewWithdrawalDetails && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <h4 className="text-sm text-gray-500">สถานะ</h4>
                  <p className="font-medium">
                    <Badge className={
                      viewWithdrawalDetails.status === "approved" ? "bg-green-100 text-green-800" :
                      viewWithdrawalDetails.status === "rejected" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }>
                      {getWithdrawalStatusText(viewWithdrawalDetails.status)}
                    </Badge>
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">วันที่ยื่นคำขอ</h4>
                  <p className="font-medium">{new Date(viewWithdrawalDetails.createdAt).toLocaleDateString('th-TH')}</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">จำนวนเงิน</h4>
                  <p className="font-medium">{formatThaiCurrency(viewWithdrawalDetails.amount)}</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-gray-500">ธนาคาร</h4>
                  <p className="font-medium">{viewWithdrawalDetails.bankName}</p>
                </div>
                
                <div className="col-span-2">
                  <h4 className="text-sm text-gray-500">เลขบัญชี</h4>
                  <p className="font-medium">{viewWithdrawalDetails.accountNumber}</p>
                </div>
                
                {viewWithdrawalDetails.accountName && (
                  <div className="col-span-2">
                    <h4 className="text-sm text-gray-500">ชื่อบัญชี</h4>
                    <p className="font-medium">{viewWithdrawalDetails.accountName}</p>
                  </div>
                )}
                
                {viewWithdrawalDetails.adminNote && (
                  <div className="col-span-2">
                    <h4 className="text-sm text-gray-500">หมายเหตุจากผู้ดูแลระบบ</h4>
                    <p className="font-medium">{viewWithdrawalDetails.adminNote}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => setViewWithdrawalDetails(null)}
            >
              ปิด
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Dialog สำหรับการฝากเงิน */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ฝากเงินเข้าบัญชี</DialogTitle>
            <DialogDescription>
              กรอกจำนวนเงินที่ต้องการฝากเข้าบัญชี ขั้นต่ำ 100 บาท
            </DialogDescription>
          </DialogHeader>
          
          <Form {...depositForm}>
            <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-6">
              <FormField
                control={depositForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>จำนวนเงิน (บาท)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="ระบุจำนวนเงิน" 
                        {...field}
                        value={field.value === undefined ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDepositDialogOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button 
                  type="submit"
                  disabled={depositMutation.isPending}
                >
                  {depositMutation.isPending ? 'กำลังดำเนินการ...' : 'ฝากเงิน'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
