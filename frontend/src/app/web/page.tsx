'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { connectSocket } from '@/lib/socket'
import { EloRing } from '@/components/ui/EloRing'
import { Logo } from '@/components/ui/Logo'
import { getEloRank, getRankProgress, ELO_RANKS } from '@/lib/eloRank'
import { Icon, IconName } from '@/components/ui/Icon'
import { PartyPanel, PartyDto, Invitation } from '@/components/party/PartyPanel'

const ACCENT = '#E8092E'
const CARD = '#0f0f15'

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0); const spring = useSpring(mv, { duration: 1200, bounce: 0 })
  const [d, setD] = useState(0)
  useEffect(() => { mv.set(value) }, [value])
  useEffect(() => spring.on('change', v => setD(Math.round(v))), [spring])
  return <>{d.toLocaleString()}</>
}

function StatChip({ label, value, color, icon }: { label: string; value: string; color: string; icon: IconName }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${color}26`, borderRadius: 16, padding: '16px 14px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '18%', right: '18%', height: 1, background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />
      <div style={{ position: 'absolute', top: -8, right: -6, opacity: 0.08 }}><Icon name={icon} size={44} color={color} /></div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Icon name={icon} size={16} color={color} /></div>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#4B5563', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

// Тайл-плитка раздела (Задания/Поддержка/Рейтинг/…)
function Tile({ icon, label, sub, color, onClick, delay = 0 }: { icon: IconName; label: string; sub: string; color: string; onClick: () => void; delay?: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', borderRadius: 16, border: `1px solid ${color}2a`, background: `radial-gradient(120% 120% at 0% 0%, ${color}12, transparent 55%), ${CARD}`, cursor: 'pointer', textAlign: 'left', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1, background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />
      <div style={{ position: 'absolute', top: -14, right: -10, opacity: 0.1, pointerEvents: 'none' }}><Icon name={icon} size={56} color={color} /></div>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}16`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}><Icon name={icon} size={20} color={color} /></div>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}><div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff' }}>{label}</div><div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 1 }}>{sub}</div></div>
      <Icon name="chevronRight" size={17} color="#4B5563" style={{ position: 'relative' }} />
    </motion.button>
  )
}

function SectionLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: '#E5E7EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: ACCENT, boxShadow: `0 0 8px ${ACCENT}88` }} />{children}
      </span>
      {sub && <span style={{ fontSize: 11, color: '#4B5563', fontWeight: 700 }}>{sub}</span>}
    </div>
  )
}

interface Lobby { matchId: number; players: { id: number; name: string }[]; slots: number; filled: number }
type Mode = 'normal' | 'cplq' | 'cpl'

export default function WebDashboard() {
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('normal')
  const [party, setParty] = useState<PartyDto | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])

  const fetchLobby = useCallback(() => { api.get('/matches/lobby').then(r => setLobby(r.data)).catch(() => {}) }, [])
  const loadParty = useCallback(() => { api.get('/party').then(r => { setParty(r.data?.party ?? null); setInvitations(r.data?.invitations ?? []) }).catch(() => {}) }, [])

  useEffect(() => {
    refreshUser(); fetchLobby(); loadParty()
    api.get('/matches/my-active').then(r => { if (r.data?.matchId) router.push(`/web/match/${r.data.matchId}`) }).catch(() => {})
    const t = setInterval(fetchLobby, 3000)
    const s = connectSocket()
    const onFound = (d: { matchId: number }) => router.push(`/web/match/${d.matchId}`)
    s.on('match_found', onFound)
    s.on('party_updated', loadParty)
    s.on('party_invite', loadParty)
    return () => { clearInterval(t); s.off('match_found', onFound); s.off('party_updated', loadParty); s.off('party_invite', loadParty) }
  }, [fetchLobby, loadParty])

  // Если доступ к выбранной лиге пропал — откатываемся к обычному режиму
  useEffect(() => {
    if ((mode === 'cpl' && !(user as any)?.cplAccess) || (mode === 'cplq' && !(user as any)?.cplqAccess)) setMode('normal')
  }, [(user as any)?.cplAccess, (user as any)?.cplqAccess, mode])

  if (!user) return null
  const rank = getEloRank(user.elo)
  const nextRank = ELO_RANKS.find(r => r.min > user.elo) || null
  const segPct = rank.max === Infinity ? 100 : Math.round(getRankProgress(user.elo) * 100)
  const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444'
  const wr = user.winRate, rating = Number(user.ratingOverall ?? 0), kd = Number(user.kdr ?? 0)
  const filled = lobby?.filled ?? 0, slots = lobby?.slots ?? 10
  const inLobby = !!lobby, full = inLobby && filled >= slots
  const hasParty = !!party && party.members.length > 1

  const join = async () => {
    // Отряд работает только в обычном режиме — запускает лидер
    if (mode === 'normal' && party && party.members.length >= 2) {
      if (!party.isLeader) { alert('Поиск запускает лидер отряда'); return }
      setBusy(true)
      try { const r = await api.post('/party/queue'); router.push(`/web/match/${r.data.matchId}`); return }
      catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setBusy(false); return }
    }
    setBusy(true)
    try {
      const body = mode === 'normal' ? {} : { league: mode }
      const r = await api.post('/matches/lobby/join', body)
      if (r.data?.id) { router.push(`/web/match/${r.data.id}`); return }
      fetchLobby()
    }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(false) }
  }
  const leave = async () => { setBusy(true); try { await api.post('/matches/lobby/leave') } catch {} finally { setLobby(null); fetchLobby(); setBusy(false) } }

  const tabs: { key: Mode; label: string; locked: boolean }[] = [
    { key: 'normal', label: 'Обычный', locked: false },
    { key: 'cplq', label: 'CPL-Q', locked: !(user as any).cplqAccess },
    { key: 'cpl', label: 'CPL', locked: !(user as any).cplAccess },
  ]
  const activeIdx = Math.max(0, tabs.findIndex(t => t.key === mode))
  const matchTitle = busy ? 'Подключаемся…' : mode === 'cpl' ? 'Найти матч · CPL' : mode === 'cplq' ? 'Найти матч · CPL-Q' : 'Найти матч'
  const matchSub = mode === 'cpl' ? 'CONDR Pro League · про-сцена' : mode === 'cplq' ? 'Квалификации в Pro League' : '5 на 5 · подбор по уровню'

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Привет, {user.gameNickname || user.firstName}</h1>
        <div style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Лобби и аккаунт — общие с приложением.</div>
      </motion.div>

      {/* HERO ELO CARD */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        style={{ borderRadius: 24, marginBottom: 18, overflow: 'hidden', position: 'relative', padding: 26,
          background: `radial-gradient(120% 130% at 0% 0%, ${rank.color}22, transparent 46%), radial-gradient(120% 130% at 100% 100%, ${rank.color}14, transparent 52%), linear-gradient(160deg, #0c0c11, #08080b)`,
          border: `1px solid ${rank.color}33`, boxShadow: `0 16px 50px ${rank.color}1a` }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <motion.div animate={{ x: [-160, 150, -80, 170, -160], y: [-50, 60, -66, 40, -50], opacity: [0.05, 0.1, 0.06, 0.09, 0.05] }} transition={{ duration: 42, repeat: Infinity, ease: 'easeInOut' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 80, repeat: Infinity, ease: 'linear' }} style={{ filter: `drop-shadow(0 0 22px ${rank.color}66)` }}><Logo size={260} color={rank.color} /></motion.div>
          </motion.div>
        </div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '18px 18px', WebkitMaskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)', maskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)' }} />
        <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '24%', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${rank.color}16, transparent)` }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Текущий рейтинг</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-3px', lineHeight: 0.9, color: '#fff', textShadow: `0 2px 26px ${rank.color}88` }}><AnimatedNumber value={user.elo} /></span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#6B7280' }}>ELO</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: rank.color, marginTop: 8 }}>{rank.label}</div>
            <div style={{ marginTop: 16, maxWidth: 420 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: '#6B7280', fontWeight: 700 }}>
                <span style={{ color: rank.color }}>{rank.label}</span>
                <span>{nextRank ? <>До {nextRank.label}: <b style={{ color: rank.color }}>{nextRank.min - user.elo}</b></> : 'Макс. ранг'}</span>
              </div>
              <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${segPct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rank.color}aa, ${rank.color})`, boxShadow: `0 0 10px ${rank.color}88` }} />
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <motion.div animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.1, 1] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', inset: -16, borderRadius: '50%', background: `radial-gradient(circle, ${rank.color}4a, transparent 70%)` }} />
            <div style={{ position: 'relative', filter: `drop-shadow(0 0 18px ${rank.color}99)` }}><EloRing elo={user.elo} size={118} showLabel={false} /></div>
          </div>
        </div>
      </motion.div>

      {/* GRID: play (left) + side (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* LEFT — play */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionLabel sub="Рейтинговый режим 5×5">Играть</SectionLabel>

          {/* Mode selector — sliding highlight */}
          {!inLobby && (
            <div style={{ position: 'relative', display: 'flex', background: 'rgba(255,255,255,0.035)', padding: 4, borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <motion.div initial={false} animate={{ x: `${activeIdx * 100}%` }} transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc((100% - 8px) / 3)', borderRadius: 10, background: 'linear-gradient(135deg, #E8092E, #b4001e)', boxShadow: '0 2px 10px rgba(232,9,46,0.35)', zIndex: 0, willChange: 'transform' }} />
              {tabs.map(m => {
                const active = mode === m.key
                return (
                  <button key={m.key} onClick={() => m.locked ? alert('Доступ к лиге выдаёт администратор') : setMode(m.key)}
                    style={{ flex: 1, position: 'relative', zIndex: 1, padding: '11px 0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 800, color: active ? '#fff' : m.locked ? '#4B5563' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color .25s ease' }}>
                    {m.locked && <Icon name="lock" size={12} color="#4B5563" />}{m.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Find match */}
          <div style={{ borderRadius: 22, padding: 24, position: 'relative', overflow: 'hidden', background: `radial-gradient(130% 120% at 0% 0%, ${ACCENT}1c, transparent 52%), ${CARD}`, border: `1px solid ${ACCENT}33` }}>
            <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.06 }}><Icon name="swords" size={140} color={ACCENT} /></div>
            <AnimatePresence mode="wait">
              {inLobby ? (
                <motion.div key="in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 9, height: 9, borderRadius: '50%', background: ACCENT }} />
                    <span style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{full ? 'Матч собран!' : 'Поиск игроков…'}</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{filled}/{slots}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 5, marginBottom: 16 }}>
                    {Array.from({ length: slots }).map((_, i) => <div key={i} style={{ height: 8, borderRadius: 4, background: i < filled ? ACCENT : 'rgba(255,255,255,0.08)', boxShadow: i < filled ? `0 0 8px ${ACCENT}88` : 'none', transition: 'background .3s' }} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => lobby && router.push(`/web/match/${lobby.matchId}`)} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)` }}>Открыть матч</button>
                    <button onClick={leave} disabled={busy} style={{ padding: '13px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выйти</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>{matchTitle}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{matchSub}{hasParty && mode === 'normal' ? ` · отряд ${party!.members.length}` : ''}</div>
                  </div>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={join} disabled={busy}
                    style={{ width: '100%', padding: '17px 0', borderRadius: 16, border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden', fontSize: 16, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)`, boxShadow: `0 8px 30px ${ACCENT}44, inset 0 1px 0 rgba(255,255,255,0.18)`, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                    {!busy && <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />}
                    <Icon name="swords" size={20} color="#fff" /> {matchTitle}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Party / squad */}
          {!inLobby && <PartyPanel party={party} invitations={invitations} refresh={loadParty} />}

          {/* Другой режим — CONDR DM */}
          <SectionLabel sub="Без рейтинга">Другие режимы</SectionLabel>
          <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => router.push('/web/dm')}
            style={{ width: '100%', borderRadius: 18, border: '1px solid rgba(232,9,46,0.22)', cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', background: 'radial-gradient(120% 120% at 0% 0%, rgba(232,9,46,0.12), transparent 55%), #0f0f15' }}>
            <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.55), transparent)' }} />
            <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'rgba(232,9,46,0.12)', border: '1px solid rgba(232,9,46,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="flame" size={24} color="#E8092E" /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>CONDR DM</div><div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 2 }}>Дезматч · быстрый разогрев</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 20, background: 'rgba(232,9,46,0.14)', border: '1px solid rgba(232,9,46,0.3)', fontSize: 12, fontWeight: 800, color: '#ff5267' }}>Играть<Icon name="chevronRight" size={14} color="#ff5267" /></div>
          </motion.button>
        </div>

        {/* RIGHT — side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <StatChip label="Матчи" value={String(user.matchesPlayed)} color="#60A5FA" icon="gamepad" />
            <StatChip label="Винрейт" value={`${wr}%`} color={wr >= 50 ? GREEN : YELLOW} icon="trendingUp" />
            <StatChip label="K/D" value={kd.toFixed(2)} color={kd > 1.1 ? GREEN : kd >= 0.9 ? YELLOW : RED} icon="swords" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(234,179,8,0.12), #0f0f15 65%)', border: '1px solid rgba(234,179,8,0.28)', borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(234,179,8,0.14)', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="coins" size={20} color="#EAB308" /></div>
              <div><div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Монеты</div><div style={{ fontSize: 22, fontWeight: 900, color: '#EAB308', lineHeight: 1 }}><AnimatedNumber value={user.coins} /></div></div>
            </div>
            <button onClick={() => router.push('/web/shop')} style={{ padding: '9px 16px', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 900, color: '#1a1200', background: 'linear-gradient(135deg, #EAB308, #ca8a04)' }}>Магазин</button>
          </div>

          <SectionLabel>Разделы</SectionLabel>
          <Tile icon="target" label="Задания" sub="Ежедневные · награды" color="#F59E0B" onClick={() => router.push('/web/missions')} delay={0.02} />
          <Tile icon="trophy" label="Рейтинг" sub="Таблица лидеров" color="#FBBF24" onClick={() => router.push('/web/leaderboard')} delay={0.05} />
          <Tile icon="shield" label="Кланы" sub="Мой клан · обзор" color="#34D399" onClick={() => router.push('/web/clans')} delay={0.08} />
          <Tile icon="users" label="Друзья" sub="Контакты · отряды" color="#C084FC" onClick={() => router.push('/web/friends')} delay={0.11} />
          <Tile icon="chat" label="Поддержка" sub="Помощь · FAQ" color="#60A5FA" onClick={() => router.push('/web/support')} delay={0.14} />
        </div>
      </div>
    </div>
  )
}
