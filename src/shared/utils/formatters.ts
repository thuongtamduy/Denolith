/**
 * Format số thành tiền tệ
 * Mặc định: vi-VN và VND
 */
export const formatCurrency = (
  amount: number,
  locale = "vi-VN",
  currency = "VND",
): string => {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount,
  );
};

/**
 * Che một phần số điện thoại vì lý do bảo mật (VD: 098****123)
 */
export const maskPhone = (
  phone: string | null | undefined,
): string | null => {
  if (!phone || phone.length < 10) return phone || null;
  // Giữ lại 3 số đầu và 3 số cuối, ở giữa thay bằng dấu *
  return phone.slice(0, 3) + "****" + phone.slice(-3);
};
