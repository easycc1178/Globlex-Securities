import { Link, useLocation } from "wouter";
import { Home, DollarSign, MessageSquare, User, BanknoteIcon, TrendingUp } from "lucide-react";
import { useGlobalChat } from "@/context/chat-context";
import { cn } from "@/lib/utils";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { unreadCount } = useGlobalChat();

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t shadow-lg flex justify-around items-center p-3 z-10">
      <NavItem
        href="/"
        icon={<Home className="text-lg" />}
        label="หน้าหลัก"
        isActive={location === "/"}
      />
      <NavItem
        href="/loan"
        icon={<DollarSign className="text-lg" />}
        label="ยื่นกู้"
        isActive={location === "/loan"}
      />
      <NavItem
        href="/stock-trading"
        icon={<TrendingUp className="text-lg" />}
        label="เทรดหุ้น"
        isActive={location === "/stock-trading"}
      />
      <NavItem
        href="/chat"
        icon={<MessageSquare className="text-lg" />}
        label="แชท"
        isActive={location.startsWith("/chat")}
        badge={unreadCount > 0 ? unreadCount : undefined}
      />
      <NavItem
        href="/profile"
        icon={<User className="text-lg" />}
        label="โปรไฟล์"
        isActive={location === "/profile"}
      />
    </div>
  );
}

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  badge?: number;
};

function NavItem({ href, icon, label, isActive, badge }: NavItemProps) {
  return (
    <Link href={href}>
      <a className="flex flex-col items-center">
        <div className="relative">
          <div
            className={cn(
              "flex items-center justify-center text-xl",
              isActive ? "text-[#16a5a3]" : "text-gray-500"
            )}
          >
            {icon}
          </div>
          {badge !== undefined && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">{badge > 9 ? "9+" : badge}</span>
            </div>
          )}
        </div>
        <span
          className={cn(
            "text-xs mt-1",
            isActive ? "text-[#16a5a3]" : "text-gray-500"
          )}
        >
          {label}
        </span>
      </a>
    </Link>
  );
}
