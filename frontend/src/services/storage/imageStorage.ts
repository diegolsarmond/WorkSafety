/**
 * Armazenamento de imagens para uso offline
 * Comprime e armazena imagens no IndexedDB
 */

import { getItem, setItem, removeItem, getAllKeys } from './core';
import { STORAGE_KEYS } from './types';
import type { StoredImageMetadata } from './types';

// Configurações de compressão
const COMPRESSION_CONFIG = {
  high: { maxWidth: 1920, maxHeight: 1920, quality: 0.9 },
  medium: { maxWidth: 1280, maxHeight: 1280, quality: 0.7 },
  low: { maxWidth: 800, maxHeight: 800, quality: 0.5 },
};

/**
 * Gera ID único para imagem
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Comprime uma imagem
 */
async function compressImage(
  file: File | Blob,
  quality: 'high' | 'medium' | 'low' = 'medium'
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const config = COMPRESSION_CONFIG[quality];
      let { width, height } = img;
      
      // Redimensiona mantendo aspect ratio
      if (width > config.maxWidth || height > config.maxHeight) {
        const ratio = Math.min(config.maxWidth / width, config.maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      // Cria canvas para compressão
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível criar contexto do canvas'));
        return;
      }
      
      // Desenha imagem
      ctx.drawImage(img, 0, 0, width, height);
      
      // Converte para blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, width, height });
          } else {
            reject(new Error('Falha ao comprimir imagem'));
          }
        },
        'image/jpeg',
        config.quality
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem'));
    };
    
    img.src = url;
  });
}

/**
 * Cria thumbnail de uma imagem
 */
async function createThumbnail(
  file: File | Blob,
  maxSize: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      const ratio = Math.min(maxSize / width, maxSize / height);
      
      if (ratio < 1) {
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível criar thumbnail'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao criar thumbnail'));
          }
        },
        'image/jpeg',
        0.6
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem'));
    };
    
    img.src = url;
  });
}

/**
 * Armazena uma imagem
 */
export async function storeImage(
  file: File | Blob,
  options: {
    inspectionId?: string;
    quality?: 'high' | 'medium' | 'low';
    generateThumbnail?: boolean;
    tags?: string[];
  } = {}
): Promise<StoredImageMetadata> {
  const {
    inspectionId,
    quality = 'medium',
    generateThumbnail = true,
    tags,
  } = options;

  const imageId = generateImageId();
  const originalName = file instanceof File ? file.name : 'image.jpg';
  const originalSize = file.size;

  // Comprime imagem
  const { blob: compressedBlob, width, height } = await compressImage(file, quality);

  // Armazena imagem comprimida
  await setItem(`${STORAGE_KEYS.IMAGES.BLOB_PREFIX}${imageId}`, compressedBlob);

  // Gera e armazena thumbnail se solicitado
  if (generateThumbnail) {
    try {
      const thumbnail = await createThumbnail(file);
      await setItem(`${STORAGE_KEYS.IMAGES.THUMBNAIL_PREFIX}${imageId}`, thumbnail);
    } catch (error) {
      console.warn('Falha ao criar thumbnail:', error);
    }
  }

  // Cria metadata
  const metadata: StoredImageMetadata = {
    id: imageId,
    originalName,
    mimeType: 'image/jpeg',
    size: compressedBlob.size,
    width,
    height,
    inspectionId,
    createdAt: new Date().toISOString(),
    synced: false,
    compressed: compressedBlob.size < originalSize,
    tags,
  };

  // Armazena metadata
  await setItem(`${STORAGE_KEYS.IMAGES.METADATA}:${imageId}`, metadata);

  return metadata;
}

/**
 * Obtém uma imagem armazenada
 */
export async function getImage(imageId: string): Promise<Blob | undefined> {
  return getItem<Blob>(`${STORAGE_KEYS.IMAGES.BLOB_PREFIX}${imageId}`);
}

/**
 * Obtém o thumbnail de uma imagem
 */
export async function getImageThumbnail(imageId: string): Promise<Blob | undefined> {
  return getItem<Blob>(`${STORAGE_KEYS.IMAGES.THUMBNAIL_PREFIX}${imageId}`);
}

/**
 * Obtém metadata de uma imagem
 */
export async function getImageMetadata(imageId: string): Promise<StoredImageMetadata | undefined> {
  return getItem<StoredImageMetadata>(`${STORAGE_KEYS.IMAGES.METADATA}:${imageId}`);
}

/**
 * Obtém URL para preview de uma imagem (blob URL)
 * IMPORTANTE: Chamar URL.revokeObjectURL() quando não precisar mais
 */
export async function getImagePreviewUrl(imageId: string): Promise<string | null> {
  const blob = await getImage(imageId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Obtém URL para preview do thumbnail
 */
export async function getThumbnailPreviewUrl(imageId: string): Promise<string | null> {
  const blob = await getImageThumbnail(imageId);
  if (!blob) {
    // Fallback para imagem original se não tiver thumbnail
    return getImagePreviewUrl(imageId);
  }
  return URL.createObjectURL(blob);
}

/**
 * Lista todas as imagens armazenadas
 */
export async function listStoredImages(
  filter?: {
    inspectionId?: string;
    synced?: boolean;
    tags?: string[];
  }
): Promise<StoredImageMetadata[]> {
  const allKeys = await getAllKeys();
  const metadataKeys = allKeys.filter(key => 
    key.startsWith(`${STORAGE_KEYS.IMAGES.METADATA}:`)
  );

  const images: StoredImageMetadata[] = [];

  for (const key of metadataKeys) {
    const metadata = await getItem<StoredImageMetadata>(key);
    if (!metadata) continue;

    // Aplica filtros
    if (filter?.inspectionId && metadata.inspectionId !== filter.inspectionId) {
      continue;
    }
    if (filter?.synced !== undefined && metadata.synced !== filter.synced) {
      continue;
    }
    if (filter?.tags && !filter.tags.some(tag => metadata.tags?.includes(tag))) {
      continue;
    }

    images.push(metadata);
  }

  // Ordena por data de criação (mais recente primeiro)
  return images.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Marca imagem como sincronizada
 */
export async function markImageAsSynced(imageId: string): Promise<void> {
  const metadata = await getImageMetadata(imageId);
  if (metadata) {
    metadata.synced = true;
    await setItem(`${STORAGE_KEYS.IMAGES.METADATA}:${imageId}`, metadata);
  }
}

/**
 * Remove uma imagem do storage
 */
export async function deleteImage(imageId: string): Promise<void> {
  await Promise.all([
    removeItem(`${STORAGE_KEYS.IMAGES.BLOB_PREFIX}${imageId}`),
    removeItem(`${STORAGE_KEYS.IMAGES.THUMBNAIL_PREFIX}${imageId}`),
    removeItem(`${STORAGE_KEYS.IMAGES.METADATA}:${imageId}`),
  ]);
}

/**
 * Remove múltiplas imagens
 */
export async function deleteImages(imageIds: string[]): Promise<void> {
  await Promise.all(imageIds.map(id => deleteImage(id)));
}

/**
 * Obtém estatísticas de imagens
 */
export async function getImageStats(): Promise<{
  total: number;
  totalSize: number;
  synced: number;
  unsynced: number;
}> {
  const images = await listStoredImages();
  
  return {
    total: images.length,
    totalSize: images.reduce((sum, img) => sum + img.size, 0),
    synced: images.filter(img => img.synced).length,
    unsynced: images.filter(img => !img.synced).length,
  };
}

/**
 * Limpa imagens sincronizadas antigas
 */
export async function cleanupSyncedImages(keepCount: number = 20): Promise<number> {
  const syncedImages = await listStoredImages({ synced: true });
  
  if (syncedImages.length <= keepCount) return 0;

  // Mantém as mais recentes
  const toDelete = syncedImages.slice(keepCount);
  await deleteImages(toDelete.map(img => img.id));
  
  return toDelete.length;
}
