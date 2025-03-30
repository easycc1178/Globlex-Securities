import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CardTitle,
  CardHeader,
  CardContent,
  Card,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCcw,
  ArrowLeft,
  Wallet,
  BanknoteIcon,
  CheckCircle2,
  Bell,
  Clock,
  RotateCcw,
  ArrowDownToLine,
  Upload,
  QrCode,
  Copy,
  Clock1,
  History,
} from "lucide-react";
import { formatThaiCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Account } from "@shared/schema";
import { useGlobalChat } from "@/context/chat-context";

// Schema for deposit form
const depositFormSchema = z.object({
  fullName: z.string().min(3, "กรุณากรอกชื่อ-นามสกุล"),
  accountNumber: z
    .string()
    .min(3, "เลขบัญชีต้องมีอย่างน้อย 3 ตัว")
    .max(20, "เลขบัญชีต้องไม่เกิน 20 ตัว"),
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

// Thai bank options
const bankOptions = [
  { value: "กสิกรไทย", label: "ธนาคารกสิกรไทย" },
  { value: "กรุงเทพ", label: "ธนาคารกรุงเทพ" },
  { value: "กรุงไทย", label: "ธนาคารกรุงไทย" },
  { value: "ไทยพาณิชย์", label: "ธนาคารไทยพาณิชย์" },
  { value: "ทหารไทยธนชาต", label: "ธนาคารทหารไทยธนชาต" },
  { value: "กรุงศรีอยุธยา", label: "ธนาคารกรุงศรีอยุธยา" },
  { value: "ซีไอเอ็มบี", label: "ธนาคารซีไอเอ็มบี" },
  { value: "ทิสโก้", label: "ธนาคารทิสโก้" },
  { value: "เกียรตินาคิน", label: "ธนาคารเกียรตินาคิน" },
];

// ดึงข้อมูลบัญชีธนาคารจาก API
const useBankInfo = () => {
  return useQuery({
    queryKey: ["/api/bank-info"],
    queryFn: async () => {
      const response = await fetch("/api/bank-info");
      if (!response.ok) {
        throw new Error("ไม่สามารถดึงข้อมูลบัญชีธนาคารได้");
      }
      return response.json();
    }
  });
};

// คอมโพเนนต์แสดงข้อมูลบัญชีธนาคาร
interface BankInfoDisplayProps {
  copyToClipboard: (text: string) => void;
  copied: boolean;
}

function BankInfoDisplay({ copyToClipboard, copied }: BankInfoDisplayProps) {
  const bankInfoQuery = useBankInfo();
  
  if (bankInfoQuery.isLoading) {
    return (
      <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-100">
        <div className="text-gray-700 space-y-2 text-sm">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex justify-center mt-3 mb-2">
          <Skeleton className="h-40 w-40" />
        </div>
      </div>
    );
  }
  
  if (bankInfoQuery.isError) {
    return (
      <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 text-red-800">
        <h3 className="text-sm font-semibold mb-2">ไม่สามารถโหลดข้อมูลบัญชีธนาคารได้</h3>
        <p className="text-sm">กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่</p>
      </div>
    );
  }
  
  const bankInfo = bankInfoQuery.data;
  
  return (
    <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-100">
      <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
        <QrCode className="h-4 w-4 mr-1" /> บัญชีธนาคารสำหรับการโอนเงิน
      </h3>
      <div className="text-gray-700 space-y-2 text-sm">
        <p><span className="text-gray-500">ชื่อบัญชี:</span> {bankInfo.accountName}</p>
        <p><span className="text-gray-500">ธนาคาร:</span> {bankInfo.bankName}</p>
        <div className="flex items-center justify-between">
          <p className="flex items-center">
            <span className="text-gray-500 mr-1">เลขบัญชี:</span>
            {bankInfo.accountNumber}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 p-0 px-2 text-xs text-blue-600"
            onClick={() => copyToClipboard(bankInfo.accountNumber)}
          >
            {copied ? (
              <span className="flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-1" /> คัดลอกแล้ว
              </span>
            ) : (
              <span className="flex items-center">
                <Copy className="h-3 w-3 mr-1" /> คัดลอก
              </span>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex justify-center mt-3 mb-2">
        <div className="bg-white p-2 rounded-lg border border-gray-200">
          <img
            src={bankInfo.qrCodeUrl}
            alt="QR Code สำหรับการโอนเงิน"
            className="w-40 h-40"
          />
        </div>
      </div>
      <p className="text-center text-xs text-gray-500">สแกน QR Code เพื่อโอนเงิน</p>
    </div>
  );
}

// Deposit status component (similar to withdrawal status)
function DepositStatus({ status }: { status: string }) {
  const getStatusDetails = () => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock className="h-4 w-4 mr-1" />,
          label: "รอการยืนยัน",
          className: "text-yellow-600 bg-yellow-100 rounded-full px-3 py-1 text-xs font-medium flex items-center",
        };
      case "approved":
        return {
          icon: <CheckCircle2 className="h-4 w-4 mr-1" />,
          label: "อนุมัติแล้ว",
          className: "text-green-600 bg-green-100 rounded-full px-3 py-1 text-xs font-medium flex items-center",
        };
      case "rejected":
        return {
          icon: <RotateCcw className="h-4 w-4 mr-1" />,
          label: "ปฏิเสธการฝาก",
          className: "text-red-600 bg-red-100 rounded-full px-3 py-1 text-xs font-medium flex items-center",
        };
      default:
        return {
          icon: <RefreshCcw className="h-4 w-4 mr-1" />,
          label: "ไม่ทราบสถานะ",
          className: "bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium flex items-center",
        };
    }
  };

  const { icon, label, className } = getStatusDetails();

  return (
    <div className={className}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// Component for displaying deposit history
const DepositHistory = ({ deposits = [] }: { deposits?: any[] }) => {
  if (!deposits?.length) {
    return (
      <div className="text-center p-6 text-gray-500">
        <p>ไม่มีรายการฝากเงิน</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deposits.map((deposit) => (
        <Card key={deposit.id} className="overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium">{formatThaiCurrency(deposit.amount)}</p>
                <p className="text-sm text-gray-500">
                  {deposit.bankName} {deposit.accountNumber}
                </p>
              </div>
              <DepositStatus status={deposit.status} />
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <p>{formatDate(new Date(deposit.createdAt))}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default function DepositPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasNewAccountUpdate, resetUpdateFlags } = useGlobalChat();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [slipImagePreview, setSlipImagePreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Get account information
  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/account"],
    enabled: !!user,
  });

  // Get deposit history
  const { data: deposits, isLoading: depositsLoading, refetch: refetchDeposits } = useQuery<any[]>({
    queryKey: ["/api/deposits"],
    enabled: !!user,
  });

  // Account data with real-time updates
  const { refetch: refetchAccount } = useQuery<Account>({
    queryKey: ["/api/account"],
    enabled: !!user,
  });

  // Handle real-time account balance updates
  useEffect(() => {
    if (hasNewAccountUpdate) {
      refetchAccount();
      refetchDeposits();
      toast({
        title: "การอัพเดตยอดเงินในบัญชี",
        description: "ยอดเงินในบัญชีของคุณมีการเปลี่ยนแปลง",
        variant: "default",
      });
      resetUpdateFlags();
    }
  }, [hasNewAccountUpdate, refetchAccount, refetchDeposits, toast, resetUpdateFlags]);

  // Deposit form
  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      accountNumber: "",
      bankName: "",
      amount: undefined,
    },
  });

  // ฟังก์ชันจัดการการอัปโหลดรูปภาพ
  const handleSlipImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("slipImage", file);
      
      // สร้าง URL สำหรับแสดงตัวอย่างรูปภาพ
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Create deposit mutation
  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormValues) => {
      if (!data.slipImage) {
        throw new Error("กรุณาอัปโหลดสลิปการโอนเงิน");
      }
      
      const formData = new FormData();
      // แนบข้อมูลฟอร์มเป็น JSON string ในชื่อฟิลด์ 'formData'
      formData.append('formData', JSON.stringify({
        fullName: data.fullName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        amount: data.amount
      }));
      // แนบไฟล์รูปภาพแยกต่างหาก
      formData.append('slipImage', data.slipImage);
      
      const res = await fetch('/api/deposit', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const responseData = await res.json();
      
      if (!res.ok) {
        // ถ้าเป็น 401 Unauthorized แปลว่าไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ
        if (res.status === 401) {
          throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการ');
        }
        // ถ้าเซิร์ฟเวอร์ส่งข้อความผิดพลาดมาใช้ข้อความนั้น
        if (responseData.message) {
          throw new Error(responseData.message);
        }
        // ถ้าไม่มีข้อความจากเซิร์ฟเวอร์ใช้ข้อความเริ่มต้น
        throw new Error('ไม่สามารถฝากเงินได้ โปรดลองอีกครั้ง');
      }
      
      return responseData;
    },
    onSuccess: () => {
      toast({
        title: "ส่งคำขอฝากเงินเรียบร้อย",
        description: "คำขอฝากเงินของคุณอยู่ระหว่างการตรวจสอบ",
        variant: "default",
      });
      form.reset();
      setSlipImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      setActiveTab("history");
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: DepositFormValues) => {
    if (!user) {
      toast({
        title: "กรุณาเข้าสู่ระบบ",
        description: "คุณต้องเข้าสู่ระบบก่อนทำรายการฝากเงิน",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }
    
    if (!data.slipImage) {
      toast({
        title: "กรุณาอัปโหลดสลิป",
        description: "กรุณาอัปโหลดสลิปการโอนเงินเพื่อยืนยันการฝากเงิน",
        variant: "destructive",
      });
      return;
    }

    depositMutation.mutate(data);
  };
  
  // Function to copy account number to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="container max-w-md mx-auto p-4 h-full">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">ฝากเงิน</h1>
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="card-gradient p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-white/90 mb-2">ยอดเงินในบัญชี</p>
              {accountLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold font-mono text-white">
                  {account?.balance !== undefined ? formatThaiCurrency(account.balance) : "฿0.00"}
                </p>
              )}
            </div>
            <div className="bg-white/20 rounded-full p-3">
              <Wallet className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 bg-white/80 backdrop-blur-sm">
          <button
            className={`py-4 font-medium text-sm relative transition-all duration-200 ${
              activeTab === "form"
                ? "text-[var(--primary-color)] font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("form")}
          >
            ฝากเงิน
            {activeTab === "form" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-color)]"></div>
            )}
          </button>
          <button
            className={`py-4 font-medium text-sm relative transition-all duration-200 ${
              activeTab === "history"
                ? "text-[var(--primary-color)] font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("history")}
          >
            ประวัติการฝาก
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary-color)]"></div>
            )}
          </button>
        </div>
      </div>

      {activeTab === "form" ? (
        <Card className="shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50">
            <CardTitle className="text-lg flex items-center">
              <ArrowDownToLine className="mr-2 h-5 w-5 text-teal-600" />
              ฝากเงินเข้าบัญชี
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* ดึงข้อมูลบัญชีธนาคารจาก API */}
            <BankInfoDisplay copyToClipboard={copyToClipboard} copied={copied} />
            
            <Separator className="my-4" />
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อ-นามสกุล (ผู้โอน)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ชื่อ-นามสกุล" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ธนาคารที่โอนมา</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกธนาคาร" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankOptions.map((bank) => (
                            <SelectItem key={bank.value} value={bank.value}>
                              {bank.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>เลขบัญชีของท่าน</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="000-0-00000-0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนเงิน</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            ฿
                          </span>
                          <Input
                            {...field}
                            type="number"
                            value={field.value || ""}
                            className="pl-8"
                            placeholder="0.00"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        จำนวนเงินขั้นต่ำ 100 บาท
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div>
                  <FormLabel htmlFor="slipImage">หลักฐานการโอนเงิน</FormLabel>
                  <div className="mt-1 border border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => document.getElementById('slipImage')?.click()}>
                    <input
                      id="slipImage"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleSlipImageChange}
                    />
                    
                    {slipImagePreview ? (
                      <div className="text-center">
                        <img 
                          src={slipImagePreview} 
                          alt="สลิปการโอนเงิน" 
                          className="max-h-44 max-w-full rounded-md mb-2"
                        />
                        <div className="text-sm text-green-600 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          อัพโหลดสลิปแล้ว
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="mx-auto h-10 w-10 text-gray-400" />
                        <div className="mt-2 text-sm text-gray-500">คลิกเพื่ออัพโหลดสลิปการโอนเงิน</div>
                        <div className="mt-1 text-xs text-gray-400">รองรับ JPG, PNG ไฟล์รูปภาพ</div>
                      </div>
                    )}
                  </div>
                  {form.formState.errors.slipImage && (
                    <div className="text-sm text-red-500 mt-1">{form.formState.errors.slipImage.message}</div>
                  )}
                </div>

                <div className="pt-6">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium py-6 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg"
                    disabled={depositMutation.isPending}
                  >
                    {depositMutation.isPending ? (
                      <div className="flex items-center justify-center">
                        <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />
                        <span className="text-base">กำลังดำเนินการ...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <ArrowDownToLine className="h-5 w-5 mr-2" />
                        <span className="text-base">ยืนยันการฝากเงิน</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-teal-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <History className="mr-2 h-5 w-5 text-teal-600" />
                ประวัติการฝากเงิน
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {depositsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <DepositHistory deposits={deposits} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
