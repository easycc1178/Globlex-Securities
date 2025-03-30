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
