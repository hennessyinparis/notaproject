export type AudioAd = {
  id: number;
  title: string;
  image_url: string;
  audio_url: string;
  link: string;
  duration_seconds?: number | null;
};

export type AdAdmin = AudioAd & {
  active: boolean;
};
