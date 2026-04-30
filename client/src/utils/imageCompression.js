/**
 * 사진 업로드 전 클라이언트 압축 유틸리티
 *
 * 목적: 5MB → 200KB 수준으로 줄여 업로드 속도/저장공간 개선
 * 정책: 긴 변 1280px, JPEG quality 0.7 (장비 식별·외관 확인엔 충분)
 *
 * 사용:
 *   import { compressImageToBase64 } from '../../utils/imageCompression';
 *   const dataUrl = await compressImageToBase64(file);
 */

const DEFAULT_MAX_SIDE = 1280;
const DEFAULT_QUALITY = 0.7;
const DEFAULT_MIME = 'image/jpeg';

const SKIP_COMPRESS_TYPES = new Set(['image/gif', 'image/svg+xml']);

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

export async function compressImageToBase64(file, options = {}) {
    if (!file || !(file instanceof Blob)) {
        throw new Error('compressImageToBase64: 유효한 파일이 아닙니다');
    }

    const maxSide = options.maxSide || DEFAULT_MAX_SIDE;
    const quality = options.quality != null ? options.quality : DEFAULT_QUALITY;
    const mime = options.mime || DEFAULT_MIME;

    if (file.type && SKIP_COMPRESS_TYPES.has(file.type)) {
        return await readFileAsDataURL(file);
    }

    const originalDataUrl = await readFileAsDataURL(file);

    let img;
    try {
        img = await loadImage(originalDataUrl);
    } catch (e) {
        return originalDataUrl;
    }

    const longSide = Math.max(img.width, img.height);
    if (longSide <= maxSide && file.size && file.size < 300 * 1024) {
        return originalDataUrl;
    }

    const scale = longSide > maxSide ? maxSide / longSide : 1;
    const targetW = Math.round(img.width * scale);
    const targetH = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const compressed = canvas.toDataURL(mime, quality);

    if (compressed.length >= originalDataUrl.length) {
        return originalDataUrl;
    }

    return compressed;
}

export async function compressFiles(files, options) {
    const result = [];
    for (const f of files) {
        result.push(await compressImageToBase64(f, options));
    }
    return result;
}
