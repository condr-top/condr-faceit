'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Icon, IconName } from '@/components/ui/Icon'

const ACCENT = '#E8092E'
const CARD = '#0f0f15'

interface DailyMission {
  userMissionId: number; missionId: number; title: string; description: string
  difficulty: 'easy' | 'medium' | 'hard'; goal: number; rewardCoins: number
  progress: number; isCompleted: boolean; isClaimed: boolean
}
interface DailyData { missions: DailyMission[]; allCompleted: boolean; bonusClaimed: boolean; bonusCoins: number; missionStreak: number; msUntilReset: number }

type AchCat = 'progress' | 'combat' | 'rank' | 'streak' | 'fun'
interface Achievement {
  key: string; title: string; description: string; icon: string; color: string
  category: AchCat; goal: number; unit: string; rewardCoins: number; secret: boolean
  current: number; unlocked: boolean; claimed: boolean; unlockedAt: string | null
}
interface AchData { achievements: Achievement[]; unlocked: number; total: number; claimable: number }

const DIFF: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: '#4ADE80' }, medium: { label: 'Medium', color: '#FACC15' }, hard: { label: 'Hard', color: '#F97316' },
}
const CATS: { key: AchCat | 'all'; label: string; color: string }[] = [
  { key: 'all', label: 'Все', color: '#9CA3AF' }, { key: 'progress', label: 'Прогресс', color: '#60A5FA' },
  { key: 'combat', label: 'Бой', color: '#E8092E' }, { key: 'rank', label: 'Ранг', color: '#A855F7' },
  { key: 'streak', label: 'Стрик', color: '#F59E0B' }, { key: 'fun', label: 'Веселье', color: '#EAB308' },
]

function Toast({ coins, label, onClose }: { coins: number; label?: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2600); return () => clearTimeout(t) }, [onClose])
  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.9 }}
      style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 80, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 16, background: 'rgba(20,20,26,0.97)', border: '1px solid rgba(234,179,8,0.4)', boxShadow: '0 16px 50px rgba(0,0,0,0.6)' }}>
      <Icon name="coins" size={20} color="#EAB308" />
      <div><div style={{ fontSize: 15, fontWeight: 900, color: '#EAB308' }}>+{coins} монет</div>{label && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</div>}</div>
    </motion.div>
  )
}

function fmtReset(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60)
  return `${h}ч ${m}м`
}

function DailyView({ onToast, refreshUser }: { onToast: (t: { coins: number; label?: string }) => void; refreshUser: () => void }) {
  const [data, setData] = useState<DailyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | 'bonus' | null>(null)
  const load = useCallback(async () => { try { setData((await api.get('/missions')).data) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])

  const claim = async (id: number) => { setBusy(id); try { const r = await api.post(`/missions/${id}/claim`); onToast({ coins: r.data.coins }); await load(); refreshUser() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(null) } }
  const claimBonus = async () => { setBusy('bonus'); try { const r = await api.post('/missions/daily-bonus'); onToast({ coins: r.data.coins, label: r.data.streakReward?.label ?? `Стрик: ${r.data.missionStreak} дней` }); await load(); refreshUser() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(null) } }

  if (loading) return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ height: 130, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />)}</div>
  if (!data) return null
  const done = data.missions.filter(m => m.isCompleted).length

  return (
    <div>
      {/* Streak + reset */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderRadius: 18, padding: '16px 20px', background: 'radial-gradient(120% 120% at 0% 0%, rgba(245,158,11,0.16), transparent 55%), #0c0c11', border: '1px solid rgba(245,158,11,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #F59E0B, #E8092E)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(245,158,11,0.4)' }}><Icon name="flame" size={24} color="#fff" /></div>
          <div><div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Серия дней</div><div style={{ fontSize: 26, fontWeight: 900, color: '#F59E0B', lineHeight: 1.1 }}>{data.missionStreak} 🔥</div></div>
        </div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#6B7280' }}>Сброс через</div><div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{fmtReset(data.msUntilReset)}</div><div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{done}/{data.missions.length} выполнено</div></div>
      </motion.div>

      {/* Missions grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {data.missions.map((m, i) => {
          const d = DIFF[m.difficulty]; const pct = Math.min((m.progress / m.goal) * 100, 100)
          const claimable = m.isCompleted && !m.isClaimed
          return (
            <motion.div key={m.userMissionId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              style={{ borderRadius: 18, padding: 18, position: 'relative', overflow: 'hidden', background: claimable ? `linear-gradient(135deg, ${d.color}14, ${CARD} 60%)` : CARD, border: `1px solid ${claimable ? d.color + '55' : 'rgba(255,255,255,0.06)'}`, opacity: m.isClaimed ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: d.color, background: `${d.color}1f`, padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.label}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 4 }}>+{m.rewardCoins} <Icon name="coins" size={13} /></span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 3 }}>{m.title}</div>
              <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12, lineHeight: 1.4 }}>{m.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 5 }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{m.progress} / {m.goal}</span>
                <span style={{ color: m.isCompleted ? '#22C55E' : '#6B7280' }}>{m.isCompleted ? 'Выполнено!' : `осталось ${m.goal - m.progress}`}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${d.color}, ${d.color}cc)`, boxShadow: m.isCompleted ? `0 0 8px ${d.color}88` : 'none' }} />
              </div>
              {claimable && (
                <button onClick={() => claim(m.userMissionId)} disabled={busy === m.userMissionId}
                  style={{ width: '100%', marginTop: 13, padding: '11px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${d.color}, ${d.color}aa)`, color: '#0a0a0f', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="gift" size={15} color="#0a0a0f" />{busy === m.userMissionId ? 'Получаем…' : 'Забрать награду'}
                </button>
              )}
              {m.isClaimed && <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="check" size={13} color="#22C55E" />Награда получена</div>}
            </motion.div>
          )
        })}
      </div>

      {/* Daily bonus */}
      <div style={{ borderRadius: 18, padding: 20, position: 'relative', overflow: 'hidden', background: 'radial-gradient(130% 120% at 100% 0%, rgba(234,179,8,0.16), transparent 55%), #0c0c11', border: `1px solid ${data.allCompleted && !data.bonusClaimed ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 15, background: 'linear-gradient(135deg, #EAB308, #ca8a04)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(234,179,8,0.4)' }}><Icon name="trophy" size={26} color="#1a1200" /></div>
          <div><div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>Дневной бонус</div><div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>Выполни все задания дня и забери <b style={{ color: '#EAB308' }}>+{data.bonusCoins}</b> монет</div></div>
        </div>
        {data.bonusClaimed ? (
          <span style={{ fontSize: 13, fontWeight: 800, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><Icon name="check" size={15} color="#22C55E" />Получен</span>
        ) : (
          <button onClick={claimBonus} disabled={!data.allCompleted || busy === 'bonus'}
            style={{ flexShrink: 0, padding: '13px 22px', borderRadius: 13, border: 'none', cursor: data.allCompleted ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 900, color: data.allCompleted ? '#1a1200' : '#4B5563', background: data.allCompleted ? 'linear-gradient(135deg, #EAB308, #ca8a04)' : 'rgba(255,255,255,0.05)' }}>
            {busy === 'bonus' ? '…' : 'Забрать бонус'}
          </button>
        )}
      </div>
    </div>
  )
}

function AchievementsView({ onToast, refreshUser }: { onToast: (t: { coins: number; label?: string }) => void; refreshUser: () => void }) {
  const [data, setData] = useState<AchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<AchCat | 'all'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => { try { setData((await api.get('/achievements')).data) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { load() }, [load])
  const claim = async (key: string) => { setBusy(key); try { const r = await api.post(`/achievements/${key}/claim`); onToast({ coins: r.data.coins, label: 'Достижение' }); await load(); refreshUser() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(null) } }

  if (loading) return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ height: 110, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />)}</div>
  if (!data) return null
  const pct = data.total ? Math.round((data.unlocked / data.total) * 100) : 0
  const list = cat === 'all' ? data.achievements : data.achievements.filter(a => a.category === cat)
  const sorted = [...list].sort((a, b) => { const sc = (x: Achievement) => (x.unlocked && !x.claimed ? 0 : x.claimed ? 2 : 1); return sc(a) !== sc(b) ? sc(a) - sc(b) : (b.current / b.goal) - (a.current / a.goal) })

  return (
    <div>
      <div style={{ borderRadius: 18, padding: 18, marginBottom: 14, background: 'radial-gradient(120% 120% at 0% 0%, rgba(34,197,94,0.18), transparent 50%), #0c0c11', border: '1px solid rgba(34,197,94,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div><div style={{ fontSize: 10, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Разблокировано</div><div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}><span style={{ color: '#22C55E' }}>{data.unlocked}</span><span style={{ color: '#374151', fontSize: 20 }}> / {data.total}</span></div></div>
          {data.claimable > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(234,179,8,0.14)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 900, color: '#EAB308' }}><Icon name="gift" size={14} color="#EAB308" />{data.claimable} к получению</span>}
        </div>
        <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #16a34a, #4ADE80)', boxShadow: '0 0 10px rgba(74,222,128,0.5)' }} /></div>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {CATS.map(ct => <button key={ct.key} onClick={() => setCat(ct.key)} style={{ padding: '8px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: cat === ct.key ? '#fff' : '#9CA3AF', background: cat === ct.key ? `${ct.color}26` : 'rgba(255,255,255,0.04)', border: `1px solid ${cat === ct.key ? ct.color : 'transparent'}` }}>{ct.label}</button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {sorted.map(a => {
          const locked = !a.unlocked, claimable = a.unlocked && !a.claimed, secretLocked = a.secret && locked, c = a.color
          const pctA = Math.min((a.current / a.goal) * 100, 100)
          const title = secretLocked ? '???' : a.title, desc = secretLocked ? 'Скрытое достижение' : a.description
          const iconName = (secretLocked ? 'help' : a.icon) as IconName
          return (
            <div key={a.key} style={{ borderRadius: 18, padding: 16, position: 'relative', overflow: 'hidden', background: claimable ? `linear-gradient(135deg, ${c}14, rgba(255,255,255,0.03) 60%)` : 'rgba(255,255,255,0.03)', border: `1px solid ${claimable ? c + '55' : 'rgba(255,255,255,0.06)'}`, opacity: a.claimed ? 0.72 : 1 }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', width: 50, height: 50, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.unlocked ? `linear-gradient(135deg, ${c}, ${c}88)` : 'rgba(255,255,255,0.05)', border: a.unlocked ? 'none' : '1px solid rgba(255,255,255,0.08)', boxShadow: a.unlocked ? `0 6px 18px ${c}44` : 'none' }}>
                  <Icon name={iconName} size={25} color={a.unlocked ? '#fff' : '#4B5563'} />
                  {a.claimed && <div style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: '50%', background: '#22C55E', border: '2px solid #0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={11} color="#fff" /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 900, color: a.unlocked ? '#fff' : '#9CA3AF' }}>{title}</span>
                    {locked && !secretLocked && <Icon name="lock" size={12} color="#4B5563" />}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.4, marginBottom: 9 }}>{desc}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: '#4B5563' }}>{secretLocked ? '???' : `${a.current.toLocaleString()} / ${a.goal.toLocaleString()}${a.unit ? ' ' + a.unit : ''}`}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 3 }}>+{a.rewardCoins} <Icon name="coins" size={11} /></span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${pctA}%` }} transition={{ duration: 0.9 }} style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${c}, ${c}cc)` }} /></div>
                </div>
              </div>
              {claimable && <button onClick={() => claim(a.key)} disabled={busy === a.key} style={{ width: '100%', marginTop: 13, padding: '10px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${c}, ${c}aa)`, color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="gift" size={15} color="#fff" />{busy === a.key ? 'Получаем…' : `Забрать ${a.rewardCoins} монет`}</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WebMissions() {
  const { refreshUser } = useAuthStore()
  const [view, setView] = useState<'daily' | 'achievements'>('daily')
  const [toast, setToast] = useState<{ coins: number; label?: string } | null>(null)

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}><Icon name="target" size={26} color={ACCENT} />Задания</h1>
        <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Ежедневные задания, дневной бонус и достижения.</div>
      </motion.div>

      <div style={{ display: 'inline-flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, marginBottom: 20 }}>
        {([['daily', 'Ежедневные'], ['achievements', 'Достижения']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: view === k ? '#fff' : '#9CA3AF', background: view === k ? `linear-gradient(135deg, ${ACCENT}, #b4001e)` : 'transparent', boxShadow: view === k ? `0 4px 14px ${ACCENT}44` : 'none', transition: 'all .2s' }}>{l}</button>
        ))}
      </div>

      {view === 'daily' ? <DailyView onToast={setToast} refreshUser={refreshUser} /> : <AchievementsView onToast={setToast} refreshUser={refreshUser} />}

      <AnimatePresence>{toast && <Toast coins={toast.coins} label={toast.label} onClose={() => setToast(null)} />}</AnimatePresence>
    </div>
  )
}
