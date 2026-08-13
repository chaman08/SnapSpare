import type { BuyerType } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { saveCampaign, sendCampaign, useCampaigns } from '@/features/admin/api/marketingActions'
import { cn } from '@/lib/utils'

const AUDIENCES: (BuyerType | 'all')[] = ['all', 'retail', 'mechanic', 'garage', 'fleet', 'reseller']

/** Marketing module's push campaign composer (design brief item 9) — see campaign.ts's header comment on why WhatsApp isn't offered here. */
export function CampaignsPanel() {
  const { t } = useTranslation()
  const { campaigns, loading } = useCampaigns()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<BuyerType | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  async function createDraft() {
    setBusy(true)
    try {
      await saveCampaign({ title: title.trim(), body: body.trim(), audience: { buyerType: audience } })
      toast.success(t('admin.marketing.campaigns.saveSuccess'))
      setOpen(false)
      setTitle('')
      setBody('')
    } catch {
      toast.error(t('admin.marketing.campaigns.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function send(id: string) {
    if (!window.confirm(t('admin.marketing.campaigns.sendConfirm'))) return
    setSendingId(id)
    try {
      const result = await sendCampaign({ id })
      toast.success(t('admin.marketing.campaigns.sendSuccess', { count: result.recipientCount }))
    } catch {
      toast.error(t('admin.marketing.campaigns.sendFailed'))
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          {t('admin.marketing.campaigns.newAction')}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : campaigns.length === 0 ? (
        <EmptyState title={t('admin.marketing.campaigns.emptyTitle')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.marketing.campaigns.title')}</TableHead>
              <TableHead>{t('admin.marketing.campaigns.audience')}</TableHead>
              <TableHead>{t('admin.marketing.campaigns.status')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>{campaign.title}</TableCell>
                <TableCell className="text-xs text-steel">{campaign.audience.buyerType}</TableCell>
                <TableCell>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', campaign.status === 'sent' ? 'bg-verify/10 text-verify' : 'bg-steel/10 text-steel')}>
                    {campaign.status}
                    {campaign.recipientCount !== undefined ? ` (${campaign.recipientCount})` : ''}
                  </span>
                </TableCell>
                <TableCell>
                  {campaign.status === 'draft' && (
                    <Button variant="outline" size="sm" disabled={sendingId === campaign.id} onClick={() => send(campaign.id)}>
                      {t('admin.marketing.campaigns.sendAction')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.marketing.campaigns.newAction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="campaign-title">{t('admin.marketing.campaigns.title')}</Label>
              <Input id="campaign-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="campaign-body">{t('admin.marketing.campaigns.body')}</Label>
              <Input id="campaign-body" value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="campaign-audience">{t('admin.marketing.campaigns.audience')}</Label>
              <select
                id="campaign-audience"
                className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-sm text-ink"
                value={audience}
                onChange={(e) => setAudience(e.target.value as BuyerType | 'all')}
                disabled={busy}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.close')}
            </Button>
            <Button size="sm" onClick={createDraft} disabled={busy || !title.trim() || !body.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
