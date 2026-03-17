// Deteksi apakah berjalan di native app atau browser
const isNative = () => {
  return typeof window !== 'undefined' && 
    !!(window as any).Capacitor?.isNativePlatform?.();
};

export const getBiometricAuth = async () => {
  if (!isNative()) return null;
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  return BiometricAuth;
};

export const getCapacitorCore = async () => {
  if (!isNative()) return null;
  const mod = await import('@capacitor/core');
  return mod;
};

export { isNative };
