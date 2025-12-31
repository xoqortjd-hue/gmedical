import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 스마트폰 흔들기 감지 Hook
 * DeviceMotionEvent API를 사용하여 가속도 변화를 감지하고
 * 흔들기 제스처 발생 시 지정된 페이지로 이동
 */
const useShakeDetector = (options = {}) => {
    const {
        threshold = 15,          // 흔들기 감지 임계값 (가속도 변화량)
        timeout = 1000,          // 흔들기 간격 (ms) - 연속 감지 방지
        targetPath = '/mobile/home',  // 이동할 페이지
        enabled = true           // 활성화 여부
    } = options;

    const navigate = useNavigate();
    const location = useLocation();
    const lastShakeTime = useRef(0);
    const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
    const permissionGranted = useRef(false);

    // 흔들기 감지 시 실행할 함수
    const handleShake = useCallback(() => {
        const now = Date.now();

        // 쿨다운 시간 체크 (연속 감지 방지)
        if (now - lastShakeTime.current < timeout) {
            return;
        }

        // 이미 목표 페이지에 있으면 무시
        if (location.pathname === targetPath) {
            return;
        }

        lastShakeTime.current = now;

        // 햅틱 피드백 (지원하는 경우)
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // 목표 페이지로 이동
        navigate(targetPath);

        console.log('🔔 Shake detected! Navigating to:', targetPath);
    }, [navigate, location.pathname, targetPath, timeout]);

    // DeviceMotion 이벤트 핸들러
    const handleMotion = useCallback((event) => {
        if (!enabled) return;

        const { accelerationIncludingGravity } = event;

        if (!accelerationIncludingGravity) return;

        const { x, y, z } = accelerationIncludingGravity;

        // null 체크
        if (x === null || y === null || z === null) return;

        // 이전 가속도와의 변화량 계산
        const deltaX = Math.abs(x - lastAcceleration.current.x);
        const deltaY = Math.abs(y - lastAcceleration.current.y);
        const deltaZ = Math.abs(z - lastAcceleration.current.z);

        // 현재 가속도 저장
        lastAcceleration.current = { x, y, z };

        // 총 변화량
        const totalDelta = deltaX + deltaY + deltaZ;

        // 임계값 초과 시 흔들기로 판단
        if (totalDelta > threshold) {
            handleShake();
        }
    }, [enabled, threshold, handleShake]);

    // iOS 13+ 권한 요청
    const requestPermission = useCallback(async () => {
        // iOS 13+ 에서는 권한 요청 필요
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    permissionGranted.current = true;
                    return true;
                } else {
                    console.warn('DeviceMotion permission denied');
                    return false;
                }
            } catch (error) {
                console.error('DeviceMotion permission error:', error);
                return false;
            }
        }
        // Android 및 구형 iOS는 권한 요청 불필요
        permissionGranted.current = true;
        return true;
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // 모바일 기기 체크
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );

        if (!isMobile) {
            console.log('Shake detection: Desktop detected, skipping');
            return;
        }

        // HTTPS 체크 (DeviceMotion은 HTTPS에서만 작동)
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            console.warn('Shake detection requires HTTPS');
            return;
        }

        // 이벤트 리스너 등록
        const setupListener = async () => {
            const hasPermission = await requestPermission();

            if (hasPermission) {
                window.addEventListener('devicemotion', handleMotion);
                console.log('✅ Shake detection enabled');
            }
        };

        setupListener();

        // Cleanup
        return () => {
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [enabled, handleMotion, requestPermission]);

    return { requestPermission };
};

export default useShakeDetector;
