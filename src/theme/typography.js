// Na Androidzie każda grubość fontu to osobna rodzina – fontWeight nie działa dla fontów z plików
export const F = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

/** Styl tekstu: t(15, 'bold') → { fontSize: 15, fontFamily: 'Manrope_700Bold' } */
export const t = (size, weight = 'regular') => ({ fontSize: size, fontFamily: F[weight] });
