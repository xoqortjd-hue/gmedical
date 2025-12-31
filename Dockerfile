# 의약품 재고관리 시스템
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 백엔드 의존성 설치
COPY package*.json ./
RUN npm install --production

# 프론트엔드 빌드
COPY client/package*.json ./client/
RUN cd client && npm install

# 소스 코드 복사
COPY . .

# 프론트엔드 빌드
RUN cd client && npm run build

# 데이터베이스 초기화
RUN npm run init-db

# 포트 설정
EXPOSE 5000

# 서버 실행
CMD ["npm", "start"]
