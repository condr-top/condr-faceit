'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { useSheetDrag } from '@/lib/useSheetDrag'

const ACCENT = '#E8092E'
const ACCENT2 = '#b4001e'
const CARD = '#0f0f15'

export interface PartyMember {
  id: number; nickname: string; avatarUrl: string | null; elo: number
  isVerified: boolean; online: boolean; isLeader: boolean
}
export interface PartyDto {
  id: string; leaderId: number; isLeader: boolean; maxSize: number
  members: PartyMember[]; invites: PartyMember[]
}
export interface Invitation { partyId: string; leader: PartyMember; size: number }

// ── Bottom sheet shell ──────────────────────────────────────────────────────────
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const sheet = useSheetDrag(onClose)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: 'linear-gradient(180deg, #101016, #0a0a0f)', borderRadius: '26px 26px 0 0', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none', padding: 20, paddingBottom: 30, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 16px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ── Incoming invite banner ─────────────────────────────────────────────────────
function InviteBanner({ inv, onAccept, onDecline }: { inv: Invitation; onAccept: () => void; onDecline: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 16, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${ACCENT}1f, ${CARD} 65%)`, border: `1px solid ${ACCENT}55` }}>
      <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
        style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: `linear-gradient(90deg, transparent, ${ACCENT}18, transparent)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative' }}>
        <Avatar avatarUrl={inv.leader.avatarUrl} name={inv.leader.nickname} size={38} style={{ border: `2px solid ${ACCENT}66` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.leader.nickname}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>зовёт в отряд · {inv.size} в составе</div>
        </div>
        <button onClick={onDecline} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} /></button>
        <button onClick={onAccept} style={{ padding: '0 16px', height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: `0 4px 14px ${ACCENT}44` }}>Принять</button>
      </div>
    </motion.div>
  )
}

// ── Slots ────────────────────────────────────────────────────────────────────────
function Slot({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}>{children}</div>
}

function MemberSlot({ m, canKick, onKick }: { m: PartyMember; canKick: boolean; onKick: () => void }) {
  return (
    <Slot>
      <div style={{ position: 'relative' }}>
        {m.isLeader && (
          <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
            <Icon name="crown" size={15} color="#FFD700" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />
          </div>
        )}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20 }}>
          <Avatar avatarUrl={m.avatarUrl} name={m.nickname} size={52} style={{ border: `2px solid ${m.isLeader ? '#FFD70088' : ACCENT + '66'}`, boxShadow: `0 4px 14px ${m.isLeader ? 'rgba(255,215,0,0.25)' : ACCENT + '33'}` }} />
        </motion.div>
        <div style={{ position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: '50%', background: m.online ? '#22C55E' : '#4B5563', border: '2px solid #0a0a0f' }} />
        {canKick && (
          <button onClick={onKick} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: '2px solid #0a0a0f', background: '#EF4444', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 3 }}><Icon name="x" size={11} color="#fff" /></button>
        )}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', maxWidth: 62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{m.nickname}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>{m.elo}</div>
    </Slot>
  )
}

function PendingSlot({ m, canCancel, onCancel }: { m: PartyMember; canCancel: boolean; onCancel: () => void }) {
  return (
    <Slot>
      <div style={{ position: 'relative' }}>
        <div style={{ opacity: 0.5 }}>
          <Avatar avatarUrl={m.avatarUrl} name={m.nickname} size={52} style={{ border: '2px dashed rgba(168,85,247,0.5)' }} />
        </div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid transparent', borderTopColor: ACCENT, pointerEvents: 'none' }} />
        {canCancel && (
          <button onClick={onCancel} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: '2px solid #0a0a0f', background: '#6B7280', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 3 }}><Icon name="x" size={11} color="#fff" /></button>
        )}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', maxWidth: 62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{m.nickname}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>ждём…</div>
    </Slot>
  )
}

function EmptySlot({ canInvite, onInvite }: { canInvite: boolean; onInvite: () => void }) {
  return (
    <Slot>
      <button onClick={canInvite ? onInvite : undefined} disabled={!canInvite}
        style={{ width: 52, height: 52, borderRadius: '50%', border: `2px dashed ${canInvite ? ACCENT + '88' : 'rgba(255,255,255,0.1)'}`, background: canInvite ? `${ACCENT}12` : 'rgba(255,255,255,0.02)', cursor: canInvite ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canInvite ? ACCENT : '#374151' }}>
        <Icon name="plus" size={22} color={canInvite ? ACCENT : '#374151'} />
      </button>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: canInvite ? '#9CA3AF' : '#374151', textAlign: 'center' }}>{canInvite ? 'Позвать' : 'Пусто'}</div>
    </Slot>
  )
}

function LockedSlot() {
  return (
    <Slot>
      <div style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(234,179,8,0.3)', background: 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(255,255,255,0.02))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={18} color="#EAB308" />
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 900, color: '#EAB308', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Premium</div>
    </Slot>
  )
}

// ── Invite friends modal ────────────────────────────────────────────────────────
function InviteModal({ excludeIds, onClose, onInvited }: { excludeIds: number[]; onClose: () => void; onInvited: () => void }) {
  const [friends, setFriends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [invited, setInvited] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    api.get('/users/friends').then(r => setFriends(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const invite = async (id: number) => {
    setBusy(id)
    try { await api.post('/party/invite', { userId: id }); setInvited(s => new Set(s).add(id)); onInvited() }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setBusy(null) }
  }

  const list = friends
    .filter(f => !excludeIds.includes(f.id))
    .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Пригласить в отряд</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Зови друзей — попадёте в одну команду</div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT }} />
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '34px 16px', color: '#6B7280' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={26} color="#374151" /></div>
          <div style={{ fontSize: 14 }}>Нет доступных друзей</div>
          <div style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>Добавьте друзей в разделе «Друзья»</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(f => {
            const done = invited.has(f.id)
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar avatarUrl={f.avatarUrl} name={f.gameNickname || f.firstName} size={40} style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                  <div style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', background: f.online ? '#22C55E' : '#4B5563', border: '2px solid #0a0a0f' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.gameNickname || f.firstName}</div>
                  <div style={{ fontSize: 11, color: f.online ? '#22C55E' : '#6B7280' }}>{f.online ? 'в сети' : `${f.elo} ELO`}</div>
                </div>
                <button onClick={() => !done && invite(f.id)} disabled={done || busy === f.id}
                  style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: done ? 'default' : 'pointer', fontSize: 13, fontWeight: 800, color: done ? '#22C55E' : '#fff', background: done ? 'rgba(34,197,94,0.14)' : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, boxShadow: done ? 'none' : `0 4px 14px ${ACCENT}33`, whiteSpace: 'nowrap' }}>
                  {busy === f.id ? '…' : done ? '✓ Позван' : 'Позвать'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}

// ── Party menu (sheet content) ──────────────────────────────────────────────────
function PartyMenu({ party, invitations, refresh, onClose }: { party: PartyDto | null; invitations: Invitation[]; refresh: () => void; onClose: () => void }) {
  const { user } = useAuthStore()
  const [showInvite, setShowInvite] = useState(false)
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<any>) => {
    if (busy) return
    setBusy(true)
    try { await fn() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(false); refresh() }
  }
  if (!user) return null

  const maxSize = party?.maxSize ?? (user.isPremium ? 5 : 3)
  const members: PartyMember[] = party?.members ?? [{
    id: user.id, nickname: user.gameNickname || user.firstName, avatarUrl: user.avatarUrl,
    elo: user.elo, isVerified: user.isVerified, online: true, isLeader: true,
  }]
  const pending: PartyMember[] = party?.invites ?? []
  const amLeader = party ? party.isLeader : true
  const excludeIds = [...members.map(m => m.id), ...pending.map(m => m.id)]
  const total = members.length + pending.length

  return (
    <Sheet onClose={onClose}>
      {/* incoming invitations */}
      <AnimatePresence>
        {invitations.map(inv => (
          <InviteBanner key={inv.partyId} inv={inv}
            onAccept={() => act(() => api.post('/party/accept', { partyId: inv.partyId }))}
            onDecline={() => act(() => api.post('/party/decline', { partyId: inv.partyId }))} />
        ))}
      </AnimatePresence>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 18px ${ACCENT}55`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '12px 12px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
          <Icon name="users" size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>Отряд <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT, background: `${ACCENT}1a`, padding: '2px 9px', borderRadius: 20 }}>{total}/{maxSize}</span></div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Запускайтесь в поиск вместе — в одной команде</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < members.length) {
            const m = members[i]
            return <MemberSlot key={`m${m.id}`} m={m} canKick={amLeader && !m.isLeader} onKick={() => act(() => api.post('/party/kick', { userId: m.id }))} />
          }
          const pi = i - members.length
          if (pi < pending.length) {
            const m = pending[pi]
            return <PendingSlot key={`p${m.id}`} m={m} canCancel={amLeader} onCancel={() => act(() => api.post('/party/cancel-invite', { userId: m.id }))} />
          }
          if (i < maxSize) return <EmptySlot key={`e${i}`} canInvite={amLeader} onInvite={() => setShowInvite(true)} />
          return <LockedSlot key={`l${i}`} />
        })}
      </div>

      {/* primary action */}
      {amLeader && total < maxSize && (
        <button onClick={() => setShowInvite(true)} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, boxShadow: `0 8px 24px ${ACCENT}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 10 }}>
          <Icon name="plus" size={16} color="#fff" /> Пригласить друзей
        </button>
      )}

      <div style={{ fontSize: 12, color: party && party.members.length > 1 ? (amLeader ? ACCENT : '#9CA3AF') : '#6B7280', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: party ? 12 : 0 }}>
        {party && party.members.length > 1 ? (
          <><Icon name="bolt" size={13} color={amLeader ? ACCENT : '#9CA3AF'} />{amLeader ? 'Закрой меню и жми «Найти матч» — поедете вместе' : 'Поиск запускает лидер отряда'}</>
        ) : (
          <>Позови друзей, чтобы попасть в одну команду</>
        )}
      </div>

      {party && (
        <button onClick={() => act(() => api.post('/party/leave'))} style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="logout" size={14} color="#EF4444" />{amLeader ? 'Распустить отряд' : 'Покинуть отряд'}
        </button>
      )}

      <AnimatePresence>
        {showInvite && <InviteModal excludeIds={excludeIds} onClose={() => setShowInvite(false)} onInvited={refresh} />}
      </AnimatePresence>
    </Sheet>
  )
}

// ── Compact bar on the dashboard ────────────────────────────────────────────────
export function PartyPanel({ party, invitations, refresh }: { party: PartyDto | null; invitations: Invitation[]; refresh: () => void }) {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  if (!user) return null

  const hasParty = !!party && party.members.length > 1
  const maxSize = party?.maxSize ?? (user.isPremium ? 5 : 3)
  const total = (party?.members.length ?? 1) + (party?.invites.length ?? 0)
  const avatars = party ? [...party.members, ...party.invites].slice(0, 4) : []
  const hasInvites = invitations.length > 0

  return (
    <div style={{ marginBottom: 14 }}>
      <motion.button
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, type: 'spring', stiffness: 260, damping: 24 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 14, cursor: 'pointer', position: 'relative', overflow: 'hidden',
          background: hasParty ? `radial-gradient(120% 120% at 0% 0%, ${ACCENT}1f, transparent 55%), ${CARD}` : CARD,
          border: `1px solid ${hasParty || hasInvites ? ACCENT + '44' : 'rgba(255,255,255,0.07)'}`,
        }}>
        <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT}77, transparent)` }} />

        {/* icon / stacked avatars */}
        {hasParty ? (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {avatars.map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -12, position: 'relative', zIndex: avatars.length - i }}>
                <Avatar avatarUrl={m.avatarUrl} name={m.nickname} size={32} style={{ border: '2px solid #0a0a0f' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${ACCENT}18`, border: `1px solid ${ACCENT}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="users" size={17} color={ACCENT} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{hasParty ? 'Отряд' : 'Собрать отряд'}</div>
          <div style={{ fontSize: 10.5, color: hasParty ? ACCENT : '#6B7280', fontWeight: 600, marginTop: 1 }}>
            {hasParty ? `${total}/${maxSize} · в одну команду` : 'Зови друзей — играйте вместе'}
          </div>
        </div>

        {hasInvites && (
          <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
            style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: '#E8092E', color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {invitations.length}
          </motion.span>
        )}
        <Icon name="chevronRight" size={18} color="#4B5563" />
      </motion.button>

      <AnimatePresence>
        {open && <PartyMenu party={party} invitations={invitations} refresh={refresh} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
