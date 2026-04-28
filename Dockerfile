# Sử dụng base image Deno chính thức (bản alpine siêu nhẹ)
FROM denoland/deno:alpine

# Thiết lập thư mục làm việc trong Container
WORKDIR /app

# Cache dependencies (Tối ưu hóa thời gian build)
COPY deno.json deno.lock ./
RUN deno install

# Copy toàn bộ source code vào
COPY . .

# Biên dịch trước để bắt lỗi type và tối ưu tốc độ khởi động
RUN deno check main.ts

# Biến môi trường mặc định
ENV PORT=3000
EXPOSE 3000

# Khởi động ứng dụng (chế độ chạy thật)
CMD ["run", "-A", "--env", "main.ts"]
