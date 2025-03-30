import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { 
  Paperclip, 
  Send, 
  Image, 
  FileText, 
  X, 
  Check, 
  CheckCheck, 
  ArrowLeft,
  MoreVertical,
  Download
} from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  receiverId: number;
  receiver: User | null;
  onBack?: () => void;
}

export default function ChatInterface({
  receiverId,
  receiver,
  onBack,
}: ChatInterfaceProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const { messages, isLoading, sendMessage } = useChat(receiverId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "file" | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [autoMessageSent, setAutoMessageSent] = useState(false);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // ส่งข้อความอัตโนมัติเมื่อเปิดแชท
  useEffect(() => {
    if (!isLoading && !autoMessageSent && messages.length === 0) {
      // ส่งข้อความอัตโนมัติเมื่อไม่มีข้อความ
      const autoMessage = "สวัสดีค่ะ ตอนนี้มีผู้ติดต่อเข้ามาจำนวนมาก จะรีบติดต่อกลับนะคะ\nหรือติดต่อ ฝ่ายบริการ ผ่านช่องทางไลน์";
      
      if (receiver?.isAdmin) {
        // ถ้าเป็นแชทกับแอดมิน ส่งข้อความอัตโนมัติจากแอดมิน
        setTimeout(() => {
          sendMessage({
            content: autoMessage,
            messageType: 'text',
          });
          setAutoMessageSent(true);
        }, 1000);
      }
    }
  }, [isLoading, autoMessageSent, messages, receiver, sendMessage]);

  // เด้งไปยังลิงก์ LINE เมื่อมีข้อความถูกส่ง
  useEffect(() => {
    if (autoMessageSent && messages.length > 0) {
      const lineUrl = "https://line.me/ti/p/~oeasy2";
      // เด้งไปหน้า LINE หลังจากส่งข้อความ 2 วินาที
      setTimeout(() => {
        window.location.href = lineUrl;
      }, 2000);
    }
  }, [autoMessageSent, messages]);

  const handleSendMessage = () => {
    if (selectedFile) {
      handleSendFile();
      return;
    }
    
    if (newMessage.trim()) {
      const success = sendMessage({
        content: newMessage.trim(),
        messageType: 'text',
      });
      
      if (success) {
        setNewMessage("");
      }
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setSelectedFile(file);
    
    // ตรวจสอบประเภทไฟล์
    if (file.type.startsWith('image/')) {
      setFileType('image');
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setFileType('file');
      setPreviewUrl(null);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cancelFileSelection = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);
  };

  const handleSendFile = async () => {
    if (!selectedFile) return;
    
    try {
      // สร้าง FormData สำหรับอัปโหลดไฟล์
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('receiverId', receiverId.toString());
      formData.append('messageType', fileType || 'file');
      
      // ส่งไฟล์ไปยังเซิร์ฟเวอร์
      const response = await fetch('/api/messages/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('ไม่สามารถอัปโหลดไฟล์ได้');
      }
      
      // ล้างการเลือกไฟล์
      cancelFileSelection();
      
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'ไม่สามารถอัปโหลดไฟล์ได้',
        variant: 'destructive',
      });
    }
  };

  const handleSelectImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.click();
    }
    setShowAttachmentMenu(false);
  };

  const handleSelectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = '*/*';
      fileInputRef.current.click();
    }
    setShowAttachmentMenu(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const formatFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#F7F7F7] mx-auto" style={{ maxWidth: "380px" }}>
      <div className="bg-[#1a2942] text-white w-full">
        <div className="py-6 px-4">
          <div className="flex items-center">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/20 mr-4"
              >
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
                >
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                {receiver?.isAdmin ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold">
                  {receiver?.isAdmin
                    ? "ฝ่ายบริการลูกค้า"
                    : receiver?.fullName || "ผู้ใช้งาน"}
                </h1>
                <p className="text-xs opacity-80">ออนไลน์</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-[72px]">
        <div className="px-4 py-4">
          {isLoading ? (
            // Loading skeleton
            Array(3)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className={`mb-4 ${i % 2 === 0 ? "" : "text-right"}`}
                >
                  <div
                    className={`p-3 max-w-[80%] inline-block ${
                      i % 2 === 0
                        ? "ml-0 bg-gray-200 rounded-[18px_18px_18px_0]"
                        : "mr-0 bg-[#e6f7ff] rounded-[18px_18px_0_18px]"
                    }`}
                  >
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div
                    className={`text-xs text-gray-500 mt-1 ${
                      i % 2 === 0 ? "ml-1" : "mr-1"
                    }`}
                  >
                    <Skeleton className="h-3 w-10 inline-block" />
                  </div>
                </div>
              ))
          ) : (
            // Actual messages
            messages.map((message) => {
              const isMyMessage = message.senderId === user.id;
              const messageTime = new Date(
                typeof message.createdAt === "string"
                  ? message.createdAt
                  : message.createdAt
              );
              
              const messageStatus = isMyMessage ? (
                <span className="inline-flex ml-1">
                  {message.isRead ? (
                    <CheckCheck className="h-3 w-3 text-blue-500" />
                  ) : (
                    <Check className="h-3 w-3 text-gray-500" />
                  )}
                </span>
              ) : null;
              
              return (
                <div
                  key={message.id}
                  className={`mb-4 ${isMyMessage ? "text-right" : ""}`}
                >
                  <div
                    className={`p-3 max-w-[80%] inline-block ${
                      isMyMessage
                        ? "chat-bubble-user bg-[#e6f7ff] rounded-[18px_18px_0_18px]"
                        : "chat-bubble-admin bg-[#1a2942] text-white rounded-[18px_18px_18px_0]"
                    }`}
                  >
                    {message.messageType === 'image' && message.fileUrl && (
                      <div className="mb-2">
                        <img 
                          src={message.fileUrl || '/placeholder-image.png'} 
                          alt="รูปภาพ" 
                          className="rounded-lg max-w-full max-h-60 object-contain cursor-pointer"
                          onClick={() => message.fileUrl && window.open(message.fileUrl, '_blank')}
                          onError={(e) => {
                            // ถ้าไม่สามารถโหลดรูปภาพได้ใช้รูปภาพเริ่มต้น
                            const target = e.target as HTMLImageElement;
                            target.onerror = null; // ป้องกันการวนลูป
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                          }}
                        />
                      </div>
                    )}
                    
                    {message.messageType === 'file' && message.fileUrl && (
                      <div className="flex items-center mb-2 p-2 bg-white/10 rounded-lg">
                        <div className="mr-3 bg-white/20 p-2 rounded-full">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-medium text-sm truncate">{message.fileName || 'ไฟล์'}</p>
                          {message.fileSize && (
                            <p className="text-xs opacity-80">{formatFileSize(message.fileSize)}</p>
                          )}
                        </div>
                        <a 
                          href={message.fileUrl} 
                          download={message.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 p-1 rounded-full hover:bg-white/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    )}
                    
                    {message.content && (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                  </div>
                  <div
                    className={`text-xs text-gray-500 mt-1 flex items-center ${
                      isMyMessage ? "justify-end mr-1" : "ml-1"
                    }`}
                  >
                    {format(messageTime, "HH:mm", { locale: th })}
                    {messageStatus}
                  </div>
                </div>
              );
            })
          )}
          
          {/* แสดงตัวอย่างไฟล์ก่อนส่ง */}
          {selectedFile && (
            <div className="mb-4 bg-white border rounded-lg p-3 mx-auto max-w-[80%]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-700">ตัวอย่างไฟล์</h4>
                <button 
                  onClick={cancelFileSelection}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              {fileType === 'image' && previewUrl && (
                <div className="flex justify-center mb-2">
                  <img 
                    src={previewUrl} 
                    alt="ตัวอย่างรูปภาพ" 
                    className="max-w-full max-h-60 object-contain rounded-lg cursor-pointer"
                    onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                    onError={(e) => {
                      // ถ้าไม่สามารถโหลดรูปภาพได้ใช้รูปภาพเริ่มต้น
                      const target = e.target as HTMLImageElement;
                      target.onerror = null; // ป้องกันการวนลูป
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
                    }}
                  />
                </div>
              )}
              
              {fileType === 'file' && (
                <div className="flex items-center p-2 bg-gray-100 rounded-lg">
                  <div className="mr-3 bg-gray-200 p-2 rounded-full">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={cancelFileSelection}
                  className="mr-2"
                >
                  ยกเลิก
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSendFile}
                  className="bg-[#16a5a3] hover:bg-[#16a5a3]/90"
                >
                  ส่ง
                </Button>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-0 w-full p-4 bg-[#1a2942] shadow-md" style={{ maxWidth: "380px" }}>
        <div className="px-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileSelection}
          />
          
          <div className="flex items-center">
            <DropdownMenu open={showAttachmentMenu} onOpenChange={setShowAttachmentMenu}>
              <DropdownMenuTrigger asChild>
                <button 
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white mr-2"
                  onClick={() => setShowAttachmentMenu(true)}
                >
                  <Paperclip className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={handleSelectImage} className="flex items-center">
                  <Image className="mr-2 h-4 w-4" />
                  <span>แนบรูปภาพ</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSelectFile} className="flex items-center">
                  <FileText className="mr-2 h-4 w-4" />
                  <span>แนบไฟล์</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Input
              type="text"
              placeholder="พิมพ์ข้อความ..."
              className="flex-grow bg-white/20 text-white rounded-full py-2 px-4 focus:outline-none focus:bg-white/30 placeholder-white/70"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            
            <Button
              onClick={handleSendMessage}
              className="w-10 h-10 rounded-full bg-[#16a5a3] flex items-center justify-center text-white ml-2 hover:bg-[#16a5a3]/80"
              disabled={!newMessage.trim() && !selectedFile}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
