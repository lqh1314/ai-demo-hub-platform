# ---- 后端镜像：NestJS + Prisma ----
FROM node:20-alpine AS build
WORKDIR /app
# 先拷依赖清单以利用层缓存（workspace 根清单也一并拷入时按单包构建）
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund --ignore-scripts && npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund --ignore-scripts && npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
# 入口为 dist/src/main.js（rootDir=. 时 src/prisma 一同编译，种子在 dist/prisma/seed.js）
CMD ["node", "dist/src/main.js"]
