/**
 * GS1 바코드/DataMatrix 파서
 * 
 * GS1 Application Identifiers (AI):
 * - (01) GTIN: 제품 코드 (14자리)
 * - (10) Lot/Batch Number: 로트번호 (가변)
 * - (11) Production Date: 제조일자 (YYMMDD)
 * - (17) Expiration Date: 유효기한 (YYMMDD)
 * - (21) Serial Number: 일련번호 (가변)
 * 
 * FNC1 구분자: GS (ASCII 29, \x1D) 또는 생략
 */

// GS1 AI 정의
const GS1_AI = {
    '01': { name: 'gtin', length: 14, description: '제품코드 (GTIN)' },
    '10': { name: 'lotNumber', variable: true, description: '로트번호' },
    '11': { name: 'productionDate', length: 6, description: '제조일자' },
    '17': { name: 'expirationDate', length: 6, description: '유효기한' },
    '21': { name: 'serialNumber', variable: true, description: '일련번호' },
};

// 가변 길이 AI 목록
const VARIABLE_LENGTH_AIS = ['10', '21'];

/**
 * YYMMDD 형식을 Date 객체로 변환
 */
const parseGS1Date = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return null;

    const yy = parseInt(dateStr.substring(0, 2), 10);
    const mm = parseInt(dateStr.substring(2, 4), 10);
    const dd = parseInt(dateStr.substring(4, 6), 10);

    // 2000년대 처리 (00-99 -> 2000-2099)
    const year = 2000 + yy;

    // 유효한 날짜인지 확인
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

    return new Date(year, mm - 1, dd);
};

/**
 * Date를 YYYY-MM-DD 형식 문자열로 변환
 */
const formatDateToISO = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * 제조일로부터 유효기한 계산 (기본 2년)
 */
const calculateExpirationFromProduction = (productionDate, monthsToAdd = 24) => {
    if (!productionDate) return null;
    const expDate = new Date(productionDate);
    expDate.setMonth(expDate.getMonth() + monthsToAdd);
    return expDate;
};

/**
 * GS1 바코드 문자열 파싱 (개선된 버전)
 * @param {string} code - 스캔된 GS1 바코드 문자열
 * @returns {object} 파싱된 데이터
 */
export const parseGS1 = (code) => {
    if (!code || typeof code !== 'string') {
        return { success: false, error: '유효하지 않은 코드입니다' };
    }

    // 전처리: GS구분자, 괄호, 공백, 하이픈 제거 (GS1 표준 데이터 클렌징)
    let cleanedCode = code
        .replace(/\x1D/g, '')     // GS 구분자
        .replace(/\(/g, '')       // 여는 괄호
        .replace(/\)/g, '')       // 닫는 괄호
        .replace(/\s/g, '')       // 공백
        .replace(/-/g, '')        // 하이픈 (시리얼 등에 있을 수 있음)
        .replace(/^\]C1/, '')     // GS1-128 접두사
        .replace(/^\]d2/, '');    // DataMatrix 접두사

    // JSON 형식인 경우 (시스템 생성 QR 코드)
    if (cleanedCode.startsWith('{')) {
        try {
            const parsed = JSON.parse(code); // 원본 code를 파싱 (JSON은 중괄호 유지 필요)
            return {
                success: true,
                isSystemQR: true,
                gtin: parsed.barcode,
                productName: parsed.name,
                category: parsed.category,
                raw: code
            };
        } catch (e) {
            // JSON이 아니면 계속 진행
        }
    }

    const result = {
        success: true,
        isGS1: true,
        raw: code,
        cleaned: cleanedCode
    };

    let position = 0;
    const workingCode = cleanedCode;

    while (position < workingCode.length) {
        // 2자리 AI 확인
        const ai2 = workingCode.substring(position, position + 2);

        if (GS1_AI[ai2]) {
            const aiInfo = GS1_AI[ai2];
            position += 2;

            if (aiInfo.variable) {
                // 가변 길이 필드 처리
                // 다음 고정길이 AI를 찾아서 끝 위치 결정
                let endPos = workingCode.length;

                // 1단계: AI 11 또는 17 (날짜 관련)을 먼저 전체 탐색
                for (let i = position + 1; i < workingCode.length - 7; i++) {
                    const possibleAI = workingCode.substring(i, i + 2);
                    const remainingAfterAI = workingCode.substring(i + 2);

                    if ((possibleAI === '11' || possibleAI === '17') && remainingAfterAI.length >= 6) {
                        const dateCandidate = remainingAfterAI.substring(0, 6);
                        if (/^\d{6}$/.test(dateCandidate)) {
                            endPos = i;
                            break;
                        }
                    }
                }

                // 2단계: AI 11/17을 못 찾았으면 AI 01 또는 가변 AI 탐색
                if (endPos === workingCode.length) {
                    for (let i = position + 1; i < workingCode.length - 1; i++) {
                        const possibleAI = workingCode.substring(i, i + 2);
                        const remainingAfterAI = workingCode.substring(i + 2);

                        // AI 01 (GTIN) - 뒤에 14자리 숫자가 있어야 함
                        if (possibleAI === '01' && remainingAfterAI.length >= 14) {
                            if (/^\d{14}/.test(remainingAfterAI)) {
                                endPos = i;
                                break;
                            }
                        }

                        // 가변 길이 AI (10, 21) - 문자가 올 수 있음
                        if ((possibleAI === '10' || possibleAI === '21') && i > position + 2) {
                            endPos = i;
                            break;
                        }
                    }
                }

                result[aiInfo.name] = workingCode.substring(position, endPos);
                position = endPos;
            } else {
                // 고정 길이
                result[aiInfo.name] = workingCode.substring(position, position + aiInfo.length);
                position += aiInfo.length;
            }
        } else {
            // 알 수 없는 문자 - 스킵
            position++;
        }
    }

    // 날짜 변환
    if (result.expirationDate) {
        const expDate = parseGS1Date(result.expirationDate);
        result.expirationDateFormatted = formatDateToISO(expDate);
        result.expirationDateDisplay = expDate ?
            `${expDate.getFullYear()}.${String(expDate.getMonth() + 1).padStart(2, '0')}.${String(expDate.getDate()).padStart(2, '0')}` : '';
    }

    if (result.productionDate) {
        const prodDate = parseGS1Date(result.productionDate);
        result.productionDateFormatted = formatDateToISO(prodDate);
        result.productionDateDisplay = prodDate ?
            `${prodDate.getFullYear()}.${String(prodDate.getMonth() + 1).padStart(2, '0')}.${String(prodDate.getDate()).padStart(2, '0')}` : '';

        // 유효기한이 없고 제조일이 있으면 제조일 + 24개월로 계산
        if (!result.expirationDate && prodDate) {
            const calculatedExpDate = calculateExpirationFromProduction(prodDate, 24);
            result.expirationDateFormatted = formatDateToISO(calculatedExpDate);
            result.expirationDateDisplay = calculatedExpDate ?
                `${calculatedExpDate.getFullYear()}.${String(calculatedExpDate.getMonth() + 1).padStart(2, '0')}.${String(calculatedExpDate.getDate()).padStart(2, '0')}` : '';
            result.expirationCalculated = true;
        }
    }

    // AI 17 (유효기한)이 없고 AI 21 (일련번호)이 6자리 날짜 형식이면 유효기한으로 사용
    if (!result.expirationDate && result.serialNumber && result.serialNumber.length === 6) {
        const serialAsDate = parseGS1Date(result.serialNumber);
        if (serialAsDate) {
            result.expirationDate = result.serialNumber;
            result.expirationDateFormatted = formatDateToISO(serialAsDate);
            result.expirationDateDisplay = serialAsDate ?
                `${serialAsDate.getFullYear()}.${String(serialAsDate.getMonth() + 1).padStart(2, '0')}.${String(serialAsDate.getDate()).padStart(2, '0')}` : '';
            result.expirationFromSerial = true; // 일련번호에서 추출됨 표시
        }
    }

    return result;
};

/**
 * 로트번호 자동 생성
 * 형식: L + YYMMDD + HHMMSS
 */
export const generateLotNumber = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    return `L${yy}${mm}${dd}${hh}${mi}${ss}`;
};

export default parseGS1;
