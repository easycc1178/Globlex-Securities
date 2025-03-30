import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './use-websocket';
import { useAuth } from './use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Message, InsertMessage, User } from '@shared/schema';
import { useToast } from './use-toast';

export function useChat(receiverId?: number) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected, sendMessage, addMessageListener } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chatPartners, setChatPartners] = useState<User[]>([]);

  // Get chat history
  const { data: chatHistory, isLoading: isHistoryLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages', receiverId],
    queryFn: async () => {
      if (receiverId) {
        // Fetch messages between current user and specific user
        const res = await apiRequest('GET', `/api/messages/${receiverId}`);
        return await res.json();
      } else {
        // Fetch all messages for the current user
        const res = await apiRequest('GET', '/api/messages');
        return await res.json();
      }
    },
    enabled: !!user, // Only enabled if user is logged in
  });

  // Update messages when chat history changes
  useEffect(() => {
    if (chatHistory) {
      setMessages(chatHistory);
      setIsLoading(false);
    }
  }, [chatHistory]);

  // Handle chat history loading error
  useEffect(() => {
    if (isHistoryLoading === false && !chatHistory) {
      toast({
        title: 'Error',
        description: 'Failed to load chat history',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [isHistoryLoading, chatHistory, toast]);

  // Get list of chat partners
  const { data: chatUsers, isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['/api/chat-users'],
    enabled: !!user,
  });

  // Update chat partners when data changes
  useEffect(() => {
    if (chatUsers) {
      setChatPartners(chatUsers);
    }
  }, [chatUsers]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: InsertMessage) => {
      const res = await apiRequest('POST', '/api/messages', messageData);
      return await res.json();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to send message: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Send message via WebSocket
  const sendChatMessage = useCallback(
    (messageContent: string | Partial<InsertMessage>) => {
      if (!user || !receiverId) return false;

      // สร้างข้อมูลข้อความพื้นฐาน
      let messageData: InsertMessage;
      
      // ตรวจสอบว่าเป็นข้อความธรรมดาหรือข้อมูลแบบ object
      if (typeof messageContent === 'string') {
        messageData = {
          senderId: user.id,
          receiverId,
          content: messageContent,
          messageType: 'text',
          isRead: false,
        };
      } else {
        messageData = {
          senderId: user.id,
          receiverId,
          content: messageContent.content || '',
          messageType: messageContent.messageType || 'text',
          fileUrl: messageContent.fileUrl,
          fileName: messageContent.fileName,
          fileSize: messageContent.fileSize,
          fileMimeType: messageContent.fileMimeType,
          isRead: false,
        };
      }

      if (isConnected) {
        // Send through WebSocket
        sendMessage({
          type: 'chat',
          data: messageData,
        });

        // Optimistically add to local messages
        const optimisticMessage: Message = {
          id: Date.now(), // Temporary ID
          senderId: messageData.senderId,
          receiverId: messageData.receiverId,
          content: messageData.content || '',
          messageType: messageData.messageType as string,
          fileUrl: messageData.fileUrl || null,
          fileName: messageData.fileName || null,
          fileSize: messageData.fileSize || null,
          fileMimeType: messageData.fileMimeType || null,
          isRead: messageData.isRead || false,
          createdAt: new Date(),
          readAt: null,
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        return true;
      } else {
        // Fallback to HTTP if WebSocket not connected
        sendMessageMutation.mutate(messageData, {
          onSuccess: (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
            queryClient.invalidateQueries({ queryKey: ['/api/messages', receiverId] });
          },
        });
        return true;
      }
    },
    [user, receiverId, isConnected, sendMessage, sendMessageMutation]
  );

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!user) return;

    const removeListener = addMessageListener((data) => {
      if (data.type === 'chat') {
        const newMessage = data.data as Message;
        
        // Only add the message if it's relevant to this chat
        if (
          (newMessage.senderId === user.id && newMessage.receiverId === receiverId) ||
          (newMessage.senderId === receiverId && newMessage.receiverId === user.id)
        ) {
          // เพิ่มการอัพเดตข้อความแบบเรียลไทม์
          setMessages((prev) => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some((msg) => msg.id === newMessage.id);
            
            // Check if we have a temporary version of this message (optimistic update)
            const hasTemporary = prev.some(
              (msg) => 
                typeof msg.id === 'number' && 
                msg.id > 1000000000 && // Temporary IDs are timestamps
                msg.senderId === newMessage.senderId && 
                msg.content === newMessage.content &&
                Math.abs(new Date(msg.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 60000 // Within 1 minute
            );
            
            if (exists) return prev;
            
            if (hasTemporary) {
              // Replace temporary message with real message
              return prev.map(msg => 
                (typeof msg.id === 'number' && 
                 msg.id > 1000000000 && 
                 msg.senderId === newMessage.senderId && 
                 msg.content === newMessage.content &&
                 Math.abs(new Date(msg.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 60000)
                  ? newMessage 
                  : msg
              );
            }
            
            return [...prev, newMessage];
          });
          
          // แสดงการแจ้งเตือนเมื่อมีข้อความใหม่จากผู้อื่น (ไม่ใช่ข้อความที่เราส่งเอง)
          if (newMessage.senderId !== user.id) {
            // ถ้าหน้าต่างไม่ได้อยู่ในโฟกัส หรือกำลังดูห้องแชทอื่นอยู่
            const shouldNotify = document.hidden || receiverId !== newMessage.senderId;
            
            if (shouldNotify) {
              toast({
                title: "ข้อความใหม่",
                description: `${newMessage.content || 'ได้ส่งข้อความถึงคุณ'}`,
                variant: "default",
              });
              
              // เล่นเสียงแจ้งเตือน (ถ้ามีในอนาคต)
              try {
                // ถ้ามีเสียงในอนาคต สามารถเพิ่มได้ที่นี่
                // new Audio('/notification.mp3').play();
              } catch (e) {
                console.log('ไม่สามารถเล่นเสียงแจ้งเตือนได้');
              }
            }
            
            // อัพเดตรายการแชทอัตโนมัติและทำเครื่องหมายอ่านแล้ว
            if (receiverId === newMessage.senderId) {
              // ถ้ากำลังดูห้องแชทอยู่ ทำเครื่องหมายว่าอ่านแล้ว
              // ในที่นี้ไม่ต้องทำอะไร เพราะฝั่งเซิร์ฟเวอร์จะจัดการให้
            }
          }
        } else if (user && newMessage.receiverId === user.id) {
          // If message is for the current user but not in the active chat, show notification
          toast({
            title: "ข้อความใหม่",
            description: `คุณได้รับข้อความใหม่`,
            variant: "default",
          });
        }
        
        // Invalidate queries to refresh data (but only if needed - for improved performance)
        if (!receiverId || newMessage.senderId === receiverId || newMessage.receiverId === receiverId) {
          queryClient.invalidateQueries({ queryKey: ['/api/messages', receiverId] });
        }
        queryClient.invalidateQueries({ queryKey: ['/api/chat-users'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      }
    });

    return removeListener;
  }, [user, receiverId, addMessageListener, toast, queryClient]);

  return {
    messages,
    isLoading: isLoading || isHistoryLoading,
    isUsersLoading,
    sendMessage: sendChatMessage,
    chatPartners: chatPartners || [],
  };
}
