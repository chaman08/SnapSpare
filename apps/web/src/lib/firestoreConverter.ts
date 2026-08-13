import type { FirestoreConverterLike } from '@snapspare/shared'
import type { FirestoreDataConverter } from 'firebase/firestore'

/**
 * `@snapspare/shared`'s converters are deliberately SDK-agnostic (see
 * packages/shared/src/firestore/converter.ts) so the package doesn't force
 * either the client or admin Firestore SDK as a dependency. That structural
 * typing is close enough for the client SDK to accept at runtime, but not
 * exact enough for TypeScript to carry branded ID types through
 * `.withConverter()` without this explicit adapter.
 */
export function clientConverter<T extends { id: string }>(
  converter: FirestoreConverterLike<T>,
): FirestoreDataConverter<T> {
  return converter as unknown as FirestoreDataConverter<T>
}
