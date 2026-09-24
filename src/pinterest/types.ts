export interface UserAccount {
  account_type: string;
  id: string;
  username: string;
  profile_image?: string;
  website_url?: string;
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  owner?: { username: string };
  privacy?: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count?: number;
  created_at?: string;
}

export interface BoardSection {
  id: string;
  name: string;
}

/** One rendition of a pin's image, keyed by size label such as "1200x". */
export interface ImageVariant {
  url: string;
  width: number;
  height: number;
}

export interface PinMedia {
  media_type?: 'image' | 'video' | 'multiple_images' | string;
  images?: Record<string, ImageVariant>;
  /** Present on video pins. */
  video_url?: string;
  duration?: number;
  cover_image_url?: string;
}

export interface Pin {
  id: string;
  created_at?: string;
  link?: string;
  title?: string;
  description?: string;
  alt_text?: string;
  board_id?: string;
  board_section_id?: string;
  media?: PinMedia;
  note?: string;
  dominant_color?: string;
}

export type MediaType = 'image' | 'video';

export interface MediaUploadRegistration {
  media_id: string;
  media_type: MediaType;
  upload_url: string;
  /** One-time S3 form fields that must be POSTed alongside the file. */
  upload_parameters: Record<string, string>;
}

export interface MediaUploadStatus {
  media_id: string;
  media_type: MediaType;
  status: 'registered' | 'processing' | 'succeeded' | 'failed' | string;
}

export type MediaSource =
  | { source_type: 'image_url'; url: string; is_standard?: boolean }
  | { source_type: 'image_base64'; content_type: string; data: string }
  | { source_type: 'video_id'; media_id: string; cover_image_url: string }
  | {
      source_type: 'multiple_image_urls';
      items: { url: string; title?: string; description?: string; link?: string }[];
      index?: number;
    };

export interface CreatePinInput {
  board_id: string;
  media_source: MediaSource;
  title?: string;
  description?: string;
  alt_text?: string;
  link?: string;
  board_section_id?: string;
  note?: string;
}

export interface CreateBoardInput {
  name: string;
  description?: string;
  privacy?: 'PUBLIC' | 'PROTECTED' | 'SECRET';
}
