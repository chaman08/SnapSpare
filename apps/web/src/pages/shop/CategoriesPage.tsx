import { CATEGORY_TREE } from '@snapspare/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function CategoriesPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 font-heading text-2xl font-semibold text-ink">{t('nav.categories')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_TREE.map((category) => (
          <div key={category.slug} className="rounded-[6px] border border-steel/20 p-4">
            <Link to={`/parts/${category.slug}`} className="font-heading text-lg font-semibold text-ink hover:text-signal">
              {category.name}
            </Link>
            <ul className="mt-2 space-y-1">
              {category.subcategories.slice(0, 6).map((sub) => (
                <li key={sub.slug}>
                  <Link
                    to={`/parts/${category.slug}/${sub.slug}`}
                    className="block min-h-tap py-1 text-sm text-steel hover:text-ink"
                  >
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
            {category.subcategories.length > 6 ? (
              <Link
                to={`/parts/${category.slug}`}
                className="mt-1 inline-block text-sm font-medium text-signal hover:underline"
              >
                {t('category.viewAll')}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
