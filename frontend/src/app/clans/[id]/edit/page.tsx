'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'
import { avatarBg } from '@/lib/avatar'

const ACCENT = '#22C55E'
const CARD = '#0f0f15'
const REGIONS = ['ru', 'ua', 'kz', 'by', 'uz', 'az', 'am', 'ge', 'kg', 'tj', 'tm', 'md', 'tr', 'de', 'us', 'gb', 'fr', 'pl', 'br', 'cn']
const LANGS = [
  { code: 'ru', label: 'Русский' }, { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' }, { code: 'kz', label: 'Қазақша' },
]
function clanGrad(rating: number) {
  if (rating >= 1600) return ['#A855F7', '#E8092E']
  if (rating >= 1300) return ['#F59E0B', '#EF4444']
  if (rating >= 1100) return ['#22C55E', '#0EA5E9']
  return ['#475569', '#64748B']
}

export default function EditClanPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [tag, setTag] = useState('')
  const [rating, setRating] = useState(1000)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [region, setRegion] = useState('')
  const [language, setLanguage] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const c = (await api.get(`/clans/${id}`)).data
        if (c.myRole !== 'leader') { router.replace(`/clans/${id}`); return }
        setTag(c.tag); setRating(c.rating); setName(c.name); setDesc(c.description || '')
        setRegion(c.region || ''); setLanguage(c.language || ''); setAvatarUrl(c.avatarUrl)
      } catch { router.replace('/clans') } finally { setLoading(false) }
    })()
  }, [id, router])

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setErr(null)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const token = localStorage.getItem('condr_faceit_token')
      const res = await fetch('/api/clans/avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Ошибка загрузки')
      setAvatarUrl((await res.json()).avatarUrl)
    } catch (e: any) { setErr(e?.message || 'Ошибка загрузки') } finally { setUploading(false) }
  }

  const nameOk = name.trim().length >= 2 && name.trim().length <= 50
  const save = async () => {
    if (!nameOk) return
    setSaving(true); setErr(null)
    try {
      await api.patch(`/clans/${id}`, { name: name.trim(), description: desc.trim(), avatarUrl: avatarUrl || '', region, language })
      router.push('/clans')
    } catch (e: any) { setErr(e?.response?.data?.message || 'Не удалось сохранить') } finally { setSaving(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#6B7280' }}>Загрузка…</div>
  const [g1, g2] = clanGrad(rating)

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
        <Icon name="chevronLeft" size={18} color="#9CA3AF" /> Назад
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>Редактирование клана</h1>

      <div style={{ background: CARD, borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: 64, height: 64, borderRadius: 17, background: avatarBg(avatarUrl) ? avatarBg(avatarUrl)! : `linear-gradient(135deg, ${g1}, ${g2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              {!avatarUrl && <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{tag.slice(0, 2)}</span>}
            </div>
            <div style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a0a0f' }}>
              <Icon name="camera" size={13} color="#fff" />
            </div>
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>[{tag}] · эмблема</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{uploading ? 'Загрузка…' : 'Тэг изменить нельзя'}</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
        </div>

        <Field label="Название" hint={`${name.length}/50`}>
          <input value={name} onChange={e => setName(e.target.value.slice(0, 50))} style={inputStyle(name.length > 0 && !nameOk)} />
        </Field>
        <Field label="Описание" hint={`${desc.length}/500`}>
          <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))} rows={3} style={{ ...inputStyle(false), resize: 'none', lineHeight: 1.45 }} />
        </Field>
        <Field label="Регион">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REGIONS.map(r => (
              <button key={r} onClick={() => setRegion(region === r ? '' : r)} style={{ padding: 4, borderRadius: 8, cursor: 'pointer', background: region === r ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${region === r ? ACCENT : 'transparent'}`, lineHeight: 0 }}>
                <Flag code={r} size={18} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Язык">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLanguage(language === l.code ? '' : l.code)} style={{ padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: language === l.code ? '#fff' : '#9CA3AF', background: language === l.code ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${language === l.code ? ACCENT : 'transparent'}` }}>
                {l.label}
              </button>
            ))}
          </div>
        </Field>

        {err && <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{err}</div>}

        <button onClick={save} disabled={!nameOk || saving} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: nameOk && !saving ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: nameOk ? `linear-gradient(135deg, ${ACCENT}, #0EA5E9)` : 'rgba(255,255,255,0.06)', opacity: nameOk ? 1 : 0.5 }}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: '#4B5563' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
function inputStyle(error: boolean): React.CSSProperties {
  return { width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.08)'}`, outline: 'none' }
}
