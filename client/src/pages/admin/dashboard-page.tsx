import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loan, User, Withdrawal, Account, Deposit, StockTrade, Stock, BankAccount } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  Bell,
  TrendingUp,
  Users,
  MessageSquare,
  BarChart,
  Edit,
  CheckCircle,
  XCircle,
  FileText,
  DollarSign,
  UserCheck,
  RefreshCw,
  ArrowLeft,
  Image,
  BanknoteIcon,
  Building as BuildingIcon,
  ImagePlus,
  Trash,
  Loader2,
  User as UserIcon,
  UserPlus,
  LineChart,
  Activity,
  Clock,
  Settings,
  Percent
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// Form schema for user edit
const userEditSchema = z.object({
  fullName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล"),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  phone: z.string().min(1, "กรุณากรอกเบอร์โทรศัพท์"),
  // ข้อมูลธนาคาร
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  // ข้อมูลส่วนตัว
  address: z.string().optional(),
  occupation: z.string().optional(),
  monthlyIncome: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().optional()
  ),
  accountBalance: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().optional()
  ),
  idCardNumber: z.string().optional(),
  // สถานะการใช้งาน
  status: z.enum(["active", "blocked_withdrawal", "blocked_login", "blocked_loan"]),
  isAdmin: z.boolean().optional().default(false),
});

// Schema for creating new user
const createUserSchema = userEditSchema.extend({
  username: z.string().min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
  confirmPassword: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

type CreateUserForm = z.infer<typeof createUserSchema>;

type UserEditForm = z.infer<typeof userEditSchema>;

// เพิ่ม schema สำหรับแก้ไขข้อมูลการถอนเงิน
const withdrawalEditSchema = z.object({
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุจำนวนเงิน" })
      .positive("จำนวนเงินต้องเป็นตัวเลขบวก")
      .min(100, "จำนวนเงินขั้นต่ำคือ 100 บาท")
  ),
  bankName: z.string().min(1, "กรุณาเลือกธนาคาร"),
  accountNumber: z
    .string()
    .min(10, "เลขบัญชีต้องมีอย่างน้อย 10 ตัว")
    .max(15, "เลขบัญชีต้องไม่เกิน 15 ตัว")
    .regex(/^\d+$/, "เลขบัญชีต้องเป็นตัวเลขเท่านั้น"),
  accountName: z
    .string()
    .min(3, "กรุณาระบุชื่อบัญชี"),
  status: z.enum(["pending", "approved", "rejected"]),
  adminNote: z.string().optional(),
});

type WithdrawalEditForm = z.infer<typeof withdrawalEditSchema>;

// เพิ่ม schema สำหรับแก้ไขข้อมูลการฝากเงิน
const depositEditSchema = z.object({
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุจำนวนเงิน" })
      .positive("จำนวนเงินต้องเป็นตัวเลขบวก")
      .min(100, "จำนวนเงินขั้นต่ำคือ 100 บาท")
  ),
  fullName: z.string().min(1, "กรุณาระบุชื่อผู้ฝากเงิน"),
  status: z.enum(["pending", "approved", "rejected"]),
  adminNote: z.string().optional()
});

type DepositEditForm = z.infer<typeof depositEditSchema>;

// เพิ่ม schema สำหรับแก้ไขข้อมูลเงินกู้
const loanEditSchema = z.object({
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุจำนวนเงิน" })
      .positive("จำนวนเงินต้องเป็นตัวเลขบวก")
      .min(50000, "จำนวนเงินขั้นต่ำคือ 50,000 บาท")
      .max(5000000, "จำนวนเงินสูงสุดคือ 5,000,000 บาท")
  ),
  term: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุระยะเวลา" })
      .positive("ระยะเวลาต้องเป็นตัวเลขบวก")
      .min(1, "ระยะเวลาขั้นต่ำคือ 1 เดือน")
      .max(60, "ระยะเวลาสูงสุดคือ 60 เดือน")
  ),
  purpose: z.string().min(1, "กรุณาระบุวัตถุประสงค์"),
  status: z.enum(["pending", "approved", "rejected"]),
  adminNote: z.string().optional(),
  fullName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล"),
  age: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุอายุ" })
      .positive("อายุต้องเป็นตัวเลขบวก")
      .min(20, "อายุขั้นต่ำคือ 20 ปี")
      .max(60, "อายุสูงสุดคือ 60 ปี")
  ),
  occupation: z.string().min(1, "กรุณาระบุอาชีพ"),
  income: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุรายได้" })
      .positive("รายได้ต้องเป็นตัวเลขบวก")
  ),
  remainingIncome: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุรายได้คงเหลือ" })
      .positive("รายได้คงเหลือต้องเป็นตัวเลขบวก")
  ).optional(),
  idCardNumber: z.string().min(13, "เลขบัตรประชาชนต้องมี 13 หลัก").max(13, "เลขบัตรประชาชนต้องมี 13 หลัก").optional(),
  address: z.string().min(1, "กรุณาระบุที่อยู่"),
  phone: z.string().min(1, "กรุณาระบุเบอร์โทรศัพท์"),
});

type LoanEditForm = z.infer<typeof loanEditSchema>;

// Schema สำหรับกำหนดผลลัพธ์การเทรดหุ้น
const stockTradeEditSchema = z.object({
  adminForceResult: z.enum(["win", "loss"]),
  adminNote: z.string().optional(),
});

type StockTradeEditForm = z.infer<typeof stockTradeEditSchema>;

// Schema สำหรับการแก้ไขข้อมูลบัญชีธนาคารของระบบ
const bankInfoSettingSchema = z.object({
  accountName: z.string().min(3, "กรุณาระบุชื่อบัญชี"),
  bankName: z.string().min(1, "กรุณาเลือกธนาคาร"),
  accountNumber: z
    .string()
    .min(3, "เลขบัญชีต้องมีอย่างน้อย 3 ตัว")
    .max(20, "เลขบัญชีต้องไม่เกิน 20 ตัว"),
  qrCodeUrl: z.string().optional(),
});

type BankInfoSettingForm = z.infer<typeof bankInfoSettingSchema>;

const bankOptions = [
  { value: 'กสิกรไทย', label: 'ธนาคารกสิกรไทย' },
  { value: 'กรุงเทพ', label: 'ธนาคารกรุงเทพ' },
  { value: 'กรุงไทย', label: 'ธนาคารกรุงไทย' },
  { value: 'ไทยพาณิชย์', label: 'ธนาคารไทยพาณิชย์' },
  { value: 'ทหารไทยธนชาต', label: 'ธนาคารทหารไทยธนชาต' },
  { value: 'กรุงศรีอยุธยา', label: 'ธนาคารกรุงศรีอยุธยา' },
  { value: 'ซีไอเอ็มบี', label: 'ธนาคารซีไอเอ็มบี' },
  { value: 'ทิสโก้', label: 'ธนาคารทิสโก้' },
  { value: 'เกียรตินาคิน', label: 'ธนาคารเกียรตินาคิน' },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { addMessageListener, isConnected } = useWebSocket();
  
  // ฟังก์ชันสำหรับปิด drawer อย่างปลอดภัย
  const closeDrawer = () => {
    const closeButton = document.querySelector('[data-drawer-close="true"]') as HTMLButtonElement;
    if (closeButton) {
      closeButton.click();
    }
  };
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserAccount, setSelectedUserAccount] = useState<Account | null>(null);
  const [selectedUserBankAccounts, setSelectedUserBankAccounts] = useState<BankAccount[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [activeTab, setActiveTab] = useState("loans");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditWithdrawalOpen, setIsEditWithdrawalOpen] = useState(false);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [newLoanNotification, setNewLoanNotification] = useState(false);
  const [newWithdrawalNotification, setNewWithdrawalNotification] = useState(false);
  const [newDepositNotification, setNewDepositNotification] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [isEditDepositOpen, setIsEditDepositOpen] = useState(false);
  const [isBankInfoSettingOpen, setIsBankInfoSettingOpen] = useState(false);
  const [selectedStockTrade, setSelectedStockTrade] = useState<StockTrade | null>(null);
  const [isEditStockTradeOpen, setIsEditStockTradeOpen] = useState(false);
  const [newStockTradeNotification, setNewStockTradeNotification] = useState(false);
  
  // สำหรับแก้ไขข้อมูลบัญชีธนาคารของผู้ใช้
  const bankAccountSchema = z.object({
    bankName: z.string().min(1, "กรุณาเลือกธนาคาร"),
    accountNumber: z.string().min(3, "เลขบัญชีต้องมีอย่างน้อย 3 ตัว"),
    accountName: z.string().min(3, "กรุณาระบุชื่อบัญชี"),
    isDefault: z.boolean().optional(),
  });
  
  type BankAccountForm = z.infer<typeof bankAccountSchema>;
  
  const bankAccountForm = useForm<BankAccountForm>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankName: "",
      accountNumber: "",
      accountName: "",
      isDefault: false,
    },
  });
  
  const [isEditBankAccountOpen, setIsEditBankAccountOpen] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  


  // Get all users
  const { data: users, isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });
  
  // Get all accounts
  const { data: accounts, isLoading: isAccountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/admin/accounts"],
    enabled: !!user?.isAdmin,
  });

  // Get all loans
  const { data: loans, isLoading: isLoansLoading } = useQuery<Loan[]>({
    queryKey: ["/api/admin/loans"],
    enabled: !!user?.isAdmin,
  });

  // Get all withdrawals
  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/withdrawals"],
    enabled: !!user?.isAdmin,
  });
  
  // Get all deposits
  const { data: deposits, isLoading: isDepositsLoading } = useQuery<Deposit[]>({
    queryKey: ["/api/admin/deposits"],
    enabled: !!user?.isAdmin,
  });
  
  // Get all stock trades
  const { data: stockTrades, isLoading: isStockTradesLoading } = useQuery<StockTrade[]>({
    queryKey: ["/api/admin/stock-trades"],
    enabled: !!user?.isAdmin,
  });
  
  // Get all stocks
  const { data: stocks, isLoading: isStocksLoading } = useQuery<Stock[]>({
    queryKey: ["/api/admin/stocks"],
    enabled: !!user?.isAdmin,
  });

  // Update loan status
  const updateLoanMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNote,
    }: {
      id: number;
      status: string;
      adminNote?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/loans/${id}`, {
        status,
        adminNote,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "อัพเดทสถานะเงินกู้สำเร็จ",
        description: "สถานะเงินกู้ถูกอัพเดทเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loans"] });
      setSelectedLoan(null);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update withdrawal status
  const updateWithdrawalMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNote,
      amount,
      bankName,
      accountNumber,
      accountName,
    }: {
      id: number;
      status: string;
      adminNote?: string;
      amount?: number;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/withdrawals/${id}`, {
        status,
        adminNote,
        amount,
        bankName,
        accountNumber,
        accountName,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "อัพเดทสถานะการถอนเงินสำเร็จ",
        description: "สถานะการถอนเงินถูกอัพเดทเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      setSelectedWithdrawal(null);
      setIsEditWithdrawalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update deposit status
  const updateDepositMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNote,
      amount,
      fullName,
    }: {
      id: number;
      status: string;
      adminNote?: string;
      amount?: number;
      fullName?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/deposits/${id}`, {
        status,
        adminNote,
        amount,
        fullName,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "อัพเดทสถานะการฝากเงินสำเร็จ",
        description: "สถานะการฝากเงินถูกอัพเดทเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      setSelectedDeposit(null);
      setIsEditDepositOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user status
  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      isActive,
      ...updates
    }: {
      id: number;
      isActive?: boolean;
      [key: string]: any;
    }) => {
      console.log("Update user mutation called with:", { id, isActive, ...updates });
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, {
        isActive,
        ...updates,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "ไม่สามารถอัพเดทข้อมูลผู้ใช้ได้" }));
        console.error("Update user API error:", errorData);
        throw new Error(errorData.message || "ไม่สามารถอัพเดทข้อมูลผู้ใช้ได้");
      }
      
      const data = await res.json();
      console.log("Update user API success:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Update user mutation success:", data);
      
      // อัพเดตข้อมูลในแคชทันที เพื่อให้เห็นข้อมูลใหม่ในทันที
      queryClient.setQueryData(["/api/admin/users"], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map(user => user.id === data.id ? data : user);
      });
      
      // ตามด้วยการ invalidate เพื่อให้แน่ใจว่าข้อมูลตรงกับฐานข้อมูล
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      console.error("Update user mutation error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถอัพเดทข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    },
  });

  // เพิ่ม mutation สำหรับแก้ไขข้อมูลเงินกู้
  const updateLoanMutation2 = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      [key: string]: any;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/loans/${id}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "แก้ไขข้อมูลเงินกู้สำเร็จ",
        description: "ข้อมูลเงินกู้ถูกอัพเดทเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loans"] });
      setSelectedLoan(null);
      setIsEditLoanOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation สำหรับอัปเดตข้อมูลบัญชีธนาคาร
  const updateBankInfoMutation = useMutation({
    mutationFn: async (data: BankInfoSettingForm) => {
      const res = await apiRequest("PATCH", "/api/bank-info", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "แก้ไขข้อมูลบัญชีธนาคารสำเร็จ",
        description: "ข้อมูลบัญชีธนาคารถูกอัพเดทเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-info"] });
      setIsBankInfoSettingOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation สำหรับอัปเดตข้อมูลบัญชีธนาคารของผู้ใช้
  const updateBankAccountMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
      isDefault?: boolean;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/bank-accounts/${id}`, updates);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "แก้ไขข้อมูลบัญชีธนาคารสำเร็จ",
        description: "ข้อมูลบัญชีธนาคารถูกอัพเดทเรียบร้อยแล้ว",
      });
      setSelectedUserBankAccounts(data);
      setSelectedBankAccount(null);
      setIsEditBankAccountOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      console.log("Mutation sending data:", userData);
      try {
        const res = await apiRequest("POST", "/api/admin/users", userData);
        const data = await res.json();
        console.log("API response:", data);
        return data;
      } catch (err) {
        console.error("API error:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("Mutation success:", data);
      toast({
        title: "สร้างผู้ใช้ใหม่สำเร็จ",
        description: "ผู้ใช้ใหม่ถูกสร้างเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setIsCreateUserDialogOpen(false);
      createUserForm.reset({
        fullName: "",
        email: "",
        phone: "",
        username: "",
        password: "",
        confirmPassword: "",
        status: "active",
        isAdmin: false,
      });
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<UserEditForm>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      status: "active",
    },
  });

  // Create user form
  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      status: "active",
      isAdmin: false,
    },
  });

  // เพิ่ม form สำหรับแก้ไขข้อมูลการถอนเงิน
  const withdrawalForm = useForm<WithdrawalEditForm>({
    resolver: zodResolver(withdrawalEditSchema),
  });

  // เพิ่ม form สำหรับแก้ไขข้อมูลเงินกู้
  const loanForm = useForm<LoanEditForm>({
    resolver: zodResolver(loanEditSchema),
  });
  
  // เพิ่ม form สำหรับแก้ไขข้อมูลการฝากเงิน
  const depositForm = useForm<DepositEditForm>({
    resolver: zodResolver(depositEditSchema),
  });
  
  // เพิ่ม form สำหรับแก้ไขข้อมูลบัญชีธนาคาร
  const bankInfoForm = useForm<BankInfoSettingForm>({
    resolver: zodResolver(bankInfoSettingSchema),
  });
  
  // เพิ่ม form สำหรับกำหนดผลลัพธ์การเทรดหุ้น
  const stockTradeForm = useForm<StockTradeEditForm>({
    resolver: zodResolver(stockTradeEditSchema),
    defaultValues: {
      adminForceResult: "win",
      adminNote: "",
    }
  });
  
  // Mutation สำหรับกำหนดผลลัพธ์การเทรดหุ้น
  const updateStockTradeMutation = useMutation({
    mutationFn: async ({
      id,
      adminForceResult,
      adminNote,
    }: {
      id: number;
      adminForceResult: string;
      adminNote?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/stock-trades/${id}`, {
        adminForceResult,
        adminNote,
        adminId: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "กำหนดผลลัพธ์การเทรดสำเร็จ",
        description: "ผลลัพธ์การเทรดถูกบันทึกเรียบร้อยแล้ว",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock-trades"] });
      setSelectedStockTrade(null);
      setIsEditStockTradeOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Query ข้อมูลบัญชีธนาคาร
  const { data: bankInfo, isLoading: isBankInfoLoading } = useQuery<{
    accountName: string;
    bankName: string;
    accountNumber: string;
    qrCodeUrl: string;
  }>({
    queryKey: ["/api/bank-info"],
    enabled: !!user?.isAdmin,
  });

  const getUserStatusText = (user: User) => {
    if (!user.isActive) return "ห้ามเข้าสู่ระบบ";
    switch (user.status) {
      case "blocked_withdrawal":
        return "ห้ามถอนเงิน";
      case "blocked_loan":
        return "ห้ามกู้เงิน";
      default:
        return "ใช้งานได้ปกติ";
    }
  };

  // Add query to get user bank accounts
  // ฟังก์ชันสำหรับดึงข้อมูลบัญชีธนาคารของผู้ใช้
  const getUserBankAccounts = async (userId: number) => {
    try {
      console.log(`Fetching bank accounts for user ID: ${userId}`);
      const res = await apiRequest("GET", `/api/admin/bank-accounts/${userId}`);
      
      if (!res.ok) {
        throw new Error("ไม่สามารถดึงข้อมูลบัญชีธนาคารได้");
      }
      
      const data = await res.json();
      console.log("Bank accounts fetched:", data);
      return data;
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      return [];
    }
  };

  const handleEditUser = async (user: User) => {
    setSelectedUser(user);
    
    // Find user's account
    const userAccount = accounts?.find(account => account.userId === user.id);
    setSelectedUserAccount(userAccount || null);
    
    // Fetch user's bank accounts
    const bankAccounts = await getUserBankAccounts(user.id);
    setSelectedUserBankAccounts(bankAccounts || []);
    
    form.reset({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      // Bank information
      bankName: user.bankName || "",
      bankAccountNumber: user.bankAccountNumber || "",
      // Personal information
      address: user.address || "",
      occupation: user.occupation || "",
      monthlyIncome: user.monthlyIncome || undefined,
      accountBalance: userAccount?.balance || 0, // Set account balance
      idCardNumber: user.idCardNumber || "",
      // Status
      status: user.isActive ? (user.status as any) || "active" : "blocked_login",
      isAdmin: user.isAdmin || false,
    });
    setIsEditDialogOpen(true);
  };
  
  const handleCreateUser = () => {
    createUserForm.reset({
      fullName: "",
      email: "",
      phone: "",
      username: "",
      password: "",
      confirmPassword: "",
      status: "active",
      isAdmin: false,
      bankName: "",
      bankAccountNumber: "",
      address: "",
      occupation: "",
      monthlyIncome: undefined,
      accountBalance: undefined,
      idCardNumber: ""
    });
    setIsCreateUserDialogOpen(true);
  };
  
  const onCreateUserSubmit = (data: CreateUserForm) => {
    console.log("Submitting form data:", data);
    createUserMutation.mutate(data);
  };

  const handleEditWithdrawal = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    withdrawalForm.reset({
      amount: withdrawal.amount,
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      accountName: withdrawal.accountName,
      status: withdrawal.status as any,
      adminNote: withdrawal.adminNote || "",
    });
    setIsEditWithdrawalOpen(true);
  };
  
  const handleEditDeposit = (deposit: Deposit) => {
    setSelectedDeposit(deposit);
    depositForm.reset({
      amount: deposit.amount,
      fullName: deposit.fullName,
      status: deposit.status as any,
      adminNote: deposit.adminNote || "",
    });
    setIsEditDepositOpen(true);
  };
  
  const onDepositSubmit = (data: DepositEditForm) => {
    if (!selectedDeposit) return;
    
    updateDepositMutation.mutate({
      id: selectedDeposit.id,
      ...data,
      adminNote: `Updated by ${user?.fullName}: ${data.adminNote || ""}`,
    });
  };

  const onSubmit = async (data: UserEditForm) => {
    if (!selectedUser) return;
    
    console.log("Form submission started", data);

    // Update user data
    const userData = {
      id: selectedUser.id,
      ...data,
      isActive: data.status !== "blocked_login",
      status: data.status === "blocked_login" ? "active" : data.status,
    };
    
    try {
      // แสดงข้อความกำลังประมวลผล
      toast({
        title: "กำลังบันทึกข้อมูล",
        description: "กำลังอัพเดทข้อมูลผู้ใช้..."
      });
      
      console.log("Sending user update request", userData);
      // Update user information
      const updatedUser = await updateUserMutation.mutateAsync(userData);
      
      // อัปเดตยอดเงินทันทีเมื่อมีการกรอกข้อมูล โดยไม่ต้องเปรียบเทียบกับค่าเดิม
      let updatedAccount: Account | null = null;
      if (typeof data.accountBalance === 'number' && selectedUserAccount) {
        console.log("Updating account balance", data.accountBalance);
        // Create update account balance mutation
        const accountRes = await apiRequest("PATCH", `/api/admin/accounts/${selectedUser.id}`, {
          balance: data.accountBalance
        });
        
        if (!accountRes.ok) {
          throw new Error("ไม่สามารถอัพเดทยอดเงินได้");
        }
        
        updatedAccount = await accountRes.json() as Account;
        
        // Immediately refresh accounts data in UI
        queryClient.setQueryData(["/api/admin/accounts"], (oldData: Account[] | undefined) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;
          return oldData.map(acc => acc.userId === selectedUser.id ? updatedAccount as Account : acc);
        });
        
        // Then invalidate to ensure server-side consistency
        queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
        
        toast({
          title: "อัพเดทยอดเงินสำเร็จ",
          description: "ยอดเงินในบัญชีถูกอัพเดทเป็น ฿" + data.accountBalance.toLocaleString() + " เรียบร้อยแล้ว",
        });
      }

      // Immediately update users data in UI
      queryClient.setQueryData(["/api/admin/users"], (oldData: User[] | undefined) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        return oldData.map(user => user.id === selectedUser.id ? updatedUser : user);
      });
      
      // Then invalidate to ensure server-side consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      
      // ล้างข้อมูลและปิด dialog
      setSelectedUser(null);
      setSelectedUserAccount(null);
      setSelectedUserBankAccounts([]);
      setIsEditDialogOpen(false);
      
      toast({
        title: "อัพเดทข้อมูลผู้ใช้สำเร็จ",
        description: "ข้อมูลผู้ใช้ถูกอัพเดทเรียบร้อยแล้ว",
      });
      
      console.log("Form submission completed successfully");
    } catch (error: any) {
      console.error("Form submission error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    }
  };

  const onWithdrawalSubmit = (data: WithdrawalEditForm) => {
    if (!selectedWithdrawal) return;

    updateWithdrawalMutation.mutate({
      id: selectedWithdrawal.id,
      ...data,
      adminNote: `Updated by ${user?.fullName}: ${data.adminNote || ""}`,
    });
  };

  const handleEditLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    
    loanForm.reset({
      amount: loan.amount,
      term: loan.term,
      purpose: loan.purpose || "",
      status: loan.status as any,
      adminNote: loan.adminNote || "",
      fullName: loan.fullName || "",
      age: loan.age || undefined,
      occupation: loan.occupation || "",
      income: loan.income || undefined,
      remainingIncome: loan.remainingIncome || undefined,
      idCardNumber: loan.idCardNumber || "",
      address: loan.address || "",
      phone: loan.phone || "",
    });
    setIsEditLoanOpen(true);
  };

  const onLoanSubmit = (data: LoanEditForm) => {
    if (!selectedLoan) return;

    // เราต้องแก้ไขข้อมูลผู้ใช้ที่เกี่ยวข้องกับเงินกู้นี้ด้วย
    const loanUserId = selectedLoan.userId;
    
    // ถ้าผู้ใช้ไม่เปลี่ยน ไม่ต้องอัพเดทข้อมูลผู้ใช้
    if (loanUserId) {
      // แก้ไขข้อมูลเงินกู้
      updateLoanMutation2.mutate({
        id: selectedLoan.id,
        ...data,
        adminNote: `Updated by ${user?.fullName}: ${data.adminNote || ""}`,
      });
      
      // แก้ไขข้อมูลผู้ใช้
      /*
      updateUserMutation.mutate({
        id: loanUserId,
        fullName: data.fullName,
        age: data.age,
        idCardNumber: data.idCardNumber,
        phone: data.phone,
        address: data.address,
        occupation: data.occupation,
        monthlyIncome: data.income,
        remainingIncome: data.remainingIncome,
      });
      */
    }
  };
  
  // เปิดฟอร์มแก้ไขข้อมูลบัญชีธนาคาร
  const handleEditBankInfo = () => {
    if (!bankInfo) return;
    
    bankInfoForm.reset({
      accountName: bankInfo.accountName,
      bankName: bankInfo.bankName,
      accountNumber: bankInfo.accountNumber,
      qrCodeUrl: bankInfo.qrCodeUrl,
    });
    
    setIsBankInfoSettingOpen(true);
  };
  
  // บันทึกข้อมูลบัญชีธนาคาร
  const onBankInfoSubmit = (data: BankInfoSettingForm) => {
    updateBankInfoMutation.mutate(data);
  };
  
  // สำหรับการแก้ไขบัญชีธนาคารของผู้ใช้
  const handleEditBankAccount = (account: BankAccount) => {
    setSelectedBankAccount(account);
    bankAccountForm.reset({
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      isDefault: account.isDefault,
    });
    setIsEditBankAccountOpen(true);
  };
  
  // สำหรับการตั้งค่าบัญชีธนาคารเป็นบัญชีหลัก
  const handleSetDefaultBankAccount = (account: BankAccount) => {
    if (account.isDefault) return;
    
    updateBankAccountMutation.mutate({
      id: account.id,
      isDefault: true,
    });
  };
  
  // สำหรับการบันทึกแก้ไขบัญชีธนาคาร
  const onBankAccountSubmit = (data: BankAccountForm) => {
    if (!selectedBankAccount) return;
    
    updateBankAccountMutation.mutate({
      id: selectedBankAccount.id,
      ...data,
    });
  };
  
  // ฟังก์ชันเปิดหน้าจอกำหนดผลลัพธ์การเทรดหุ้น
  const handleEditStockTrade = (trade: StockTrade) => {
    setSelectedStockTrade(trade);
    
    // ตั้งค่าแบบฟอร์ม
    stockTradeForm.reset({
      adminForceResult: trade.adminForceResult as any || "win",
      adminNote: trade.adminNote || "",
    });
    
    setIsEditStockTradeOpen(true);
  };
  
  // ส่งข้อมูลกำหนดผลลัพธ์การเทรดหุ้น
  const onStockTradeSubmit = (data: StockTradeEditForm) => {
    if (!selectedStockTrade) return;
    
    updateStockTradeMutation.mutate({
      id: selectedStockTrade.id,
      adminForceResult: data.adminForceResult,
      adminNote: `Set by ${user?.fullName}: ${data.adminNote || ""}`,
    });
  };

  // WebSocket real-time updates for admin
  useEffect(() => {
    if (!user?.isAdmin || !isConnected) return;
    
    const removeListener = addMessageListener((data) => {
      // Process different message types
      switch (data.type) {
        case 'loan_created':
        case 'loan_update':
          // Handle new loan or loan update
          queryClient.invalidateQueries({ queryKey: ["/api/admin/loans"] });
          
          if (data.type === 'loan_created') {
            setNewLoanNotification(true);
            setActiveTab("loans");
            toast({
              title: "มีคำขอสินเชื่อใหม่!",
              description: "มีผู้ใช้ยื่นคำขอสินเชื่อใหม่เข้ามา",
              variant: "default",
            });
            
            // Auto-clear notification after 5 seconds
            setTimeout(() => {
              setNewLoanNotification(false);
            }, 5000);
          }
          break;
          
        case 'withdrawal_created':
        case 'withdrawal_update':
          // Handle new withdrawal or withdrawal update
          queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
          
          if (data.type === 'withdrawal_created') {
            setNewWithdrawalNotification(true);
            setActiveTab("withdrawals");
            toast({
              title: "มีคำขอถอนเงินใหม่!",
              description: "มีผู้ใช้ส่งคำขอถอนเงินใหม่เข้ามา",
              variant: "default",
            });
            
            // Auto-clear notification after 5 seconds
            setTimeout(() => {
              setNewWithdrawalNotification(false);
            }, 5000);
          }
          break;
          
        case 'stock_trade_created':
          // Handle new stock trade
          queryClient.invalidateQueries({ queryKey: ["/api/admin/stock-trades"] });
          
          setNewStockTradeNotification(true);
          setActiveTab("trades");
          toast({
            title: "มีการเทรดหุ้นใหม่!",
            description: "มีผู้ใช้เริ่มการเทรดหุ้นใหม่",
            variant: "default",
          });
          
          // Auto-clear notification after 5 seconds
          setTimeout(() => {
            setNewStockTradeNotification(false);
          }, 5000);
          break;
      }
    });
    
    return removeListener;
  }, [user, isConnected, addMessageListener, queryClient, toast, setActiveTab]);
  
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-light flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1a2942] mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <Button onClick={() => navigate("/")}>กลับสู่หน้าหลัก</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light pb-20">
      {/* Bank Account Edit Dialog */}
      <Dialog open={isEditBankAccountOpen} onOpenChange={setIsEditBankAccountOpen}>
        <DialogContent className="max-w-md p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <BanknoteIcon className="mr-2 h-5 w-5 text-teal-600" />
              แก้ไขข้อมูลบัญชีธนาคารของผู้ใช้
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              {selectedBankAccount && (
                <span>แก้ไขบัญชีธนาคาร {selectedBankAccount.bankName}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...bankAccountForm}>
            <form onSubmit={bankAccountForm.handleSubmit(onBankAccountSubmit)} className="mt-6 space-y-6">
              <div className="px-6">
                <FormField
                  control={bankAccountForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">ธนาคาร</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกธนาคาร" />
                        </SelectTrigger>
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
                  control={bankAccountForm.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel className="text-gray-700">เลขบัญชี</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="000-0-00000-0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankAccountForm.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel className="text-gray-700">ชื่อบัญชี</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ชื่อ-นามสกุล" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bankAccountForm.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-gray-700 cursor-pointer">
                          ตั้งเป็นบัญชีหลัก
                        </FormLabel>
                        <FormDescription className="text-xs text-gray-500">
                          บัญชีนี้จะใช้เป็นค่าเริ่มต้นสำหรับการถอนเงิน
                        </FormDescription>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-end gap-3 p-6 bg-gray-50 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditBankAccountOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1a2942] hover:bg-[#1a2942]/90"
                >
                  บันทึก
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Header */}
      <div className="gradient-bg text-white p-6 pb-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/profile")}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 mr-4"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-semibold">แผงควบคุมแอดมิน</h1>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <div className="text-xs bg-green-500/90 text-white px-2 py-1 rounded-full">เชื่อมต่อแล้ว</div>
            ) : (
              <div className="text-xs bg-red-500/90 text-white px-2 py-1 rounded-full">ขาดการเชื่อมต่อ</div>
            )}
            <div className="relative">
              <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bell className="h-4 w-4" />
              </button>
              {(newLoanNotification || newWithdrawalNotification || newStockTradeNotification) && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card className="rounded-xl shadow-lg animate-slide-up">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 text-sm">คำขอสินเชื่อที่รออนุมัติ</h3>
                <div className="w-8 h-8 rounded-full bg-[#1a2942]/10 flex items-center justify-center text-[#1a2942]">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              {isLoansLoading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-2xl font-bold text-[#1a2942]">
                  {loans?.filter(loan => loan.status === "pending").length || 0}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg animate-slide-up">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 text-sm">คำขอถอนเงินที่รออนุมัติ</h3>
                <div className="w-8 h-8 rounded-full bg-[#e6b54a]/10 flex items-center justify-center text-[#e6b54a]">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              {isWithdrawalsLoading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-2xl font-bold text-[#1a2942]">
                  {withdrawals?.filter(w => w.status === "pending").length || 0}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg animate-slide-up">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-gray-600 text-sm">ผู้ใช้งานทั้งหมด</h3>
                <div className="w-8 h-8 rounded-full bg-[#16a5a3]/10 flex items-center justify-center text-[#16a5a3]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              {isUsersLoading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-2xl font-bold text-[#1a2942]">{users?.length || 0}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation with Drawers */}
        <div className="flex justify-between flex-wrap gap-2 mb-4">
          {/* Drawer for Loan Requests */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant={activeTab.startsWith("loans") ? "default" : "outline"}
                className={cn(
                  "relative min-w-[120px] transition-colors",
                  activeTab.startsWith("loans")
                    ? "bg-[#1a2942] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <FileText className="w-4 h-4 mr-2" />
                คำขอสินเชื่อ
                {newLoanNotification && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>จัดการคำขอสินเชื่อ</DrawerTitle>
                  <DrawerDescription>เลือกการจัดการที่ต้องการ</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  <Button 
                    onClick={() => {
                      setActiveTab("loans");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    คำขอสินเชื่อทั้งหมด
                  </Button>
                  <Button 
                    onClick={() => {
                      setActiveTab("loans-pending");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    คำขอรอการอนุมัติ
                    {newLoanNotification && (
                      <span className="ml-2 h-2 w-2 bg-red-500 rounded-full"></span>
                    )}
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">ปิด</Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Drawer for Withdrawal Requests */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant={activeTab.startsWith("withdrawals") ? "default" : "outline"}
                className={cn(
                  "relative min-w-[120px] transition-colors",
                  activeTab.startsWith("withdrawals")
                    ? "bg-[#1a2942] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <BanknoteIcon className="w-4 h-4 mr-2" />
                คำขอถอนเงิน
                {newWithdrawalNotification && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>จัดการคำขอถอนเงิน</DrawerTitle>
                  <DrawerDescription>เลือกการจัดการที่ต้องการ</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  <Button 
                    onClick={() => {
                      setActiveTab("withdrawals");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <BanknoteIcon className="mr-2 h-4 w-4" />
                    คำขอถอนเงินทั้งหมด
                  </Button>
                  <Button 
                    onClick={() => {
                      setActiveTab("withdrawals-pending");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    คำขอรอการอนุมัติ
                    {newWithdrawalNotification && (
                      <span className="ml-2 h-2 w-2 bg-red-500 rounded-full"></span>
                    )}
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">ปิด</Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Drawer for Deposit Requests */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant={activeTab.startsWith("deposits") ? "default" : "outline"}
                className={cn(
                  "relative min-w-[120px] transition-colors",
                  activeTab.startsWith("deposits")
                    ? "bg-[#1a2942] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                คำขอฝากเงิน
                {newDepositNotification && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>จัดการคำขอฝากเงิน</DrawerTitle>
                  <DrawerDescription>เลือกการจัดการที่ต้องการ</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  <Button 
                    onClick={() => {
                      setActiveTab("deposits");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    คำขอฝากเงินทั้งหมด
                  </Button>
                  <Button 
                    onClick={() => {
                      setActiveTab("deposits-pending");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    คำขอรอการอนุมัติ
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">ปิด</Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Drawer for Stock Trading */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant={activeTab.startsWith("trades") ? "default" : "outline"}
                className={cn(
                  "relative min-w-[120px] transition-colors",
                  activeTab.startsWith("trades")
                    ? "bg-[#1a2942] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <LineChart className="w-4 h-4 mr-2" />
                การเทรดหุ้น
                {newStockTradeNotification && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>จัดการการเทรดหุ้น</DrawerTitle>
                  <DrawerDescription>เลือกการจัดการที่ต้องการ</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  <Button 
                    onClick={() => {
                      setActiveTab("trades");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <LineChart className="mr-2 h-4 w-4" />
                    การเทรดทั้งหมด
                  </Button>
                  <Button 
                    onClick={() => {
                      setActiveTab("trades-active");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    การเทรดที่กำลังดำเนินการ
                    {newStockTradeNotification && (
                      <span className="ml-2 h-2 w-2 bg-red-500 rounded-full"></span>
                    )}
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">ปิด</Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Drawer for User Management */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant={activeTab.startsWith("users") ? "default" : "outline"}
                className={cn(
                  "min-w-[120px] transition-colors",
                  activeTab.startsWith("users")
                    ? "bg-[#1a2942] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <Users className="w-4 h-4 mr-2" />
                จัดการผู้ใช้
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>การจัดการผู้ใช้</DrawerTitle>
                  <DrawerDescription>เลือกการจัดการที่ต้องการ</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  <Button 
                    onClick={() => {
                      setActiveTab("users");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <UserIcon className="mr-2 h-4 w-4" />
                    รายการผู้ใช้ทั้งหมด
                  </Button>
                  <Button 
                    onClick={() => {
                      handleCreateUser();
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    เพิ่มผู้ใช้ใหม่
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">ปิด</Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Drawer for System Settings */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant={activeTab.startsWith("settings") ? "default" : "outline"}
                className={cn(
                  "min-w-[120px] transition-colors",
                  activeTab.startsWith("settings")
                    ? "bg-[#1a2942] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                <Settings className="w-4 h-4 mr-2" />
                ตั้งค่าระบบ
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>การตั้งค่าระบบ</DrawerTitle>
                  <DrawerDescription>เลือกการตั้งค่าที่ต้องการ</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 space-y-2">
                  <Button 
                    onClick={() => {
                      setActiveTab("settings");
                      handleEditBankInfo();
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <BuildingIcon className="mr-2 h-4 w-4" />
                    ตั้งค่าข้อมูลการฝากเงิน
                  </Button>
                  <Button 
                    onClick={() => {
                      setActiveTab("settings-loan");
                      closeDrawer();
                    }}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Percent className="mr-2 h-4 w-4" />
                    ตั้งค่าดอกเบี้ยสินเชื่อ
                  </Button>
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">ปิด</Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Content container - still using Tabs for the content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="hidden">
            <TabsTrigger value="loans" className="hidden">คำขอสินเชื่อ</TabsTrigger>
            <TabsTrigger value="withdrawals" className="hidden">คำขอถอนเงิน</TabsTrigger>
            <TabsTrigger value="deposits" className="hidden">คำขอฝากเงิน</TabsTrigger>
            <TabsTrigger value="trades" className="hidden">การเทรดหุ้น</TabsTrigger>
            <TabsTrigger value="users" className="hidden">จัดการผู้ใช้</TabsTrigger>
            <TabsTrigger value="settings" className="hidden">ตั้งค่าระบบ</TabsTrigger>
          </TabsList>

          {/* Loans Tab */}
          <TabsContent value="loans" className="space-y-4">
            <Card className="rounded-xl shadow-lg animate-slide-up">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#1a2942]">คำขอสินเชื่อล่าสุด</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#16a5a3] text-sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/loans"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    รีเฟรช
                  </Button>
                </div>

                {isLoansLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border-b pb-3">
                        <div className="flex justify-between">
                          <div>
                            <Skeleton className="h-5 w-32 mb-1" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="flex">
                            <Skeleton className="h-8 w-16 mr-2" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : loans && loans.length > 0 ? (
                  <div className="space-y-4">
                    {loans.map((loan) => (
                      <div key={loan.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">
                              {users?.find((u) => u.id === loan.userId)?.fullName || "ผู้ใช้"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              ฿{loan.amount.toLocaleString()} • {new Date(loan.createdAt).toLocaleDateString('th-TH')}
                            </p>
                            {loan.purpose && (
                              <p className="text-sm text-gray-600 mt-1">
                                วัตถุประสงค์: {loan.purpose}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditLoan(loan)}
                                className="text-xs py-1"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                แก้ไข
                              </Button>
                              {loan.status === "pending" && (
                                <div className="flex space-x-2">
                                  <Button
                                    className="bg-[#2ecc71] hover:bg-[#2ecc71]/90 text-white rounded-full text-xs h-8 px-3"
                                    onClick={() => {
                                      updateLoanMutation.mutate({
                                        id: loan.id,
                                        status: "approved",
                                        adminNote: `Approved by ${user.fullName}`,
                                      });
                                    }}
                                  >
                                    อนุมัติ
                                  </Button>
                                  <Button
                                    className="bg-[#e74c3c] hover:bg-[#e74c3c]/90 text-white rounded-full text-xs h-8 px-3"
                                    onClick={() => {
                                      updateLoanMutation.mutate({
                                        id: loan.id,
                                        status: "rejected",
                                        adminNote: `Rejected by ${user.fullName}`,
                                      });
                                    }}
                                  >
                                    ปฏิเสธ
                                  </Button>
                                </div>
                              )}
                              {loan.status === "approved" && (
                                <Button className="bg-[#2ecc71]/80 text-white rounded-full text-xs h-8 px-3" disabled>
                                  <CheckCircle className="h-3 w-3 mr-1" /> อนุมัติแล้ว
                                </Button>
                              )}
                              {loan.status === "rejected" && (
                                <Button className="bg-[#e74c3c]/80 text-white rounded-full text-xs h-8 px-3" disabled>
                                  <XCircle className="h-3 w-3 mr-1" /> ปฏิเสธแล้ว
                                </Button>
                              )}
                              {loan.adminNote && (
                                <p className="text-xs text-gray-500 mt-2">
                                  หมายเหตุ: {loan.adminNote}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>ไม่มีคำขอสินเชื่อในขณะนี้</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits" className="space-y-4">
            <Card className="rounded-xl shadow-lg animate-slide-up">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#1a2942]">คำขอฝากเงินล่าสุด</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#16a5a3] text-sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/deposits"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    รีเฟรช
                  </Button>
                </div>

                {isDepositsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border-b pb-3">
                        <div className="flex justify-between">
                          <div>
                            <Skeleton className="h-5 w-32 mb-1" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="flex">
                            <Skeleton className="h-8 w-16 mr-2" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : deposits && deposits.length > 0 ? (
                  <div className="space-y-4">
                    {deposits.map((deposit) => (
                      <div key={deposit.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">
                              {users?.find((u) => u.id === deposit.userId)?.fullName || deposit.fullName || "ผู้ใช้"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              ฿{deposit.amount.toLocaleString()} • {new Date(deposit.createdAt).toLocaleDateString('th-TH')}
                            </p>
                            {deposit.slipImageUrl && (
                              <div className="mt-2">
                                <a 
                                  href={deposit.slipImageUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline flex items-center"
                                >
                                  <Image size={16} className="h-4 w-4 mr-1" />
                                  ดูหลักฐานการโอนเงิน
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditDeposit(deposit)}
                                className="text-xs py-1"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                แก้ไข
                              </Button>
                              {deposit.status === "pending" && (
                                <>
                                  <Button
                                    className="bg-[#2ecc71] hover:bg-[#2ecc71]/90 text-white rounded-full text-xs h-8 px-3"
                                    onClick={() => {
                                      updateDepositMutation.mutate({
                                        id: deposit.id,
                                        status: "approved",
                                        adminNote: `Approved by ${user?.fullName}`,
                                      });
                                    }}
                                  >
                                    อนุมัติ
                                  </Button>
                                  <Button
                                    className="bg-[#e74c3c] hover:bg-[#e74c3c]/90 text-white rounded-full text-xs h-8 px-3"
                                    onClick={() => {
                                      updateDepositMutation.mutate({
                                        id: deposit.id,
                                        status: "rejected",
                                        adminNote: `Rejected by ${user?.fullName}`,
                                      });
                                    }}
                                  >
                                    ปฏิเสธ
                                  </Button>
                                </>
                              )}
                              {deposit.status === "approved" && (
                                <Button className="bg-[#2ecc71]/80 text-white rounded-full text-xs h-8 px-3" disabled>
                                  <CheckCircle className="h-3 w-3 mr-1" /> อนุมัติแล้ว
                                </Button>
                              )}
                              {deposit.status === "rejected" && (
                                <Button className="bg-[#e74c3c]/80 text-white rounded-full text-xs h-8 px-3" disabled>
                                  <XCircle className="h-3 w-3 mr-1" /> ปฏิเสธแล้ว
                                </Button>
                              )}
                            </div>
                            {deposit.adminNote && (
                              <p className="text-xs text-gray-500 mt-2">
                                หมายเหตุ: {deposit.adminNote}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>ไม่มีคำขอฝากเงินในขณะนี้</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="space-y-4">
            <Card className="rounded-xl shadow-lg animate-slide-up">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#1a2942]">คำขอถอนเงินล่าสุด</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#16a5a3] text-sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    รีเฟรช
                  </Button>
                </div>

                {isWithdrawalsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border-b pb-3">
                        <div className="flex justify-between">
                          <div>
                            <Skeleton className="h-5 w-32 mb-1" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="flex">
                            <Skeleton className="h-8 w-16 mr-2" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : withdrawals && withdrawals.length > 0 ? (
                  <div className="space-y-4">
                    {withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">
                              {users?.find((u) => u.id === withdrawal.userId)?.fullName || "ผู้ใช้"}
                            </h4>
                            <p className="text-sm text-gray-500">
                              ฿{withdrawal.amount.toLocaleString()} • {new Date(withdrawal.createdAt).toLocaleDateString('th-TH')}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              ธนาคาร: {withdrawal.bankName}<br />
                              เลขบัญชี: {withdrawal.accountNumber}
                            </p>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditWithdrawal(withdrawal)}
                                className="text-xs py-1"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                แก้ไข
                              </Button>
                              {withdrawal.status === "pending" && (
                                <>
                                  <Button
                                    className="bg-[#2ecc71] hover:bg-[#2ecc71]/90 text-white rounded-full text-xs h-8 px-3"
                                    onClick={() => {
                                      updateWithdrawalMutation.mutate({
                                        id: withdrawal.id,
                                        status: "approved",
                                        adminNote: `Approved by ${user.fullName}`,
                                      });
                                    }}
                                  >
                                    อนุมัติ
                                  </Button>
                                  <Button
                                    className="bg-[#e74c3c] hover:bg-[#e74c3c]/90 text-white rounded-full text-xs h-8 px-3"
                                    onClick={() => {
                                      updateWithdrawalMutation.mutate({
                                        id: withdrawal.id,
                                        status: "rejected",
                                        adminNote: `Rejected by ${user.fullName}`,
                                      });
                                    }}
                                  >
                                    ปฏิเสธ
                                  </Button>
                                </>
                              )}
                              {withdrawal.status === "approved" && (
                                <Button className="bg-[#2ecc71]/80 text-white rounded-full text-xs h-8 px-3" disabled>
                                  <CheckCircle className="h-3 w-3 mr-1" /> อนุมัติแล้ว
                                </Button>
                              )}
                              {withdrawal.status === "rejected" && (
                                <Button className="bg-[#e74c3c]/80 text-white rounded-full text-xs h-8 px-3" disabled>
                                  <XCircle className="h-3 w-3 mr-1" /> ปฏิเสธแล้ว
                                </Button>
                              )}
                            </div>
                            {withdrawal.adminNote && (
                              <p className="text-xs text-gray-500 mt-2">
                                หมายเหตุ: {withdrawal.adminNote}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>ไม่มีคำขอถอนเงินในขณะนี้</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="rounded-xl shadow-lg animate-slide-up">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#1a2942]">การจัดการผู้ใช้</h3>
                  <div className="flex space-x-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-[#16a5a3] hover:bg-[#16a5a3]/90 text-white"
                      onClick={handleCreateUser}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      เพิ่มสมาชิกใหม่
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#16a5a3] text-sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      รีเฟรช
                    </Button>
                  </div>
                </div>

                {isUsersLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border-b pb-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <Skeleton className="w-10 h-10 rounded-full mr-3" />
                            <div>
                              <Skeleton className="h-5 w-32 mb-1" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : users && users.length > 0 ? (
                  <div className="space-y-4">
                    {users
                      .filter((u) => u.id !== user.id)
                      .map((u) => (
                        <div key={u.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                                u.isAdmin ? 'bg-purple-100 text-purple-500' : 'bg-gray-100 text-gray-500'
                              }`}>
                                <UserCheck className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center">
                                  <h4 className="font-medium">{u.fullName}</h4>
                                  {u.isAdmin && (
                                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                      แอดมิน
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{u.email} {u.phone ? `• ${u.phone}` : ''}</p>
                                <div className="flex items-center mt-1">
                                  <span className={`text-xs mr-2 px-1.5 py-0.5 rounded-full ${
                                    !u.isActive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                    {getUserStatusText(u)}
                                  </span>
                                  {u.occupation && (
                                    <span className="text-xs text-gray-600">
                                      อาชีพ: {u.occupation}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(u)}
                              className="text-xs py-1"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              แก้ไข
                            </Button>
                          </div>
                        </div>
                      ))}
                    {/* Action Buttons */}
                    <div className="mt-4 flex space-x-4 animate-slide-up">
                      <Button
                        className="flex-1 bg-[#16a5a3] text-white rounded-lg p-4 flex items-center justify-center shadow-lg h-14"
                        onClick={() => navigate("/admin/chat")}
                      >
                        <MessageSquare className="h-5 w-5 mr-2" />
                        <span>แชทลูกค้า</span>
                      </Button>
                      <Button
                        className="flex-1 bg-[#e6b54a] text-white rounded-lg p-4 flex items-center justify-center shadow-lg h-14"
                      >
                        <BarChart className="h-5 w-5 mr-2" />
                        <span>รายงาน</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>ไม่มีผู้ใช้ในขณะนี้</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Trades Tab */}
          <TabsContent value="trades" className="space-y-4">
            <Card className="rounded-xl shadow-lg animate-slide-up">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#1a2942]">รายการเทรดหุ้นล่าสุด</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#16a5a3] text-sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/stock-trades"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    รีเฟรช
                  </Button>
                </div>

                {isStockTradesLoading || isStocksLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border-b pb-3">
                        <div className="flex justify-between">
                          <div>
                            <Skeleton className="h-5 w-32 mb-1" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <div className="flex">
                            <Skeleton className="h-8 w-16 mr-2" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : stockTrades && stockTrades.length > 0 ? (
                  <div className="space-y-4">
                    {stockTrades
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((trade) => {
                        const stock = stocks?.find(s => s.id === trade.stockId);
                        const user = users?.find(u => u.id === trade.userId);
                        const isActive = trade.status === 'active';
                        
                        return (
                          <div key={trade.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center">
                                  <h4 className="font-medium">
                                    {user?.fullName || "ผู้ใช้"} 
                                  </h4>
                                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                    isActive 
                                      ? 'bg-yellow-100 text-yellow-800' 
                                      : trade.status === 'win' 
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {isActive ? 'กำลังเทรด' : trade.status === 'win' ? 'ชนะ' : 'แพ้'}
                                  </span>
                                  {trade.adminForceResult && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                                      กำหนดโดยแอดมิน: {trade.adminForceResult === 'win' ? 'ชนะ' : 'แพ้'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {stock?.name} ({stock?.symbol}) • ฿{trade.amount.toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-500">
                                  <span className={`font-medium ${trade.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                    {trade.direction === 'up' ? 'ขึ้น' : 'ลง'}
                                  </span>
                                  {' • '}เริ่ม: ฿{trade.startPrice?.toFixed(2) || '-'}
                                  {trade.endPrice ? ` • จบ: ฿${trade.endPrice.toFixed(2)}` : ''}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(trade.createdAt).toLocaleString('th-TH')}
                                  {trade.endTime ? ` - ${new Date(trade.endTime).toLocaleTimeString('th-TH')}` : ''}
                                </p>
                                {trade.adminNote && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    หมายเหตุ: {trade.adminNote}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end">
                                {isActive && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditStockTrade(trade)}
                                    className="text-xs py-1"
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    กำหนดผลลัพธ์
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>ไม่มีรายการเทรดหุ้นในขณะนี้</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Stock Trade Edit Dialog */}
            <Dialog open={isEditStockTradeOpen} onOpenChange={setIsEditStockTradeOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
                  <DialogTitle>กำหนดผลลัพธ์การเทรด</DialogTitle>
                  <DialogDescription>
                    คุณกำลังกำหนดผลลัพธ์การเทรดสำหรับ {users?.find(u => u?.id === selectedStockTrade?.userId)?.fullName || "ผู้ใช้"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...stockTradeForm}>
                  <form onSubmit={stockTradeForm.handleSubmit(onStockTradeSubmit)} className="space-y-4">
                    <FormField
                      control={stockTradeForm.control}
                      name="adminForceResult"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel>ผลลัพธ์</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="เลือกผลลัพธ์" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="win">ชนะ</SelectItem>
                              <SelectItem value="loss">แพ้</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={stockTradeForm.control}
                      name="adminNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>หมายเหตุ</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="พิมพ์หมายเหตุสำหรับการกำหนดผลลัพธ์นี้"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditStockTradeOpen(false)}
                      >
                        ยกเลิก
                      </Button>
                      <Button type="submit">บันทึกผลลัพธ์</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="rounded-xl shadow-lg animate-slide-up">
              <CardContent className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#1a2942]">ตั้งค่าระบบ</h3>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#16a5a3] text-sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/bank-info"] })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      รีเฟรช
                    </Button>
                  </div>
                </div>

                {/* Bank Info Settings */}
                <div className="border-t pt-5 mt-4">
                  <h4 className="text-base font-medium text-[#1a2942] mb-3">ข้อมูลบัญชีธนาคารสำหรับฝากเงิน</h4>
                  
                  {isBankInfoLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-full max-w-[250px] mb-1" />
                      <Skeleton className="h-5 w-full max-w-[200px] mb-1" />
                      <Skeleton className="h-5 w-full max-w-[150px]" />
                    </div>
                  ) : bankInfo ? (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 w-full">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-sm text-gray-500">ชื่อบัญชี:</div>
                            <div className="col-span-2 text-sm font-medium">{bankInfo.accountName}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-sm text-gray-500">ธนาคาร:</div>
                            <div className="col-span-2 text-sm font-medium">{bankInfo.bankName}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-sm text-gray-500">เลขที่บัญชี:</div>
                            <div className="col-span-2 text-sm font-medium">{bankInfo.accountNumber}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-sm text-gray-500">QR Code:</div>
                            <div className="col-span-2 text-sm font-medium">
                              {bankInfo.qrCodeUrl && (
                                <div className="relative h-32 w-32 bg-white p-1 border rounded-lg mt-2">
                                  <img 
                                    src={bankInfo.qrCodeUrl} 
                                    alt="QR Code" 
                                    className="h-full w-full object-contain" 
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          className="bg-[#16a5a3] hover:bg-[#16a5a3]/90 text-white"
                          onClick={handleEditBankInfo}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          แก้ไข
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>ไม่พบข้อมูลบัญชีธนาคาร</p>
                      <Button className="mt-2" onClick={handleEditBankInfo}>เพิ่มข้อมูลบัญชีธนาคาร</Button>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Existing User Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[700px] p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <UserCheck className="mr-2 h-5 w-5 text-teal-600" />
              แก้ไขข้อมูลผู้ใช้
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              แก้ไขข้อมูลและสถานะของผู้ใช้
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] px-6 py-4">
            <Form {...form}>
              <form id="editUserForm" method="dialog" className="space-y-6">
                {/* Personal Information */}
                <div className="border rounded-xl shadow-sm p-5 bg-gradient-to-r from-blue-50/50 to-teal-50/50">
                  <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center">
                    <FileText className="mr-2 h-4 w-4 text-teal-600" />
                    ข้อมูลส่วนตัว
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">ชื่อ-นามสกุล</FormLabel>
                          <FormControl>
                            <Input {...field} className="w-full" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">อีเมล</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" className="w-full" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">เบอร์โทรศัพท์</FormLabel>
                          <FormControl>
                            <Input {...field} className="w-full" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">สถานะการใช้งาน</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="เลือกสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>สถานะการใช้งาน</SelectLabel>
                                <SelectItem value="active" className="cursor-pointer">ใช้งานได้ปกติ</SelectItem>
                                <SelectItem value="blocked_withdrawal" className="cursor-pointer">ห้ามถอนเงิน</SelectItem>
                                <SelectItem value="blocked_login" className="cursor-pointer">ห้ามเข้าสู่ระบบ</SelectItem>
                                <SelectItem value="blocked_loan" className="cursor-pointer">ห้ามกู้เงิน</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Bank Information */}
                <div className="border rounded-xl shadow-sm p-5">
                  <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center">
                    <BanknoteIcon className="mr-2 h-4 w-4 text-teal-600" />
                    ข้อมูลธนาคาร
                  </h3>
                  
                  {selectedUserBankAccounts.length > 0 ? (
                    <div className="space-y-6">
                      {selectedUserBankAccounts.map((account, index) => (
                        <div key={account.id} className="border rounded-lg p-4 bg-gray-50 relative">
                          <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-medium">
                            {account.isDefault ? 'บัญชีหลัก' : `บัญชีที่ ${index + 1}`}
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-1">ธนาคาร</h4>
                                <p className="text-sm text-gray-900 bg-white border rounded-md px-3 py-2">
                                  {account.bankName}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-1">เลขบัญชี</h4>
                                <p className="text-sm text-gray-900 bg-white border rounded-md px-3 py-2">
                                  {account.accountNumber}
                                </p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี</h4>
                              <p className="text-sm text-gray-900 bg-white border rounded-md px-3 py-2">
                                {account.accountName}
                              </p>
                            </div>
                            <div className="flex justify-end mt-1">
                              <Button 
                                size="sm"
                                variant="outline" 
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditBankAccount(account);
                                }}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                แก้ไข
                              </Button>
                              {!account.isDefault && (
                                <Button 
                                  size="sm"
                                  variant="outline" 
                                  className="text-xs ml-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetDefaultBankAccount(account);
                                  }}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  ตั้งเป็นบัญชีหลัก
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">ธนาคาร</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="เลือกธนาคาร" />
                              </SelectTrigger>
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
                        name="bankAccountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">เลขบัญชีธนาคาร</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="000-0-00000-0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="col-span-2 text-sm text-gray-500 mt-1">
                        ผู้ใช้ยังไม่ได้เพิ่มบัญชีธนาคารในระบบ
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Rights and Account Balance */}
                <div className="border rounded-xl shadow-sm p-5 bg-gradient-to-r from-blue-50/50 to-teal-50/50">
                  <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center">
                    <Users className="mr-2 h-4 w-4 text-teal-600" />
                    สิทธิ์และยอดเงิน
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="isAdmin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-gray-700 cursor-pointer">
                            สิทธิ์แอดมิน
                          </FormLabel>
                          <FormDescription className="text-xs text-gray-500">
                            ผู้ใช้นี้จะมีสิทธิ์ในการจัดการระบบและข้อมูลทั้งหมด
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountBalance"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel className="text-gray-700">ยอดเงินในบัญชี (บาท)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                              ฿
                            </span>
                            <Input
                              type="number"
                              className="pl-8"
                              placeholder="0.00"
                              value={field.value === undefined ? '' : field.value}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs text-gray-500">
                          ยอดเงินในบัญชีปัจจุบัน สามารถปรับเพิ่ม/ลด ได้ตามต้องการ
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </ScrollArea>
          
          <div className="flex items-center justify-end space-x-4 p-4 bg-gray-50 border-t">
            <Button
              type="button"
              variant="outline"
              className="min-w-[120px] border-gray-300 text-gray-700"
              onClick={() => setIsEditDialogOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              className="min-w-[120px] bg-[#16a5a3] hover:bg-[#16a5a3]/90 text-white font-medium"
              disabled={updateUserMutation.isPending}
              onClick={() => {
                console.log("Save button clicked");
                console.log("Form values:", form.getValues());
                const formValues = form.getValues();
                if (selectedUser) {
                  onSubmit(formValues);
                }
              }}
            >
              {updateUserMutation.isPending ? (
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </div>
              ) : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Withdrawal Edit */}
      <Dialog open={isEditWithdrawalOpen} onOpenChange={setIsEditWithdrawalOpen}>
        <DialogContent className="max-w-[600px] p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <BanknoteIcon className="mr-2 h-5 w-5 text-teal-600" />
              แก้ไขข้อมูลการถอนเงิน
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              แก้ไขข้อมูลและสถานะการถอนเงิน
            </DialogDescription>
          </DialogHeader>
          <Form {...withdrawalForm}>
            <form onSubmit={withdrawalForm.handleSubmit(onWithdrawalSubmit)} className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={withdrawalForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">จำนวนเงิน</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            ฿
                          </span>
                          <Input
                            type="number"
                            className="pl-8"
                            placeholder="0.00"
                            value={field.value === undefined ? '' : field.value}
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={withdrawalForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">ธนาคาร</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกธนาคาร" />
                        </SelectTrigger>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={withdrawalForm.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">เลขบัญชี</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="000-0-00000-0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={withdrawalForm.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">ชื่อบัญชี</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ชื่อ-นามสกุล" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={withdrawalForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">สถานะ</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">รอการยืนยัน</SelectItem>
                          <SelectItem value="approved">อนุมัติ</SelectItem>
                          <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={withdrawalForm.control}
                name="adminNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">หมายเหตุ</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="บันทึกเพิ่มเติม" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditWithdrawalOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1a2942] hover:bg-[#1a2942]/90"
                >
                  บันทึก
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Deposit Edit Dialog */}
      <Dialog open={isEditDepositOpen} onOpenChange={setIsEditDepositOpen}>
        <DialogContent className="max-w-md mx-auto p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <DollarSign className="mr-2 h-5 w-5 text-teal-600" />
              แก้ไขข้อมูลการฝากเงิน
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              แก้ไขข้อมูลการฝากเงิน ID: {selectedDeposit?.id}
            </DialogDescription>
          </DialogHeader>
          <Form {...depositForm}>
            <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4">
              <FormField
                control={depositForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อ-นามสกุลผู้ฝาก</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ชื่อ-นามสกุล" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={depositForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>จำนวนเงิน</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              

              
              <FormField
                control={depositForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>สถานะ</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกสถานะ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">รออนุมัติ</SelectItem>
                        <SelectItem value="approved">อนุมัติ</SelectItem>
                        <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={depositForm.control}
                name="adminNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>หมายเหตุ</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="หมายเหตุสำหรับคำขอนี้" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" type="button" onClick={() => setIsEditDepositOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit">บันทึก</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditLoanOpen} onOpenChange={setIsEditLoanOpen}>
        <DialogContent className="max-w-[800px] p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-teal-600" />
              แก้ไขข้อมูลคำขอสินเชื่อ
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              ตรวจสอบและแก้ไขข้อมูลคำขอสินเชื่อตามต้องการ
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)] overflow-y-auto">
            {/* ข้อมูลเดิม */}
            <div className="p-6 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-500 mb-4">ข้อมูลส่วนตัว</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {selectedLoan && (
                  <>
                    {/* หาข้อมูลผู้ใช้ที่เกี่ยวข้องกับเงินกู้นี้ */}
                    {(() => {
                      return (
                        <>
                          <div>
                            <p className="text-gray-500">เลขบัตรประชาชน</p>
                            <p className="font-medium">{selectedLoan.idCardNumber || ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">ชื่อ-นามสกุล</p>
                            <p className="font-medium">{selectedLoan.fullName || ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">อายุ</p>
                            <p className="font-medium">{selectedLoan.age ? `${selectedLoan.age} ปี` : ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">เบอร์โทรศัพท์ติดต่อ</p>
                            <p className="font-medium">{selectedLoan.phone || ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">ที่อยู่</p>
                            <p className="font-medium">{selectedLoan.address || ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">อาชีพ</p>
                            <p className="font-medium">{selectedLoan.occupation || ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">รายได้ต่อเดือน (บาท)</p>
                            <p className="font-medium">{selectedLoan.income ? `฿${selectedLoan.income.toLocaleString()}` : ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">รายได้คงเหลือ (บาท)</p>
                            <p className="font-medium">{selectedLoan.remainingIncome ? `฿${selectedLoan.remainingIncome.toLocaleString()}` : ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">จุดประสงค์การกู้</p>
                            <p className="font-medium">{selectedLoan.purpose || ""}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">จำนวนเงินที่ขอกู้</p>
                            <p className="font-medium">฿{selectedLoan.amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">ระยะเวลา</p>
                            <p className="font-medium">{selectedLoan.term} เดือน</p>
                          </div>
                          <div>
                            <p className="text-gray-500">สถานะ</p>
                            <p className="font-medium">
                              {selectedLoan.status === "pending" && "รอดำเนินการ"}
                              {selectedLoan.status === "approved" && "อนุมัติ"}
                              {selectedLoan.status === "rejected" && "ปฏิเสธ"}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* รูปภาพแนบ */}
            <div className="p-6 border-b">
              <h3 className="text-sm font-medium text-gray-500 mb-4">เอกสารแนบ</h3>
              <div className="grid grid-cols-3 gap-4">
                {selectedLoan?.frontIdCardImage && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">บัตรประชาชน (ด้านหน้า)</p>
                    <img
                      src={selectedLoan.frontIdCardImage}
                      alt="บัตรประชาชนด้านหน้า"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  </div>
                )}
                {selectedLoan?.backIdCardImage && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">บัตรประชาชน (ด้านหลัง)</p>
                    <img
                      src={selectedLoan.backIdCardImage}
                      alt="บัตรประชาชนด้านหลัง"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  </div>
                )}
                {selectedLoan?.selfieWithIdCardImage && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">เซลฟี่พร้อมบัตรประชาชน</p>
                    <img
                      src={selectedLoan.selfieWithIdCardImage}
                      alt="เซลฟี่พร้อมบัตรประชาชน"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* แบบฟอร์มแก้ไข */}
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">แก้ไขข้อมูล</h3>
              <Form {...loanForm}>
                <form id="editLoanForm" onSubmit={loanForm.handleSubmit(onLoanSubmit)} className="space-y-6">
                  <FormField
                    control={loanForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">จำนวนเงิน</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                              ฿
                            </span>
                            <Input
                              {...field}
                              type="number"
                              className="pl-8 w-full"
                              placeholder="0.00"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="term"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">ระยะเวลา (เดือน)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="w-full"
                            placeholder="ระยะเวลา"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">วัตถุประสงค์</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="วัตถุประสงค์" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">สถานะ</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="เลือกสถานะ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">รอการยืนยัน</SelectItem>
                            <SelectItem value="approved">อนุมัติ</SelectItem>
                            <SelectItem value="rejected">ปฏิเสธ</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="adminNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">หมายเหตุ</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="หมายเหตุ" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">ชื่อ-นามสกุล</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="ชื่อ-นามสกุล" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">อายุ</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" className="w-full" placeholder="อายุ" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">อาชีพ</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="อาชีพ" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="idCardNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">เลขบัตรประชาชน</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="เลขบัตรประชาชน" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="income"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">รายได้ต่อเดือน (บาท)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" className="w-full" placeholder="รายได้ต่อเดือน" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="remainingIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">รายได้คงเหลือ (บาท)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" className="w-full" placeholder="รายได้คงเหลือ" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">ที่อยู่</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="ที่อยู่" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loanForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">เบอร์โทรศัพท์ติดต่อ</FormLabel>
                        <FormControl>
                          <Input {...field} className="w-full" placeholder="เบอร์โทรศัพท์" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>
          </ScrollArea>

          {/* ปุ่มด้านล่าง */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditLoanOpen(false)}
                className="min-w-[100px] bg-gray-100 hover:bg-gray-200"
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit"
                form="editLoanForm"
                className="min-w-[100px] bg-[#16a5a3] hover:bg-[#16a5a3]/90"
              >
                ยืนยันการแก้ไข
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
        <DialogContent className="max-w-[700px] p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <UserCheck className="mr-2 h-5 w-5 text-teal-600" />
              เพิ่มสมาชิกใหม่
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ใหม่
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] px-6 py-4">
            <Form {...createUserForm}>
              <form id="createUserForm" onSubmit={createUserForm.handleSubmit(onCreateUserSubmit)} className="space-y-6">
                {/* Account Information */}
                <div className="border rounded-xl shadow-sm p-5 bg-gradient-to-r from-blue-50/50 to-teal-50/50">
                  <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center">
                    <UserCheck className="mr-2 h-4 w-4 text-teal-600" />
                    ข้อมูลบัญชี
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createUserForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">ชื่อผู้ใช้</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="new-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-4">
                      <FormField
                        control={createUserForm.control}
                        name="isAdmin"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-gray-700 cursor-pointer">
                                สิทธิ์แอดมิน
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={createUserForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">รหัสผ่าน</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} autoComplete="new-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createUserForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">ยืนยันรหัสผ่าน</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} autoComplete="new-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Personal Information */}
                <div className="border rounded-xl shadow-sm p-5">
                  <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center">
                    <FileText className="mr-2 h-4 w-4 text-teal-600" />
                    ข้อมูลส่วนตัว
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createUserForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">ชื่อ-นามสกุล</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createUserForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">อีเมล</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={createUserForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">เบอร์โทรศัพท์</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createUserForm.control}
                      name="idCardNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">เลขบัตรประชาชน</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createUserForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel className="text-gray-700">ที่อยู่</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={createUserForm.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">อาชีพ</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createUserForm.control}
                      name="monthlyIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">รายได้ต่อเดือน</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                ฿
                              </span>
                              <Input 
                                type="number" 
                                className="pl-7"
                                {...field}
                                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Bank Information */}
                <div className="border rounded-xl shadow-sm p-5 bg-gradient-to-r from-blue-50/50 to-teal-50/50">
                  <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center">
                    <BanknoteIcon className="mr-2 h-4 w-4 text-teal-600" />
                    ข้อมูลธนาคาร
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createUserForm.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">ธนาคาร</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="เลือกธนาคาร" />
                            </SelectTrigger>
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
                      control={createUserForm.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">เลขบัญชีธนาคาร</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000-0-00000-0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="mt-4">
                    <FormField
                      control={createUserForm.control}
                      name="accountBalance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">ยอดเงินเริ่มต้น</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                ฿
                              </span>
                              <Input 
                                {...field} 
                                type="number" 
                                className="pl-7" 
                                placeholder="0.00" 
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </form>
            </Form>
          </ScrollArea>
          
          <div className="flex items-center justify-end space-x-4 p-4 bg-gray-50 border-t">
            <Button
              type="button"
              variant="outline"
              className="min-w-[120px] border-gray-300 text-gray-700"
              onClick={() => setIsCreateUserDialogOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              form="createUserForm"
              className="min-w-[120px] bg-[#16a5a3] hover:bg-[#16a5a3]/90 text-white font-medium"
            >
              สร้างผู้ใช้
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Info Setting Dialog */}
      <Dialog open={isBankInfoSettingOpen} onOpenChange={setIsBankInfoSettingOpen}>
        <DialogContent className="max-w-[600px] p-0 shadow-lg rounded-xl overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-r from-teal-50 to-blue-50 space-y-2">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <BuildingIcon className="mr-2 h-5 w-5 text-teal-600" />
              แก้ไขข้อมูลบัญชีธนาคาร
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              แก้ไขข้อมูลบัญชีธนาคารที่จะแสดงในหน้าฝากเงิน
            </DialogDescription>
          </DialogHeader>
          <Form {...bankInfoForm}>
            <form onSubmit={bankInfoForm.handleSubmit(onBankInfoSubmit)} className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={bankInfoForm.control}
                  name="accountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">ชื่อบัญชี</FormLabel>
                      <FormControl>
                        <Input {...field} className="w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bankInfoForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">ธนาคาร</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกธนาคาร" />
                        </SelectTrigger>
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
              </div>

              <FormField
                control={bankInfoForm.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">เลขที่บัญชี</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="000-0-00000-0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bankInfoForm.control}
                name="qrCodeUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">QR Code (รูปภาพ)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex flex-col items-center">
                          {field.value && (
                            <div className="relative h-40 w-40 bg-white p-1 border rounded-lg mb-3">
                              <img 
                                src={field.value} 
                                alt="QR Code Preview" 
                                className="h-full w-full object-contain" 
                                onError={(e) => e.currentTarget.src = ''}
                              />
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              id="qrcodeUpload"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  // Convert to base64 for easy storage
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    if (event.target?.result) {
                                      field.onChange(event.target.result.toString());
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <label
                              htmlFor="qrcodeUpload"
                              className="px-3 py-2 rounded-md text-sm bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 transition-colors cursor-pointer inline-flex items-center"
                            >
                              <ImagePlus className="w-4 h-4 mr-1" />
                              อัพโหลดรูป QR Code
                            </label>
                            
                            {field.value && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => field.onChange('')}
                              >
                                <Trash className="w-4 h-4 mr-1" />
                                ลบรูป
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs text-gray-500 text-center mt-2">
                      อัพโหลดรูปภาพ QR Code สำหรับการโอนเงิน (รองรับ JPG, PNG, GIF)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBankInfoSettingOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1a2942] hover:bg-[#1a2942]/90"
                >
                  บันทึก
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}