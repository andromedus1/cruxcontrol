/** Shared OPFS and receipt names for catalog bootstrap and its read adapter. */
export const CATALOG_OPFS_DIRECTORY = 'cruxcontrol-catalog';
export const CATALOG_SLOT_FILENAMES = {
  a: 'catalog-a.sqlite3',
  b: 'catalog-b.sqlite3',
} as const;
export type CatalogSlot = keyof typeof CATALOG_SLOT_FILENAMES;

export const CATALOG_RECEIPT_DATABASE = 'cruxcontrol-catalog-metadata';
export const CATALOG_RECEIPT_STORE = 'active';
export const CATALOG_RECEIPT_KEY = 'kilter-fullride-7x10';
export const CATALOG_OWNER_LOCK = 'cruxcontrol-catalog-owner';
