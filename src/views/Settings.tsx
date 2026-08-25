import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bell, Download, LogOut, Repeat, Upload, Volume2 } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { ROLES, ROLE_LIST, can } from '@/lib/permissions'
import { digest } from '@/lib/storage'
import { desktopPermission, playChime, requestDesktop, type Permission } from '@/lib/notify'
import { fmtFullDate } from '@/lib/format'
import { Avatar, RoleTag } from '@/components/ui/Avatar'
import { Button, Panel, SectionTitle, Segmented } from '@/components/ui/primitives'
import { Input, Toggle } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/cn'

export function SettingsView() {
  const { me, state, prefs, setPrefs, updateUser, signOut, switchTo, exportData, importData, resetWorkspace } = useApp()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')

  if (!me) return null

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <Panel>
        <SectionTitle hint="Signed in and remembered on this device">Your account</SectionTitle>
        <div className="flex items-center gap-4">
          <Avatar user={me} size="lg" ring />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{me.name}</p>
            <p className="num text-[12px] text-fg-faint">{me.email}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-fg-faint">
              <RoleTag role={me.role} />
              {ROLES[me.role].label} · joined {fmtFullDate(me.joinedAt)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut size={14} /> Sign out
          </Button>
        </div>
        <p className="mt-4 rounded-xl bg-panel-2 px-3.5 py-3 text-[12px] leading-relaxed text-fg-muted">
          {ROLES[me.role].blurb}
        </p>
      </Panel>

      <Panel>
        <SectionTitle hint="Applies to this browser only">Appearance &amp; motion</SectionTitle>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium">Theme</p>
              <p className="text-[11px] text-fg-faint">Studio dark, or paper light for bright rooms.</p>
            </div>
            <Segmented
              layoutId="theme-toggle"
              size="sm"
              value={prefs.theme}
              onChange={(v) => setPrefs({ theme: v })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </div>

          <div className="border-t border-line pt-4">
            <Toggle
              checked={prefs.reduceMotion}
              onChange={(v) => setPrefs({ reduceMotion: v })}
              label="Reduce motion"
              description="Turns off tab transitions, card springs and count-ups. Your system setting is honoured either way."
            />
          </div>
        </div>
      </Panel>

      <AlertSettings />

      <Panel>
        <SectionTitle hint="At least six characters">Change your password</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="password" label="New password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
          <Input
            type="password"
            label="Confirm"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            placeholder="••••••••"
            error={pwd2 && pwd !== pwd2 ? 'These do not match.' : undefined}
          />
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={pwd.length < 6 || pwd !== pwd2}
          onClick={() => {
            updateUser(me.id, { secret: digest(pwd) })
            setPwd('')
            setPwd2('')
            toast({ tone: 'success', title: 'Password updated' })
          }}
        >
          Update password
        </Button>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          This build keeps everything in your browser, so passwords are only obscured, not securely hashed. Put a real
          backend behind it before using it with anything sensitive.
        </p>
      </Panel>

      <Panel>
        <SectionTitle hint="Try the system from another role without losing your data">Switch role for a look</SectionTitle>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {state.users
            .filter((u) => u.active)
            .map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  switchTo(u.id)
                  toast({ tone: 'info', title: `Viewing as ${u.name}`, body: `${ROLES[u.role].label} access` })
                }}
                disabled={u.id === me.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  u.id === me.id ? 'border-accent bg-accent/6' : 'border-line hover:border-line-strong hover:bg-panel-2',
                )}
              >
                <Avatar user={u} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{u.name}</span>
                  <span className="block truncate text-[11px] text-fg-faint">{ROLES[u.role].label}</span>
                </span>
                {u.id === me.id ? <span className="text-[10px] text-fg-faint">current</span> : <Repeat size={13} className="text-fg-faint" />}
              </button>
            ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
          A demo convenience so you can see how each role's access differs. Behind a real backend this would not exist.
        </p>
      </Panel>

      {can(me, 'settings.manage') && (
        <Panel>
          <SectionTitle hint="Tasks, people, points and history as JSON">Workspace record</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download size={14} /> Export workspace
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                const res = importData(await file.text())
                toast(
                  res.ok
                    ? { tone: 'success', title: 'Workspace imported', body: 'Sign in again to continue.' }
                    : { tone: 'error', title: 'Import failed', body: res.error },
                )
              }}
            />
            <Button variant="danger" size="sm" className="ml-auto" onClick={() => setResetOpen(true)}>
              Reset to demo data
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
            Exports carry the structured record. Uploaded media lives in this browser's IndexedDB and does not travel with
            the JSON file.
          </p>
        </Panel>
      )}

      <Panel>
        <SectionTitle>How your data is stored</SectionTitle>
        <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-fg-muted">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            Tasks, people and points live in <span className="num">localStorage</span>, so the workspace survives a refresh.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
            Voice notes, images and video go to <span className="num">IndexedDB</span> — localStorage cannot hold binary at
            that size.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
            Your session is remembered per device. Nothing leaves the browser, and the assistant answers offline.
          </li>
        </ul>
      </Panel>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the workspace?"
        subtitle="Every task, initiative, member and point you have added goes back to the seeded demo."
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Keep my data</Button>
            <Button variant="danger" onClick={resetWorkspace}>Reset everything</Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-fg-muted">
          Export first if there is anything here worth keeping — this cannot be undone.
        </p>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * How arrivals reach you
 * ------------------------------------------------------------------ */

function AlertSettings() {
  const { prefs, setPrefs } = useApp()
  const toast = useToast()
  const [permission, setPermission] = useState<Permission>('default')

  useEffect(() => setPermission(desktopPermission()), [])

  const enableDesktop = async (on: boolean) => {
    if (!on) {
      setPrefs({ desktopAlerts: false })
      return
    }
    const result = await requestDesktop()
    setPermission(result)
    if (result === 'granted') {
      setPrefs({ desktopAlerts: true })
      toast({ tone: 'success', title: 'Desktop notifications on', body: 'They fire only while this tab is in the background.' })
    } else {
      setPrefs({ desktopAlerts: false })
      toast({
        tone: 'error',
        title: result === 'unsupported' ? 'This browser has no notification API' : 'Notifications are blocked',
        body:
          result === 'denied'
            ? 'Allow notifications for this site in your browser settings, then switch this back on.'
            : 'The other channels still work.',
      })
    }
  }

  return (
    <Panel>
      <SectionTitle hint="What happens the moment work lands on you">
        <span className="inline-flex items-center gap-1.5">
          <Bell size={13} /> Alerts
        </span>
      </SectionTitle>

      <div className="space-y-4">
        <Toggle
          checked={prefs.liveAlerts}
          onChange={(v) => setPrefs({ liveAlerts: v })}
          label="Show a card when something arrives"
          description="Slides in over whatever you are doing and clears itself after a few seconds. Click it to open the task."
        />

        <div className="border-t border-line pt-4">
          <Toggle
            checked={prefs.soundAlerts}
            onChange={(v) => {
              setPrefs({ soundAlerts: v })
              if (v) playChime('arrive')
            }}
            label="Play a chime"
            description="Two short notes. New work and approvals sound different, so you can tell them apart without looking."
          />
          {prefs.soundAlerts && (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
              {(['arrive', 'good', 'warn'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => playChime(c)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-faint transition-colors hover:border-line-strong hover:text-fg-muted"
                >
                  <Volume2 size={11} />
                  {c === 'arrive' ? 'New work' : c === 'good' ? 'Approved' : 'Sent back'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <Toggle
            checked={prefs.desktopAlerts && permission === 'granted'}
            onChange={(v) => void enableDesktop(v)}
            label="Notify me outside the browser tab"
            description="An operating-system notification, only while this tab is in the background. Your browser asks permission first."
          />
          {permission === 'denied' && (
            <p className="mt-2 pl-12 text-[11px] leading-relaxed text-amber">
              Your browser is blocking notifications for this site. Allow them in site settings, then switch this back on.
            </p>
          )}
          {permission === 'unsupported' && (
            <p className="mt-2 pl-12 text-[11px] text-fg-faint">This browser does not expose a notification API.</p>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-panel-2 px-3.5 py-3 text-[11.5px] leading-relaxed text-fg-muted">
        To see it land: open Flow in a second tab, use <span className="text-fg">Switch role for a look</span> below to
        become someone else in <em>this</em> tab, then assign work to whoever the other tab is showing. It arrives there
        live, no refresh. The workspace is shared between tabs in this browser; each tab keeps its own signed-in account
        until you reload it.
      </p>
    </Panel>
  )
}

export { ROLE_LIST }
