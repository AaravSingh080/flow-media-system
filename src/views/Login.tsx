import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Mic, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { ROLES, ROLE_LIST } from '@/lib/permissions'
import { DEMO_PASSWORD } from '@/lib/seed'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/primitives'
import { Input, Select, Toggle } from '@/components/ui/Field'
import { Wordmark } from '@/components/layout/Sidebar'
import { cn } from '@/components/ui/cn'
import type { Role } from '@/types'

export function Login() {
  const { state, signIn, signUp } = useApp()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('aarav@flowmedia.studio')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [remember, setRemember] = useState(true)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // The theme toggle lives behind the shell, so pin the sign-in screen to dark.
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const submit = () => {
    setError(undefined)
    setBusy(true)
    const res =
      mode === 'in'
        ? signIn(email, password, remember)
        : signUp({ name, email, password, role, title })
    setBusy(false)
    if (!res.ok) setError(res.error)
  }

  const demoAccounts = state.users.filter((u) => u.active).slice(0, 6)

  return (
    <div className="grain relative flex min-h-dvh w-full items-center justify-center overflow-y-auto bg-bg p-4 sm:p-6">
      <div
        className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full opacity-[0.13] blur-[100px]"
        style={{ background: 'radial-gradient(circle, var(--c-accent), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -right-40 bottom-0 h-[460px] w-[460px] rounded-full opacity-[0.12] blur-[100px]"
        style={{ background: 'radial-gradient(circle, var(--c-violet), transparent 70%)' }}
      />

      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        {/* ------------------------- pitch side ------------------------ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="hidden flex-col justify-center lg:flex"
        >
          <Wordmark />
          <h1 className="mt-8 font-display text-[42px] font-semibold leading-[1.05] tracking-tight">
            Brief it however
            <br />
            <span className="text-accent-fg">it comes out of you.</span>
          </h1>
          <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-fg-muted">
            Flow is a task system built for media teams: record the brief instead of typing it, hand back the actual file,
            and let the points fall where the work was.
          </p>

          <ul className="mt-9 space-y-4">
            <Feature icon={<Mic size={15} />} title="Voice, video or text — any combination">
              A brief can be a paragraph, a two-minute voice note, a reference frame, or all three at once.
            </Feature>
            <Feature icon={<Trophy size={15} />} title="Points that reflect weight, not hours">
              The briefer sets the value. Points land only when an admin signs the work off.
            </Feature>
            <Feature icon={<ShieldCheck size={15} />} title="Roles that actually gate things">
              Eight roles, one capability matrix. What you cannot do, you cannot see.
            </Feature>
            <Feature icon={<Sparkles size={15} />} title="An assistant that reads the board">
              Ask what is overdue, who has capacity, or how somebody works. Answers come from the data, offline.
            </Feature>
          </ul>
        </motion.div>

        {/* ------------------------- form side ------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="panel w-full self-center p-6 shadow-lift sm:p-7"
        >
          <div className="mb-6 lg:hidden">
            <Wordmark />
          </div>

          <div className="mb-6 inline-flex rounded-xl bg-panel-3 p-1">
            {(['in', 'up'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(undefined) }}
                className={cn(
                  'relative h-8 rounded-lg px-4 text-[13px] font-medium transition-colors',
                  mode === m ? 'text-fg' : 'text-fg-faint hover:text-fg-muted',
                )}
              >
                {mode === m && (
                  <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-lg bg-panel shadow-soft" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />
                )}
                <span className="relative z-10">{m === 'in' ? 'Sign in' : 'Create account'}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              {mode === 'up' && (
                <>
                  <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Okonkwo" />
                  <Input label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Motion Designer" />
                  <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} hint={ROLES[role].blurb}>
                    {ROLE_LIST.filter((r) => r.id !== 'admin').map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </Select>
                </>
              )}

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="you@flowmedia.studio"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="••••••••"
                error={error}
              />

              {mode === 'in' && (
                <Toggle
                  checked={remember}
                  onChange={setRemember}
                  label="Keep me signed in on this device"
                  description="Your account and role are remembered until you sign out."
                />
              )}
            </motion.div>
          </AnimatePresence>

          <Button variant="primary" size="lg" className="mt-6 w-full justify-center" onClick={submit} loading={busy}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
            <ArrowRight size={16} />
          </Button>

          {mode === 'in' && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-3 text-[11px] uppercase tracking-wider text-fg-faint">
                Demo accounts · password <span className="num text-fg-muted">{DEMO_PASSWORD}</span>
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {demoAccounts.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setEmail(u.email)
                      setPassword(DEMO_PASSWORD)
                      setError(undefined)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      email === u.email ? 'border-accent bg-accent/6' : 'border-line hover:border-line-strong hover:bg-panel-2',
                    )}
                  >
                    <Avatar user={u} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">{u.name.split(' ')[0]}</span>
                      <span className="block truncate text-[10px] text-fg-faint">{ROLES[u.role].label}</span>
                    </span>
                    {email === u.email ? <Check size={12} className="text-accent-fg" /> : <RoleTag role={u.role} />}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
                Sign in as an admin to brief work and release points, or as a contributor to see how much narrower the
                system gets.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-panel-2 text-accent-fg">
        {icon}
      </span>
      <span>
        <span className="block text-[13.5px] font-medium">{title}</span>
        <span className="mt-0.5 block max-w-sm text-[12.5px] leading-relaxed text-fg-faint">{children}</span>
      </span>
    </li>
  )
}
