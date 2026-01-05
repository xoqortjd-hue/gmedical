# 2026-01-02 AWS 배포 및 트러블슈팅 현황 보고서

## 1. 개요
*   **작업 목표**: AWS EC2 인스턴스에 'Medical Inventory System' 배포 및 HTTPS(Cloudflare) 설정
*   **현재 상태**: ⚠️ **배포 완료했으나 502 Bad Gateway 발생 중**
    *   서버 인프라 구축 완료 (EC2, Node.js, PM2)
    *   Cloudflare Tunnel 정상 연결됨 (HTTPS URL 생성)
    *   **문제**: 백엔드 앱이 DB 파일 누락으로 인해 실행되지 않음

## 2. 인프라 접속 정보
| 항목 | 내용 | 비고 |
|------|------|------|
| **AWS EC2 IP** | `15.165.161.194` | Ubuntu 24.04 LTS |
| **SSH 키 경로** | `c:\Users\user\.gemini\antigravity\scratch\medical-inventory-system\medical-key-2026` | 접속 테스트 완료 |
| **HTTPS URL** | `https://interracial-conversations-blank-examining.trycloudflare.com` | Cloudflare Quick Tunnel |
| **앱 포트** | `5000` | 80 -> 5000 포트포워딩 적용됨 |

## 3. 발생한 문제 및 원인 분석

### 🔴 증상 1: 502 Bad Gateway
*   **현상**: HTTPS URL 접속 시 Cloudflare 502 에러 화면 노출.
*   **원인**: Cloudflare 데몬은 살아있으나, 트래픽을 전달받아야 할 로컬 앱(`localhost:5000`)이 죽어있거나 응답하지 않음.

### 🔴 증상 2: PM2 에러 로그 (SQLITE_CANTOPEN)
*   **로그**: `Error: SQLITE_CANTOPEN: unable to open database file`
*   **원인**: 초기 배포 파일(`deploy.zip`)을 만들 때 **`database/` 폴더가 누락됨.**
*   **상세**: 서버 코드(`server.js`)는 `database/inventory.db`를 찾으나 파일이 없어 크래시 발생 -> PM2가 계속 재시작 시도 -> 연결 거부됨.

### 🟡 AMI 백업본 관련 확인 사항
*   **사용자 우려**: AMI 백업본 사용으로 인한 설정 충돌(SSH, 네트워크)이나 용량 부족 가능성 제기.
*   **검증 결과**:
    *   SSH 접속이 원활함 -> 네트워크/키 설정 충돌 없음.
    *   디스크 여유 공간 4.6GB 확인됨 -> 용량 부족 아님.
    *   **결론**: AMI 문제가 아니라, 단순히 **배포 파일 누락 및 압축 해제 꼬임** 문제입니다.

## 4. 해결 방안 (Next Steps)
다음 작업 시 **클린 재설치**를 진행하면 문제가 100% 해결됩니다. 관련 파일(`deploy.zip`, `db.zip`)은 이미 서버로 전송해 두었습니다.

### ✅ 작업 순서 가이드
터미널에서 SSH 접속 후 아래 명령어를 차례로 실행하세요.

**1. SSH 접속**
```powershell
ssh -i "c:\Users\user\.gemini\antigravity\scratch\medical-inventory-system\medical-key-2026" -o StrictHostKeyChecking=no ubuntu@15.165.161.194
```

**2. 기존 폴더 정리 및 파일 복구 (Clean Install)**
```bash
# 1. 임시 백업 폴더 생성 및 압축 파일 피신
mkdir -p ~/temp_backup
mv ~/medical-inventory-system/*.zip ~/temp_backup/

# 2. 꼬인 폴더 완전 삭제
rm -rf ~/medical-inventory-system

# 3. 폴더 재생성 및 파일 원복
mkdir ~/medical-inventory-system
mv ~/temp_backup/*.zip ~/medical-inventory-system/
rmdir ~/temp_backup

# 4. 압축 해제 (코드 + DB)
cd ~/medical-inventory-system
unzip -o deploy.zip
unzip -o db.zip       # <--- 핵심! 이게 풀려야 DB 에러가 사라짐

# 5. 의존성 설치
npm install --production
```

**3. 프로세스 재시작**
```bash
# 기존 프로세스 삭제 후 재시작
pm2 delete inventory-system || true
pm2 start server.js --name "inventory-system"
pm2 save

# Cloudflare 터널 확인 (필요시 재시작)
pm2 restart cloudflare-tunnel
```

## 5. 문제 해결 검증
위 과정 완료 후 다음을 확인하세요:
1. `pm2 list`에서 `inventory-system` 상태가 `online`인지 확인.
2. `pm2 logs inventory-system`에서 `✅ SQLite 데이터베이스 연결 성공` 메시지 확인.
3. HTTPS URL 접속 시 메인 페이지 로딩 확인.
