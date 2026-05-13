/**
 * Phân tích chuỗi User-Agent để lấy thông tin hệ điều hành và loại thiết bị.
 * (Hàm gọn nhẹ không cần cài thêm thư viện ua-parser-js).
 */
export const getDevice = (
  userAgent?: string | null,
): { os: string; device: string } => {
  if (!userAgent) return { os: "Unknown", device: "Unknown" };

  const ua = userAgent.toLowerCase();

  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "MacOS";
  else if (ua.includes("android")) os = "Android";
  else if (
    ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")
  ) {
    os = "iOS";
  } else if (ua.includes("linux")) os = "Linux";

  let device = "Desktop";
  if (
    ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")
  ) {
    device = "Mobile";
  } else if (ua.includes("ipad") || ua.includes("tablet")) {
    device = "Tablet";
  }

  return { os, device };
};
