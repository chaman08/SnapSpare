import type { z } from 'zod'

/**
 * Structural stand-in for firebase/firestore's and firebase-admin/firestore's
 * QueryDocumentSnapshot — both expose `.id` and `.data()`. Modeling it this
 * way (instead of importing either SDK) keeps this package installable from
 * both the web app (client SDK) and Cloud Functions (admin SDK) without
 * forcing either one as a dependency here.
 */
export interface FirestoreSnapshotLike {
  id: string
  data(): Record<string, unknown> | undefined
}

export interface FirestoreConverterLike<T> {
  toFirestore(model: T): Record<string, unknown>
  fromFirestore(snapshot: FirestoreSnapshotLike): T
}

/**
 * Builds a withConverter()-compatible converter from a zod schema. The
 * schema is the single source of truth for both directions: reads are
 * parsed (so bad data fails loudly instead of silently flowing into the
 * app), and writes strip the `id` field since Firestore document IDs live
 * in the path, not the document body.
 */
export function makeFirestoreConverter<T extends { id: string }, Input = unknown>(
  // `z.ZodType<T>` alone would implicitly pin Input = T too (ZodType's 3rd
  // type param defaults to its 1st), which breaks inference for any schema
  // using `.default()` — those have an Output (T) stricter than their Input.
  // Decoupling Input here lets T bind to the Output shape correctly.
  schema: z.ZodType<T, z.ZodTypeDef, Input>,
): FirestoreConverterLike<T> {
  return {
    toFirestore(model: T): Record<string, unknown> {
      const { id: _id, ...rest } = model
      return rest
    },
    fromFirestore(snapshot: FirestoreSnapshotLike): T {
      return schema.parse({ id: snapshot.id, ...snapshot.data() })
    },
  }
}
