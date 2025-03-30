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
import {
  RotateCcw,
  Clock,
  RefreshCcw,
  ArrowLeft,
  Wallet,
  BanknoteIcon,
  CheckCircle2,
  Bell,
  PlusCircle,
  CreditCard,
  Trash2,
  Star,
} from "lucide-react";
import { formatThaiCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Account, Withdrawal, BankAccount } from "@shared/schema";
import { useGlobalChat } from "@/context/chat-context";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Schema for withdrawal form
const withdrawalFormSchema = z.object({
  amount: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "กรุณาระบุจำนวนเงิน" })
      .positive("จำนวนเงินต้องเป็นตัวเลขบวก")
      .min(100, "จำนวนเงินขั้นต่ำคือ 100 บาท")
  ),
  bankAccountId: z.string({ required_error: "กรุณาเลือกบัญชีธนาคาร" })
});

type WithdrawalFormValues = z.infer<typeof withdrawalFormSchema>;

// Schema for new bank account form
const bankAccountFormSchema = z.object({
  bankName: z.string({ required_error: "กรุณาเลือกธนาคาร" }),
  accountNumber: z
    .string()
    .min(3, "เลขบัญชีต้องมีอย่างน้อย 3 ตัว")
    .max(20, "เลขบัญชีต้องไม่เกิน 20 ตัว"),
  accountName: z
    .string()
    .min(3, "กรุณาระบุชื่อบัญชี"),
});

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

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

// Withdrawal status component
function WithdrawalStatus({ status }: { status: string }) {
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
          label: "ปฏิเสธการถอน",
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

// Component for displaying withdrawal history
const WithdrawalHistory = ({ withdrawals = [] }: { withdrawals?: Withdrawal[] }) => {
  if (!withdrawals.length) {
    return (
      <div className="text-center p-6 text-gray-500">
        <p>ไม่มีรายการถอนเงิน</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withdrawals.map((withdrawal) => (
        <Card key={withdrawal.id} className="overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium">{formatThaiCurrency(withdrawal.amount)}</p>
                <p className="text-sm text-gray-500">
                  {withdrawal.bankName} {withdrawal.accountNumber}
                </p>
              </div>
              <WithdrawalStatus status={withdrawal.status} />
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <p>{formatDate(new Date(withdrawal.createdAt))}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

// Bank Account component
function BankAccountCard({ 
  account,
  isSelected,
  onSelect,
  onSetDefault,
  onDelete,
  isDefault 
}: { 
  account: BankAccount;
  isSelected: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  isDefault: boolean;
}) {
  return (
    <div 
      onClick={onSelect}
      className={`border rounded-lg p-4 mb-2 cursor-pointer transition-all ${
        isSelected 
          ? "border-teal-500 bg-teal-50" 
          : "border-gray-200 hover:border-teal-300"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <div className="flex-shrink-0">
            <RadioGroupItem 
              value={String(account.id)} 
              id={`bank-${account.id}`} 
              className="mt-1"
              checked={isSelected}
            />
          </div>
          <div>
            <div className="font-medium">{account.bankName}</div>
            <div className="text-sm text-gray-600">{account.accountNumber}</div>
            <div className="text-sm text-gray-600">{account.accountName}</div>
            {isDefault && (
              <div className="inline-flex items-center text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded mt-1">
                <Star className="h-3 w-3 mr-1 fill-teal-500 text-teal-500" />
                บัญชีหลัก
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {!isDefault && (
            <Button 
              variant="outline" 
              size="icon" 
              className="h-7 w-7"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
              }}
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="outline" 
            size="icon" 
            className="h-7 w-7 text-red-500"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function WithdrawalPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasNewWithdrawalUpdate, hasNewAccountUpdate, resetUpdateFlags } = useGlobalChat();
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // Get account information
  const { data: account, isLoading: accountLoading } = useQuery<Account>({
    queryKey: ["/api/account"],
    enabled: !!user,
  });

  // Get bank accounts
  const { data: bankAccounts, isLoading: bankAccountsLoading, refetch: refetchBankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    enabled: !!user,
  });

  // Get withdrawal history
  const { data: withdrawals, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["/api/withdrawals"],
    enabled: !!user,
  });
  
  // Account data with real-time updates
  const { refetch: refetchAccount } = useQuery<Account>({
    queryKey: ["/api/account"],
    enabled: !!user,
  });
  
  // Handle real-time updates
  useEffect(() => {
    if (hasNewWithdrawalUpdate) {
      refetchWithdrawals();
      setHasNewUpdate(true);
      toast({
        title: "การอัพเดตคำขอถอนเงิน",
        description: "มีการเปลี่ยนแปลงสถานะคำขอถอนเงินของคุณ",
        variant: "default",
      });
      resetUpdateFlags();
    }
  }, [hasNewWithdrawalUpdate, refetchWithdrawals, toast, resetUpdateFlags]);
  
  useEffect(() => {
    if (hasNewAccountUpdate) {
      refetchAccount();
      toast({
        title: "การอัพเดตยอดเงินในบัญชี",
        description: "ยอดเงินในบัญชีของคุณมีการเปลี่ยนแปลง",
        variant: "default",
      });
      resetUpdateFlags();
    }
  }, [hasNewAccountUpdate, refetchAccount, toast, resetUpdateFlags]);

  // Withdrawal form
  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      amount: undefined,
      bankAccountId: ""
    },
  });

  // Bank account form
  const bankAccountForm = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      bankName: "",
      accountNumber: "",
      accountName: "",
    },
  });

  // Create bank account mutation
  const createBankAccountMutation = useMutation({
    mutationFn: async (data: BankAccountFormValues) => {
      const res = await apiRequest("POST", "/api/bank-accounts", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "เพิ่มบัญชีธนาคารสำเร็จ",
        description: "บัญชีธนาคารใหม่ถูกเพิ่มเรียบร้อยแล้ว",
        variant: "default",
      });
      bankAccountForm.reset();
      setShowAddBankModal(false);
      refetchBankAccounts();
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถเพิ่มบัญชีธนาคารได้ กรุณาลองอีกครั้ง",
        variant: "destructive",
      });
    },
  });

  // Set default bank account mutation
  const setDefaultBankAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/bank-accounts/${id}/set-default`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ตั้งเป็นบัญชีหลักเรียบร้อย",
        description: "บัญชีธนาคารถูกตั้งเป็นบัญชีหลักแล้ว",
        variant: "default",
      });
      refetchBankAccounts();
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถตั้งบัญชีหลักได้ กรุณาลองอีกครั้ง",
        variant: "destructive",
      });
    },
  });

  // Delete bank account mutation
  const deleteBankAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/bank-accounts/${id}`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ลบบัญชีธนาคารเรียบร้อย",
        description: "บัญชีธนาคารถูกลบออกแล้ว",
        variant: "default",
      });
      setShowDeleteConfirm(null);
      refetchBankAccounts();
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถลบบัญชีธนาคารได้ กรุณาลองอีกครั้ง",
        variant: "destructive",
      });
    },
  });

  // Create withdrawal mutation
  const withdrawalMutation = useMutation({
    mutationFn: async (data: WithdrawalFormValues) => {
      // ต้องดึงข้อมูลบัญชีธนาคารจาก bankAccountId
      if (!bankAccounts || !data.bankAccountId) {
        throw new Error("กรุณาเลือกบัญชีธนาคาร");
      }

      const selectedAccount = bankAccounts.find(acc => acc.id === parseInt(data.bankAccountId));
      if (!selectedAccount) {
        throw new Error("บัญชีธนาคารที่เลือกไม่ถูกต้อง");
      }
      
      // ส่งข้อมูลในรูปแบบเดิมเพื่อความเข้ากันได้กับ API เดิม
      const withdrawalData = {
        amount: data.amount,
        bankName: selectedAccount.bankName,
        accountNumber: selectedAccount.accountNumber,
        accountName: selectedAccount.accountName,
        userId: user?.id
      };
      
      const res = await apiRequest("POST", "/api/withdrawals", withdrawalData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ส่งคำขอถอนเงินเรียบร้อย",
        description: "คำขอถอนเงินของคุณอยู่ระหว่างการตรวจสอบ",
        variant: "default",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
    },
    onError: (error: Error) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    },
  });

  // Handle bank account form submission
  const onBankAccountSubmit = (data: BankAccountFormValues) => {
    if (!user) return;
    createBankAccountMutation.mutate(data);
  };

  // Handle withdrawal form submission
  const onSubmit = (data: WithdrawalFormValues) => {
    if (!user) return;

    if (!account?.balance || data.amount > account.balance) {
      form.setError("amount", {
        type: "validate",
        message: "ยอดเงินไม่เพียงพอ",
      });
      return;
    }

    withdrawalMutation.mutate(data);
  };

  // Check if user has any bank accounts
  const hasBankAccounts = !bankAccountsLoading && bankAccounts && bankAccounts.length > 0;
  const hasMaxBankAccounts = !bankAccountsLoading && bankAccounts && bankAccounts.length >= 2;

  return (
    <div className="container max-w-md mx-auto p-4 h-full pb-20">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">ถอนเงิน</h1>
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

      <Card className="shadow-lg rounded-xl overflow-hidden mb-6">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50">
          <CardTitle className="text-lg flex items-center">
            <CreditCard className="mr-2 h-5 w-5 text-teal-600" />
            บัญชีธนาคารของฉัน
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {bankAccountsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !hasBankAccounts ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">คุณยังไม่มีบัญชีธนาคาร</p>
              <Button 
                variant="outline" 
                className="flex items-center"
                onClick={() => setShowAddBankModal(true)}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                เพิ่มบัญชีธนาคาร
              </Button>
            </div>
          ) : (
            <div>
              <RadioGroup 
                value={form.watch("bankAccountId")}
                onValueChange={(value) => form.setValue("bankAccountId", value)}
                className="space-y-2"
              >
                {bankAccounts?.map((bankAccount) => (
                  <BankAccountCard 
                    key={bankAccount.id}
                    account={bankAccount}
                    isSelected={form.watch("bankAccountId") === String(bankAccount.id)}
                    onSelect={() => form.setValue("bankAccountId", String(bankAccount.id))}
                    onSetDefault={() => setDefaultBankAccountMutation.mutate(bankAccount.id)}
                    onDelete={() => setShowDeleteConfirm(bankAccount.id)}
                    isDefault={bankAccount.isDefault}
                  />
                ))}
              </RadioGroup>
              
              {!hasMaxBankAccounts && (
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full flex items-center justify-center"
                    onClick={() => setShowAddBankModal(true)}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    เพิ่มบัญชีธนาคาร
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {hasBankAccounts && (
        <Card className="shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-blue-50">
            <CardTitle className="text-lg flex items-center">
              <BanknoteIcon className="mr-2 h-5 w-5 text-teal-600" />
              ถอนเงินเข้าบัญชีธนาคาร
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                {/* Hidden field for bankAccountId */}
                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-6">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium py-6 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg"
                    disabled={withdrawalMutation.isPending || !form.watch("bankAccountId")}
                  >
                    {withdrawalMutation.isPending ? (
                      <div className="flex items-center justify-center">
                        <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />
                        <span className="text-base">กำลังดำเนินการ...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <BanknoteIcon className="h-5 w-5 mr-2" />
                        <span className="text-base">ยืนยันการถอนเงิน</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Add Bank Account Modal */}
      <Dialog open={showAddBankModal} onOpenChange={setShowAddBankModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มบัญชีธนาคาร</DialogTitle>
            <DialogDescription>
              เพิ่มบัญชีธนาคารของคุณเพื่อใช้ในการถอนเงิน (สูงสุด 2 บัญชี)
            </DialogDescription>
          </DialogHeader>
          
          <Form {...bankAccountForm}>
            <form onSubmit={bankAccountForm.handleSubmit(onBankAccountSubmit)} className="space-y-4">
              <FormField
                control={bankAccountForm.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ธนาคาร</FormLabel>
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
                control={bankAccountForm.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เลขบัญชี</FormLabel>
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
                  <FormItem>
                    <FormLabel>ชื่อบัญชี</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ชื่อ-นามสกุล" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddBankModal(false)}
                  type="button"
                >
                  ยกเลิก
                </Button>
                <Button 
                  type="submit"
                  disabled={createBankAccountMutation.isPending}
                >
                  {createBankAccountMutation.isPending ? (
                    <>
                      <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : "บันทึก"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบบัญชีธนาคาร</DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีธนาคารนี้? การกระทำนี้ไม่สามารถยกเลิกได้
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(null)}
            >
              ยกเลิก
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (showDeleteConfirm !== null) {
                  deleteBankAccountMutation.mutate(showDeleteConfirm);
                }
              }}
              disabled={deleteBankAccountMutation.isPending}
            >
              {deleteBankAccountMutation.isPending ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : "ลบบัญชี"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasNewUpdate && withdrawals && withdrawals.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">รายการถอนเงินล่าสุด</h2>
          <WithdrawalHistory withdrawals={withdrawals.slice(0, 3)} />
        </div>
      )}
    </div>
  );
}