import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/animations.css"; // นำเข้าไฟล์อนิเมชัน

// กำหนด favicon ให้แสดงในทุกหน้า
const setupFaviconsForAllPages = () => {
  // สร้าง timestamp สำหรับ cache busting
  const timestamp = new Date().getTime();
  
  // ฟังก์ชันสำหรับอัปเดต favicon ทั้งหมด
  const updateAllFavicons = () => {
    // ลบ favicon เดิมทั้งหมด
    const existingLinks = document.querySelectorAll(
      'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"], link[rel="mask-icon"]'
    );
    existingLinks.forEach(link => link.parentNode?.removeChild(link));
    
    // สร้าง favicon ใหม่ทั้งหมด
    [
      { rel: "icon", type: "image/svg+xml", href: `/favicon.svg?v=${timestamp}` },
      { rel: "icon", href: `/favicon-32x32.png?v=${timestamp}`, sizes: "32x32" },
      { rel: "icon", href: `/favicon-16x16.png?v=${timestamp}`, sizes: "16x16" },
      { rel: "apple-touch-icon", href: `/apple-touch-icon.png?v=${timestamp}` },
      { rel: "shortcut icon", href: `/favicon.ico?v=${timestamp}` },
      { rel: "mask-icon", href: `/safari-pinned-tab.svg?v=${timestamp}`, color: "#2e78d2" }
    ].forEach(icon => {
      const link = document.createElement("link");
      link.rel = icon.rel;
      if (icon.type) link.setAttribute("type", icon.type);
      if (icon.sizes) link.setAttribute("sizes", icon.sizes);
      link.href = icon.href;
      if (icon.color) link.setAttribute("color", icon.color);
      document.head.appendChild(link);
    });
  };

  // อัปเดต favicon ตอนโหลดเพจครั้งแรก
  updateAllFavicons();
  
  // อัปเดต favicon เมื่อมีการเปลี่ยนหน้า
  window.addEventListener("popstate", updateAllFavicons);
  
  // สร้าง interval เพื่อตรวจสอบทุก 2 วินาที
  const intervalId = setInterval(() => {
    const favicons = document.querySelectorAll('link[rel="icon"]');
    if (favicons.length === 0) {
      updateAllFavicons();
    }
  }, 2000);
  
  // เมื่อออกจากแอป ล้าง interval
  window.addEventListener("beforeunload", () => {
    clearInterval(intervalId);
  });
};

// เรียกใช้ฟังก์ชันตั้งแต่เริ่มต้น
setupFaviconsForAllPages();

createRoot(document.getElementById("root")!).render(<App />);
