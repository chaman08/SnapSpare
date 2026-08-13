import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/api/AuthProvider'
import { useSellerApplication } from '@/features/sellerOnboarding/api/sellerApplication'
import { ApplicationStatusTracker } from '@/features/sellerOnboarding/components/ApplicationStatusTracker'
import { StepAddresses } from '@/features/sellerOnboarding/components/wizard/StepAddresses'
import { StepAgreement } from '@/features/sellerOnboarding/components/wizard/StepAgreement'
import { StepBank } from '@/features/sellerOnboarding/components/wizard/StepBank'
import { StepBusiness } from '@/features/sellerOnboarding/components/wizard/StepBusiness'
import { StepDocuments } from '@/features/sellerOnboarding/components/wizard/StepDocuments'
import { StepTaxIdentity } from '@/features/sellerOnboarding/components/wizard/StepTaxIdentity'
import { WizardShell } from '@/features/sellerOnboarding/components/wizard/WizardShell'

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/** Auth-gated onboarding entry point: shows the 6-step wizard while the application is draft/being edited, and the status tracker once it's been submitted. */
export default function SellApplyPage() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { application, loading } = useSellerApplication(user?.uid)
  const [step, setStep] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)

  if (authLoading || loading) return <PageSkeleton />
  if (!user) return <PageSkeleton />

  const uid = user.uid
  const currentStep = step ?? application?.currentStep ?? 1
  const isEditable = !application || application.status === 'draft' || (application.status === 'changes_requested' && editing)

  if (application && !isEditable) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 font-heading text-2xl font-semibold text-ink">{t('sell.apply.title')}</h1>
        <ApplicationStatusTracker application={application} onResumeEditing={() => setEditing(true)} />
      </div>
    )
  }

  function goToStep(next: number) {
    setStep(next)
  }

  return (
    <WizardShell currentStep={currentStep} onStepClick={goToStep}>
      {currentStep === 1 ? (
        <StepBusiness uid={uid} status={application?.status} initial={application?.business} onSaved={() => goToStep(2)} />
      ) : null}
      {currentStep === 2 ? (
        <StepTaxIdentity
          uid={uid}
          status={application?.status}
          initial={application?.taxIdentity}
          onSaved={() => goToStep(3)}
          onBack={() => goToStep(1)}
        />
      ) : null}
      {currentStep === 3 ? (
        <StepAddresses
          uid={uid}
          status={application?.status}
          initialRegistered={application?.registeredAddress}
          initialPickup={application?.pickupAddresses}
          onSaved={() => goToStep(4)}
          onBack={() => goToStep(2)}
        />
      ) : null}
      {currentStep === 4 ? (
        <StepBank
          uid={uid}
          status={application?.status}
          initial={application?.bank}
          onSaved={() => goToStep(5)}
          onBack={() => goToStep(3)}
        />
      ) : null}
      {currentStep === 5 ? (
        <StepDocuments
          uid={uid}
          status={application?.status}
          gstRegistered={application?.taxIdentity?.gstRegistered ?? true}
          initial={application?.documents}
          onSaved={() => goToStep(6)}
          onBack={() => goToStep(4)}
        />
      ) : null}
      {currentStep === 6 ? (
        <StepAgreement onSubmitted={() => setEditing(false)} onBack={() => goToStep(5)} />
      ) : null}
    </WizardShell>
  )
}
