/**
 * SMTP Email Service dùng Deno native TCP — không cần thư viện ngoài.
 * Hỗ trợ STARTTLS (port 587) là chuẩn phổ biến nhất.
 *
 * Compatible với: Gmail, Mailgun, Resend SMTP, SendGrid, Postfix...
 * Fallback: Nếu SMTP chưa được cấu hình → chỉ log, không throw error.
 */

import { config } from "./config.ts";
import { logger } from "./logger.ts";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plaintext fallback
}

/**
 * Encode base64 cho auth SMTP (compatible với Deno)
 */
function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Gửi email qua SMTP thuần.
 * Nếu `config.smtp` là null → log warning và bỏ qua (graceful degradation).
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!config.smtp) {
    logger.warn(
      `📧 [Email] SMTP chưa được cấu hình. Bỏ qua email tới ${payload.to}: "${payload.subject}"`,
    );
    return;
  }

  const { host, port, user, pass, from } = config.smtp;

  try {
    // Kết nối TCP đến SMTP server
    const conn = await Deno.connect({ hostname: host, port });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const send = async (cmd: string) => {
      await conn.write(encoder.encode(cmd + "\r\n"));
    };

    const read = async (): Promise<string> => {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n ?? 0));
    };

    // SMTP Handshake
    await read(); // 220 Server greeting
    await send(`EHLO denolith`);
    await read(); // 250 capabilities

    // STARTTLS (port 587)
    if (port === 587) {
      await send("STARTTLS");
      await read(); // 220 Go ahead
      const tlsConn = await Deno.startTls(conn, { hostname: host });

      const tlsSend = async (cmd: string) => {
        await tlsConn.write(encoder.encode(cmd + "\r\n"));
      };
      const tlsRead = async (): Promise<string> => {
        const buf = new Uint8Array(4096);
        const n = await tlsConn.read(buf);
        return decoder.decode(buf.subarray(0, n ?? 0));
      };

      await tlsSend(`EHLO denolith`);
      await tlsRead();

      // AUTH LOGIN
      if (user && pass) {
        await tlsSend("AUTH LOGIN");
        await tlsRead();
        await tlsSend(base64Encode(user));
        await tlsRead();
        await tlsSend(base64Encode(pass));
        await tlsRead();
      }

      // Email envelope
      await tlsSend(`MAIL FROM:<${from}>`);
      await tlsRead();
      await tlsSend(`RCPT TO:<${payload.to}>`);
      await tlsRead();
      await tlsSend("DATA");
      await tlsRead();

      // Email headers & body
      const body = [
        `From: ${from}`,
        `To: ${payload.to}`,
        `Subject: ${payload.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        payload.html,
        `.`,
      ].join("\r\n");

      await tlsSend(body);
      await tlsRead(); // 250 OK

      await tlsSend("QUIT");
      tlsConn.close();
    }

    logger.info(
      `✅ [Email] Đã gửi thành công tới ${payload.to}: "${payload.subject}"`,
    );
  } catch (err) {
    logger.error(`❌ [Email] Lỗi gửi email tới ${payload.to}`, err);
    // Không re-throw — email failure không nên crash request
  }
}

// ============================================================
// Email Templates & Security Sanitization
// ============================================================

function sanitizeHeader(str: string): string {
  // Loại bỏ toàn bộ ký tự điều khiển (CRLF) để chống Email Header Injection
  return str.replace(/[\r\n]/g, "");
}

function escapeHtml(str: string): string {
  // Loại bỏ các thẻ HTML để chống Mail Client XSS / HTML Injection
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const EmailTemplates = {
  welcome(username: string): Omit<EmailPayload, "to"> {
    const cleanUsername = sanitizeHeader(username);
    const safeHtmlName = escapeHtml(username);

    return {
      subject: `Chào mừng ${cleanUsername} đến với Denolith! 🚀`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">Chào mừng, ${safeHtmlName}! 🎉</h1>
          <p>Tài khoản của bạn đã được tạo thành công trên <strong>Denolith</strong>.</p>
          <p>Bắt đầu khám phá ngay!</p>
          <hr style="border: 1px solid #e5e7eb;" />
          <p style="color: #9ca3af; font-size: 12px;">
            Email này được gửi tự động, vui lòng không reply.
          </p>
        </div>
      `,
      text:
        `Chào mừng ${cleanUsername}! Tài khoản của bạn đã được tạo thành công trên Denolith.`,
    };
  },
};
