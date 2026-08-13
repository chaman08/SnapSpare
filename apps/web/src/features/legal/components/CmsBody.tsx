import { Fragment } from 'react'

/**
 * Renders `cmsPageSchema.body`'s plain markdown-lite text (`## heading`,
 * `- bullet`, `**bold**`) as real React elements — never
 * `dangerouslySetInnerHTML`, per that schema's own header comment, since
 * this text can come from admin input (saveCmsPage.ts) and must never be
 * interpreted as HTML. Deliberately only the small subset of markdown the
 * seeded legal/FAQ content actually uses, not a general-purpose parser.
 */
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0)
  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
    ),
  )
}

export function CmsBody({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: JSX.Element[] = []
  let listBuffer: string[] = []

  function flushList(key: string) {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={key} className="ml-5 list-disc space-y-1 text-sm text-ink">
        {listBuffer.map((item, index) => (
          <li key={index}>{renderInline(item, `${key}-li-${index}`)}</li>
        ))}
      </ul>,
    )
    listBuffer = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('## ')) {
      flushList(`list-${index}`)
      blocks.push(
        <h2 key={index} className="font-heading text-lg font-semibold text-ink">
          {renderInline(trimmed.slice(3), `h-${index}`)}
        </h2>,
      )
    } else if (trimmed.startsWith('- ')) {
      listBuffer.push(trimmed.slice(2))
    } else if (trimmed.length === 0) {
      flushList(`list-${index}`)
    } else {
      flushList(`list-${index}`)
      blocks.push(
        <p key={index} className="text-sm leading-relaxed text-ink">
          {renderInline(trimmed, `p-${index}`)}
        </p>,
      )
    }
  })
  flushList('list-end')

  return <div className="space-y-3">{blocks}</div>
}
