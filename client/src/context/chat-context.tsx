import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Message, User, Loan, Withdrawal, Account, Notification } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface RealtimeContextType {
  unreadCount: number;
  onlineUsers: number[];
  chatPartners: User[];
  isLoading: boolean;
  hasNewLoanUpdate: boolean;
  hasNewWithdrawalUpdate: boolean;
  hasNewAccountUpdate: boolean;
  resetUpdateFlags: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { addMessageListener, isConnected } = useWebSocket();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  
  // Flags for real-time updates
  const [hasNewLoanUpdate, setHasNewLoanUpdate] = useState(false);
  const [hasNewWithdrawalUpdate, setHasNewWithdrawalUpdate] = useState(false);
  const [hasNewAccountUpdate, setHasNewAccountUpdate] = useState(false);

  // Reset update flags
  const resetUpdateFlags = () => {
    setHasNewLoanUpdate(false);
    setHasNewWithdrawalUpdate(false);
    setHasNewAccountUpdate(false);
  };

  // Get chat partners
  const { data: chatPartners, isLoading } = useQuery<User[]>({
    queryKey: ['/api/chat-users'],
    enabled: !!user,
  });

  // Get notifications for unread count
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
  });
  
  // Update unread count when notifications data changes
  useEffect(() => {
    if (notifications) {
      // Count unread chat notifications
      const unreadChatNotifications = notifications.filter(
        (notification) => notification.type === 'chat' && !notification.isRead
      ).length;
      setUnreadCount(unreadChatNotifications);
    }
  }, [notifications]);

  // Listen for all real-time updates
  useEffect(() => {
    if (!user || !isConnected) return;

    const removeListener = addMessageListener((data) => {
      // Process different message types
      switch (data.type) {
        case 'online_users':
        case 'user_online':
        case 'user_offline':
          // Update online users list when it changes
          if (data.users) {
            setOnlineUsers(data.users);
          } else if (data.data?.userId) {
            // For single user updates, append or remove from the list
            const userId = data.data.userId;
            if (data.type === 'user_online') {
              setOnlineUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
            } else if (data.type === 'user_offline') {
              setOnlineUsers(prev => prev.filter(id => id !== userId));
            }
          }
          break;

        case 'chat':
          // Handle incoming chat message
          const message = data.data as Message;
          if (message) {
            // Refresh messages queries
            queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
            
            // Increment unread count only for messages sent to current user
            if (message.receiverId === user.id && !message.isRead) {
              setUnreadCount((prev) => prev + 1);
            }
          }
          break;

        case 'notification':
          // Handle new notification
          const notification = data.data as Notification;
          if (notification) {
            // Refresh notifications query
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            
            // Determine notification variant and icon based on type and content
            let variant: 'default' | 'destructive' = 'default';
            let icon = '🔔';
            
            // Apply styling based on notification content
            if (notification.content.includes('สำเร็จ') || notification.content.includes('อนุมัติ')) {
              variant = 'default';
              icon = '✅';
            } else if (notification.content.includes('ไม่สำเร็จ') || notification.content.includes('ปฏิเสธ')) {
              variant = 'destructive';
              icon = '❌';
            } else if (notification.content.includes('รอการ') || notification.content.includes('กำลังรอ')) {
              icon = '⏳';
            }
            
            // Show toast notification with appropriate styling
            toast({
              title: `${icon} ${notification.title}`,
              description: notification.content,
              variant: variant,
            });
          }
          break;

        case 'loan_update':
        case 'loan_updated':
          // Handle loan status update
          setHasNewLoanUpdate(true);
          queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
          
          // Show loan status update notification
          if (data.data && typeof data.data === 'object' && 'status' in data.data) {
            const loan = data.data as Loan;
            let statusText = 'รอการตรวจสอบ';
            let icon = '⏳';
            
            if (loan.status === 'approved') {
              statusText = 'ได้รับการอนุมัติแล้ว';
              icon = '✅';
            } else if (loan.status === 'rejected') {
              statusText = 'ไม่ได้รับการอนุมัติ';
              icon = '❌';
            }
            
            toast({
              title: `${icon} การอัพเดตสถานะเงินกู้`,
              description: `คำขอสินเชื่อของคุณ: ${statusText}`,
              variant: 'default',
            });
          }
          break;

        case 'withdrawal_update':
        case 'withdrawal_updated':
          // Handle withdrawal status update
          setHasNewWithdrawalUpdate(true);
          queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
          
          // Show withdrawal status update notification
          if (data.data && typeof data.data === 'object' && 'status' in data.data) {
            const withdrawal = data.data as Withdrawal;
            let statusText = 'รออนุมัติ';
            let icon = '⏳';
            let variant: 'default' | 'destructive' = 'default';
            let formattedAmount = '';
            
            if (withdrawal.amount) {
              formattedAmount = new Intl.NumberFormat('th-TH', {
                style: 'currency',
                currency: 'THB',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(withdrawal.amount);
            }
            
            if (withdrawal.status === 'approved') {
              statusText = 'ถอนเงินสำเร็จ';
              icon = '✅';
              // Use default variant for success
            } else if (withdrawal.status === 'rejected') {
              statusText = 'ถอนเงินไม่สำเร็จ';
              icon = '❌';
              variant = 'destructive';
            }
            
            toast({
              title: `${icon} ${statusText}`,
              description: formattedAmount ? `จำนวน ${formattedAmount} ${withdrawal.status === 'pending' ? 'กำลังดำเนินการ' : ''}` : 'การถอนเงินของคุณได้รับการอัพเดต',
              variant: variant,
            });
          }
          break;

        case 'account_update':
        case 'account_updated':
          // Handle account balance update
          setHasNewAccountUpdate(true);
          queryClient.invalidateQueries({ queryKey: ['/api/account'] });
          
          // Show toast notification for balance update
          if (data.data && typeof data.data === 'object' && 'balance' in data.data) {
            const account = data.data as Account;
            const formattedBalance = new Intl.NumberFormat('th-TH', { 
              style: 'currency', 
              currency: 'THB',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 
            }).format(account.balance);
            
            toast({
              title: 'การอัพเดตยอดเงิน',
              description: `ยอดเงินในบัญชีของคุณตอนนี้คือ: ${formattedBalance}`,
              variant: 'default',
            });
          }
          break;
          
        case 'stock_price_updated':
          // Handle stock price update
          queryClient.invalidateQueries({ queryKey: ['/api/stocks'] });
          break;
          
        case 'stock_trade_created':
          // Handle new stock trade notification (for admin)
          if (user?.isAdmin) {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/stock-trades'] });
            toast({
              title: '🔔 มีการเทรดหุ้นใหม่',
              description: 'มีผู้ใช้เริ่มการเทรดหุ้นใหม่ โปรดตรวจสอบ',
              variant: 'default',
            });
          }
          break;
          
        case 'trade_completed':
          // Handle completed trade notification
          queryClient.invalidateQueries({ queryKey: ['/api/stock-trades'] });
          queryClient.invalidateQueries({ queryKey: ['/api/account'] });
          break;
          
        case 'system_notification':
          // Handle system-wide notification
          if (data.data && typeof data.data === 'object' && 'message' in data.data) {
            toast({
              title: 'ประกาศจากระบบ',
              description: data.data.message as string,
              variant: 'default',
            });
          }
          break;
      }
    });

    return removeListener;
  }, [user, isConnected, addMessageListener, queryClient, toast]);

  return (
    <RealtimeContext.Provider
      value={{
        unreadCount,
        onlineUsers,
        chatPartners: chatPartners || [],
        isLoading,
        hasNewLoanUpdate,
        hasNewWithdrawalUpdate,
        hasNewAccountUpdate,
        resetUpdateFlags,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useGlobalChat() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useGlobalChat must be used within a ChatProvider');
  }
  return context;
}
