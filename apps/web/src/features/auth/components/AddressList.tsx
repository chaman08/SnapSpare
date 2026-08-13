import type { Address } from '@snapspare/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  useAddresses,
} from '@/features/auth/api/addresses'
import { AddressFormPanel } from '@/features/auth/components/AddressFormPanel'

export function AddressList({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const { addresses, loading, error } = useAddresses(userId)
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'add' } | { kind: 'edit'; address: Address }>({
    kind: 'list',
  })

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error) {
    return <ErrorState onRetry={() => window.location.reload()} />
  }

  if (mode.kind === 'add') {
    return (
      <AddressFormPanel
        onCancel={() => setMode({ kind: 'list' })}
        onSubmit={async (input) => {
          await addAddress(userId, input)
          toast.success(t('address.saved'))
          setMode({ kind: 'list' })
        }}
      />
    )
  }

  if (mode.kind === 'edit') {
    return (
      <AddressFormPanel
        initial={mode.address}
        onCancel={() => setMode({ kind: 'list' })}
        onSubmit={async (input) => {
          await updateAddress(userId, mode.address.id, input)
          toast.success(t('address.saved'))
          setMode({ kind: 'list' })
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <EmptyState
          title={t('address.emptyTitle')}
          actionLabel={t('address.add')}
          onAction={() => setMode({ kind: 'add' })}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {addresses.map((address) => (
              <li key={address.id} className="rounded-[6px] border border-steel/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {address.label}
                      {address.isDefault ? (
                        <span className="ml-2 rounded-[6px] bg-verify/10 px-2 py-0.5 text-xs font-medium text-verify">
                          {t('address.default')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-steel">
                      {address.contactName} · {address.contactPhone}
                    </p>
                    <p className="text-sm text-steel">
                      {address.line1}, {address.city}, {address.state} {address.pincode}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!address.isDefault ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await setDefaultAddress(userId, address.id)
                        toast.success(t('address.defaultSet'))
                      }}
                    >
                      {t('address.setDefault')}
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => setMode({ kind: 'edit', address })}>
                    {t('address.edit')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(t('address.confirmDelete'))) return
                      await deleteAddress(userId, address.id)
                      toast.success(t('address.deleted'))
                    }}
                  >
                    {t('address.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => setMode({ kind: 'add' })}>
            {t('address.add')}
          </Button>
        </>
      )}
    </div>
  )
}
