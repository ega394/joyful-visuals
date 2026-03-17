import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

export const nativeBiometricAuth = async () => {
  if (!isNative()) throw new Error('Hanya tersedia di aplikasi native');
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  const check = await BiometricAuth.checkBiometry();
  if (!check.isAvailable) throw new Error('Biometrik tidak tersedia di perangkat ini');
  await BiometricAuth.authenticate({
    reason: 'Verifikasi identitas Anda',
    cancelTitle: 'Batal',
    allowDeviceCredential: true,
  });
  return true;
};

export const getNativeLocation = async () => {
  if (!isNative()) throw new Error('Hanya tersedia di aplikasi native');
  const { Geolocation } = await import('@capacitor/geolocation');
  const perm = await Geolocation.requestPermissions();
  if (perm.location !== 'granted') throw new Error('Izin lokasi ditolak');
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
};

export const initNativePush = async (onToken: (token: string) => void) => {
  if (!isNative()) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();
  PushNotifications.addListener('registration', (token) => onToken(token.value));
};

export const takeNativePhoto = async (): Promise<string> => {
  if (!isNative()) throw new Error('Hanya tersedia di aplikasi native');
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 90,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
  });
  return photo.dataUrl!;
};
