import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * 그룹/서브그룹 이름 인라인 편집.
 *
 * 두 가지 모드:
 *   mode='subgroup' (실제 DB 변경):
 *     - oldName 으로 시작하는 모든 제품의 prefix 일괄 변경
 *     - POST /api/products/bulk-rename-base (dry_run 으로 preview 후 적용)
 *
 *   mode='family' (UI 라벨만, localStorage):
 *     - 코드 하드코딩된 EQUIPMENT_FAMILIES 라벨을 브라우저 단위로 오버라이드
 *     - 다른 PC/사용자엔 반영 안됨 (DB 미보관)
 *
 * Props:
 *   mode               'subgroup' | 'family'
 *   currentName        현재 표시 중인 이름
 *   onSaved(newName)   성공 후 콜백 (목록 새로고침 등)
 *   labelStyle         라벨 텍스트 스타일
 *   familyKey          mode='family' 일 때 localStorage 키 (보통 keyword)
 */
function EditableGroupName({ mode, currentName, onSaved, labelStyle, familyKey }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(currentName || '');
    const [preview, setPreview] = useState(null); // [{id, from, to}, ...]
    const [previewing, setPreviewing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { setValue(currentName || ''); }, [currentName]);
    useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const start = (e) => {
        if (e) e.stopPropagation();
        setErr('');
        setPreview(null);
        setEditing(true);
    };

    const cancel = () => {
        setValue(currentName || '');
        setErr('');
        setPreview(null);
        setEditing(false);
    };

    const fetchPreview = async () => {
        const trimmed = (value || '').trim();
        if (!trimmed) { setErr('이름을 입력하세요'); return; }
        if (trimmed === currentName) { setEditing(false); return; }

        if (mode === 'family') {
            // family 라벨은 미리보기 필요 없음 (DB 영향 없음)
            applyFamilyOverride(trimmed);
            return;
        }

        setPreviewing(true);
        setErr('');
        try {
            const res = await axios.post('/api/products/bulk-rename-base', {
                from_base: currentName,
                to_base: trimmed,
                dry_run: true
            });
            setPreview(res.data.preview || []);
        } catch (e) {
            setErr(e.response?.data?.error || e.message || '미리보기 실패');
        } finally {
            setPreviewing(false);
        }
    };

    const applyFamilyOverride = (newLabel) => {
        try {
            const key = `family_label_override:${familyKey || currentName}`;
            localStorage.setItem(key, newLabel);
            setEditing(false);
            onSaved && onSaved(newLabel);
        } catch (e) {
            setErr('localStorage 오류: ' + e.message);
        }
    };

    const applyBulkRename = async () => {
        const trimmed = (value || '').trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            const res = await axios.post('/api/products/bulk-rename-base', {
                from_base: currentName,
                to_base: trimmed,
                dry_run: false
            });
            setEditing(false);
            setPreview(null);
            onSaved && onSaved(trimmed, res.data.count || 0);
        } catch (e) {
            setErr(e.response?.data?.error || e.message || '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={labelStyle}>{currentName}</span>
                <button
                    onClick={start}
                    title={mode === 'family' ? '그룹 라벨 변경 (이 브라우저만)' : '서브그룹 일괄 이름 변경'}
                    style={{
                        padding: '0', background: 'transparent', border: 'none',
                        fontSize: '0.7rem', cursor: 'pointer',
                        color: mode === 'family' ? '#9ca3af' : '#6366f1',
                        lineHeight: 1
                    }}
                >
                    ✎
                </button>
            </span>
        );
    }

    // family 모드: 단순 input + 저장
    if (mode === 'family') {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') applyFamilyOverride((value || '').trim());
                        else if (e.key === 'Escape') cancel();
                    }}
                    style={{
                        padding: '0.25rem 0.5rem',
                        border: '1.5px solid #f59e0b', borderRadius: '4px',
                        fontSize: 'inherit', fontFamily: 'inherit', minWidth: '140px'
                    }}
                />
                <button
                    onClick={() => applyFamilyOverride((value || '').trim())}
                    style={{
                        padding: '0.2rem 0.55rem', background: '#10b981', color: 'white',
                        border: 'none', borderRadius: '4px', fontSize: '0.75rem',
                        cursor: 'pointer', fontWeight: '600'
                    }}
                >
                    ✓ 적용
                </button>
                <button
                    onClick={cancel}
                    style={{
                        padding: '0.2rem 0.5rem', background: '#f3f4f6', color: '#374151',
                        border: '1px solid #d1d5db', borderRadius: '4px',
                        fontSize: '0.75rem', cursor: 'pointer'
                    }}
                >
                    취소
                </button>
                <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
                    ※ 이 브라우저에만 적용 (UI 라벨)
                </span>
                {err && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{err}</span>}
            </span>
        );
    }

    // subgroup 모드: input → preview → confirm
    return (
        <div style={{ display: 'inline-block', width: '100%' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setPreview(null); }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                            if (preview) applyBulkRename();
                            else fetchPreview();
                        } else if (e.key === 'Escape') cancel();
                    }}
                    disabled={saving || previewing}
                    style={{
                        padding: '0.25rem 0.5rem',
                        border: '1.5px solid #6366f1', borderRadius: '4px',
                        fontSize: 'inherit', fontFamily: 'inherit', minWidth: '140px'
                    }}
                />
                {!preview && (
                    <button
                        onClick={fetchPreview}
                        disabled={previewing || saving}
                        style={{
                            padding: '0.2rem 0.55rem', background: '#3b82f6', color: 'white',
                            border: 'none', borderRadius: '4px', fontSize: '0.75rem',
                            cursor: previewing ? 'wait' : 'pointer', fontWeight: '600'
                        }}
                    >
                        {previewing ? '...' : '🔍 미리보기'}
                    </button>
                )}
                {preview && (
                    <>
                        <button
                            onClick={applyBulkRename}
                            disabled={saving}
                            style={{
                                padding: '0.2rem 0.55rem', background: '#10b981', color: 'white',
                                border: 'none', borderRadius: '4px', fontSize: '0.75rem',
                                cursor: saving ? 'wait' : 'pointer', fontWeight: '600'
                            }}
                        >
                            {saving ? '...' : `✓ ${preview.length}건 일괄 변경`}
                        </button>
                    </>
                )}
                <button
                    onClick={cancel}
                    disabled={saving}
                    style={{
                        padding: '0.2rem 0.5rem', background: '#f3f4f6', color: '#374151',
                        border: '1px solid #d1d5db', borderRadius: '4px',
                        fontSize: '0.75rem', cursor: 'pointer'
                    }}
                >
                    취소
                </button>
                {err && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{err}</span>}
            </div>
            {preview && preview.length > 0 && (
                <div style={{
                    marginTop: '0.5rem', padding: '0.5rem 0.7rem',
                    background: '#f0fdf4', border: '1px solid #10b981',
                    borderRadius: '6px', fontSize: '0.75rem',
                    maxHeight: '160px', overflowY: 'auto'
                }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#065f46' }}>
                        영향받을 제품 {preview.length}건:
                    </div>
                    {preview.slice(0, 10).map((p, i) => (
                        <div key={i} style={{ color: '#374151', lineHeight: 1.6 }}>
                            • <s style={{ color: '#9ca3af' }}>{p.from}</s> → <b>{p.to}</b>
                        </div>
                    ))}
                    {preview.length > 10 && (
                        <div style={{ color: '#6b7280', marginTop: '0.25rem', fontStyle: 'italic' }}>
                            ... 및 {preview.length - 10}건 더
                        </div>
                    )}
                </div>
            )}
            {preview && preview.length === 0 && (
                <div style={{
                    marginTop: '0.5rem', padding: '0.4rem 0.7rem',
                    background: '#fef3c7', borderRadius: '6px',
                    fontSize: '0.75rem', color: '#78350f'
                }}>
                    ⚠️ 변경 대상 제품이 없습니다 (이름 패턴 확인)
                </div>
            )}
        </div>
    );
}

// helper: localStorage 오버라이드 가져오기
export function getFamilyOverride(familyKey) {
    try {
        return localStorage.getItem(`family_label_override:${familyKey}`) || null;
    } catch { return null; }
}

export default EditableGroupName;
