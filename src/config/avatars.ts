export interface PresetAvatarOption {
  id: string;
  url: string;
  labelAr: string;
  labelEn: string;
}

export const PRESET_AVATARS: PresetAvatarOption[] = [
  { id: 'av-1', url: '/avatars/avatar-1.jpg', labelAr: 'مهني 1', labelEn: 'Worker 1' },
  { id: 'av-2', url: '/avatars/avatar-2.jpg', labelAr: 'مهني 2', labelEn: 'Worker 2' },
  { id: 'av-3', url: '/avatars/avatar-3.jpg', labelAr: 'سيدة أعمال', labelEn: 'Business' },
  { id: 'av-4', url: '/avatars/avatar-4.jpg', labelAr: 'حنانة / خياطة', labelEn: 'Craftswoman' },
  { id: 'av-5', url: '/avatars/avatar-5.jpg', labelAr: 'عميل 1', labelEn: 'Hirer 1' },
  { id: 'av-6', url: '/avatars/avatar-6.jpg', labelAr: 'عميل 2', labelEn: 'Hirer 2' },
];

export const DEFAULT_AVATAR_URL = PRESET_AVATARS[0].url;
