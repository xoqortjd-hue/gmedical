#!/bin/bash

# 의약품 재고관리 시스템 실행 스크립트

echo "🏥 의약품 재고관리 시스템 시작..."

# 터미널 창 2개에서 실행하는 함수
start_system() {
    echo "🔄 시스템 시작 중..."
    
    # 백엔드 서버 시작 (백그라운드)
    echo "🖥️ 백엔드 서버 시작 중... (포트 5000)"
    npm run dev &
    BACKEND_PID=$!
    
    # 잠시 대기 (서버 시작 시간)
    sleep 3
    
    # 프론트엔드 서버 시작 (백그라운드)
    echo "🌐 프론트엔드 서버 시작 중... (포트 3000)"
    cd client
    npm start &
    FRONTEND_PID=$!
    cd ..
    
    echo "✅ 시스템이 시작되었습니다!"
    echo "📱 브라우저에서 http://localhost:3000 으로 접속하세요"
    echo ""
    echo "⏹️ 시스템 종료: Ctrl+C를 누르세요"
    
    # 종료 시그널 처리
    trap 'echo "🔄 시스템 종료 중..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT
    
    # 프로세스가 종료될 때까지 대기
    wait
}

# 데이터베이스 확인
if [ ! -f "database/inventory.db" ]; then
    echo "⚠️ 데이터베이스가 없습니다. 초기화를 실행합니다..."
    npm run init-db
fi

# 시스템 시작
start_system
