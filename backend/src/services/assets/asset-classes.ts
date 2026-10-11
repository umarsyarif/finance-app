// Asset classes are plain strings validated here (not a DB enum), so a new class needs no migration
export const ASSET_CLASSES = {
  GOLD: { manual: true, unit: 'g', defaultSymbol: 'XAU' },
  CRYPTO: { manual: false, unit: null, defaultSymbol: null },
} as const;
export type AssetClass = keyof typeof ASSET_CLASSES;
export const isAssetClass = (c: string): c is AssetClass => Object.prototype.hasOwnProperty.call(ASSET_CLASSES, c);
export const isManualClass = (c: string) => isAssetClass(c) && ASSET_CLASSES[c].manual;
