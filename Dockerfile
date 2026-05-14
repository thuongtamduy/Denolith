# Sử dụng base image Deno chính thức (Debian based để tương thích Prisma Engine)
FROM denoland/deno:2.7.14

# Thiết lập thư mục làm việc trong Container
WORKDIR /app

# User deno đã được tạo sẵn trong image denoland/deno:alpine
# Cache dependencies — chạy với quyền root (bắt buộc để deno install)
COPY deno.json deno.lock ./

RUN deno install

# Copy source code và chuyển quyền sở hữu sang user deno ngay lập tức
COPY --chown=deno:deno . .

# Generate Prisma Client & Type-check
RUN DIRECT_URL="postgresql://dummy" deno task prisma:generate
RUN deno check main.ts

# Biến môi trường mặc định
ENV PORT=3000
EXPOSE 3000

# Chuyển sang user non-root TRƯỚC khi chạy app — Principle of Least Privilege
RUN chown -R deno:deno /app
USER deno

# Khởi động ứng dụng (chế độ chạy thật)
CMD ["run", "-A", "main.ts"]
