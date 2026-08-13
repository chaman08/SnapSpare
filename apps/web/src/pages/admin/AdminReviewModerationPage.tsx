import { useTranslation } from 'react-i18next'
import { FlaggedReviewsQueue } from '@/features/admin/components/FlaggedReviewsQueue'

export default function AdminReviewModerationPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t('admin.reviewModeration.title')}</h1>
      <FlaggedReviewsQueue />
    </div>
  )
}
