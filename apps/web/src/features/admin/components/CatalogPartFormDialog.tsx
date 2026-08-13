import type { CatalogPart, GstRatePercent } from '@snapspare/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminSaveCatalogPart } from '@/features/admin/api/catalogueActions'

interface CatalogPartFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  part: CatalogPart | null
  onSaved: () => void
}

const GST_RATES: GstRatePercent[] = [0, 5, 12, 18, 28]

/** Catalogue module (design brief item 3) create/edit form — one dialog for both, `part` present means edit. Duplicate-by-OEM warnings surface as a confirm-to-force flow. */
export function CatalogPartFormDialog({ open, onOpenChange, part, onSaved }: CatalogPartFormDialogProps) {
  const { t } = useTranslation()
  const [partNumber, setPartNumber] = useState('')
  const [name, setName] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [brand, setBrand] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [gstRatePercent, setGstRatePercent] = useState<GstRatePercent>(18)
  const [oemNumbers, setOemNumbers] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('India')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPartNumber(part?.partNumber ?? '')
    setName(part?.name ?? '')
    setCategorySlug(part?.categorySlug ?? '')
    setBrand(part?.brand ?? '')
    setHsnCode(part?.hsnCode ?? '')
    setGstRatePercent(part?.gstRatePercent ?? 18)
    setOemNumbers((part?.oemNumbers ?? []).join('; '))
    setCountryOfOrigin(part?.countryOfOrigin ?? 'India')
  }, [open, part])

  async function save(allowDuplicate: boolean) {
    setBusy(true)
    try {
      const result = await adminSaveCatalogPart({
        id: part?.id,
        partNumber: partNumber.trim(),
        partType: part?.partType ?? 'aftermarket',
        categorySlug: categorySlug.trim(),
        name: name.trim(),
        brand: brand.trim() || undefined,
        oemNumbers: oemNumbers.split(';').map((s) => s.trim()).filter(Boolean),
        crossRefNumbers: part?.crossRefNumbers ?? [],
        hsnCode: hsnCode.trim(),
        gstRatePercent,
        countryOfOrigin: countryOfOrigin.trim() || 'India',
        status: part?.status ?? 'active',
        allowDuplicate,
      })
      if (result.duplicateOfPartIds.length > 0) {
        toast.warning(t('admin.catalogue.parts.savedWithDuplicates', { count: result.duplicateOfPartIds.length }))
      } else {
        toast.success(t('admin.catalogue.parts.saveSuccess'))
      }
      onSaved()
      onOpenChange(false)
    } catch (error) {
      const details = (error as { details?: { duplicateOfPartIds?: string[] } }).details
      if (details?.duplicateOfPartIds?.length) {
        if (window.confirm(t('admin.catalogue.parts.duplicateConfirm', { count: details.duplicateOfPartIds.length }))) {
          await save(true)
          return
        }
      } else {
        toast.error(t('admin.catalogue.parts.saveFailed'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{part ? t('admin.catalogue.parts.editTitle') : t('admin.catalogue.parts.newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="part-number">{t('admin.catalogue.parts.partNumber')}</Label>
            <Input id="part-number" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} disabled={busy || Boolean(part)} />
          </div>
          <div>
            <Label htmlFor="part-name">{t('admin.catalogue.parts.name')}</Label>
            <Input id="part-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </div>
          <div>
            <Label htmlFor="part-category">{t('admin.catalogue.parts.categorySlug')}</Label>
            <Input id="part-category" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} disabled={busy} />
          </div>
          <div>
            <Label htmlFor="part-brand">{t('admin.catalogue.parts.brand')}</Label>
            <Input id="part-brand" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={busy} />
          </div>
          <div>
            <Label htmlFor="part-hsn">{t('admin.catalogue.parts.hsnCode')}</Label>
            <Input id="part-hsn" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} disabled={busy} />
          </div>
          <div>
            <Label htmlFor="part-gst">{t('admin.catalogue.parts.gstRate')}</Label>
            <select
              id="part-gst"
              className="flex min-h-tap w-full rounded-[6px] border border-steel/30 bg-surface px-3 text-base text-ink"
              value={gstRatePercent}
              onChange={(e) => setGstRatePercent(Number(e.target.value) as GstRatePercent)}
              disabled={busy}
            >
              {GST_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="part-country-of-origin">{t('admin.catalogue.parts.countryOfOrigin')}</Label>
            <Input id="part-country-of-origin" value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} disabled={busy} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="part-oem">{t('admin.catalogue.parts.oemNumbers')}</Label>
            <Input id="part-oem" value={oemNumbers} onChange={(e) => setOemNumbers(e.target.value)} disabled={busy} placeholder="ABC123; XYZ789" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.close')}
          </Button>
          <Button
            size="sm"
            onClick={() => save(false)}
            disabled={busy || !partNumber.trim() || !name.trim() || !categorySlug.trim() || !hsnCode.trim()}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
