#!/bin/bash

echo "🚀 의약품 재고관리 시스템 설치 시작..."

# 1. 백엔드 의존성 설치
echo "📦 백엔드 의존성 설치 중..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 백엔드 의존성 설치 실패"
    exit 1
fi

# 2. 프론트엔드 의존성 설치
echo "📦 프론트엔드 의존성 설치 중..."
cd client
npm install

if [ $? -ne 0 ]; then
    echo "❌ 프론트엔드 의존성 설치 실패"
    exit 1
fi

cd ..

# 3. 데이터베이스 초기화
echo "🗄️ 데이터베이스 초기화 중..."
npm run init-db

if [ $? -ne 0 ]; then
    echo "❌ 데이터베이스 초기화 실패"
    exit 1
fi

echo "✅ 설치 완료!"
echo ""
echo "🎉 실행 방법:"
echo "  1. 백엔드 서버: npm run dev"
echo "  2. 프론트엔드 (새 터미널): cd client && npm start"
echo "  3. 브라우저에서 http://localhost:3000 접속"
echo ""
echo "📚 더 자세한 정보는 README.md를 참고하세요"
