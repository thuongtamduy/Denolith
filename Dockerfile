# Sử dụng base image Deno chính thức (bản alpine siêu nhẹ)
FROM denoland/deno:alpine

# Thiết lập thư mục làm việc trong Container
WORKDIR /app

# Tạo user non-root TRƯỚC KHI copy bất kỳ file nào (CIS Benchmark)
RUN addgroup -S deno && adduser -S deno -G deno

# Cache dependencies — chạy với quyền root (bắt buộc để deno install)
COPY deno.json deno.lock ./
RUN deno install

# Copy source code và chuyển quyền sở hữu sang user deno ngay lập tức
COPY --chown=deno:deno . .

# Type-check trước khi chạy để bắt lỗi sớm (vẫn dùng root cho build step)
RUN deno check main.ts

# Biến môi trường mặc định
ENV PORT=3000
EXPOSE 3000

# Chuyển sang user non-root TRƯỚC khi chạy app — Principle of Least Privilege
USER deno

# Khởi động ứng dụng (chế độ chạy thật)
CMD ["run", "-A", "--env", "main.ts"]
