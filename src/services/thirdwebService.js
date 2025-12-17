import { ThirdwebStorage } from "@thirdweb-dev/storage";

// Thirdweb Storage instance
const storage = new ThirdwebStorage({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || undefined, // Optional - daha hızlı upload için
});

// IPFS Gateway URLs
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/'
];

/**
 * Base64 data URL'i File'a çevir
 */
function dataURLtoFile(dataURL, filename = 'image.jpg') {
  try {
    // Data URL formatını kontrol et
    if (!dataURL || typeof dataURL !== 'string') {
      throw new Error('Invalid data URL: not a string');
    }
    
    if (!dataURL.includes(',')) {
      throw new Error('Invalid data URL format: missing comma separator');
    }

    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    
    if (!mimeMatch) {
      // Varsayılan mime type kullan
      console.warn('Could not detect mime type, using image/jpeg');
    }
    
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (error) {
    console.error('dataURLtoFile error:', error, 'Input:', dataURL?.substring(0, 100));
    throw new Error('Failed to convert data URL to file: ' + error.message);
  }
}

/**
 * Blob URL'den File oluştur
 */
async function blobURLtoFile(blobUrl, filename = 'image.jpg') {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  } catch (error) {
    console.error('blobURLtoFile error:', error);
    throw new Error('Failed to convert blob URL to file: ' + error.message);
  }
}

/**
 * Tek bir görseli IPFS'e yükle
 * @param {string|File|Blob} image - Görsel (base64 data URL, blob URL, File veya Blob)
 * @param {string} filename - Dosya adı
 * @returns {Promise<string>} - IPFS URI (ipfs://...)
 */
export async function uploadImageToIPFS(image, filename = 'image.jpg') {
  try {
    console.log('uploadImageToIPFS called with:', {
      type: typeof image,
      isString: typeof image === 'string',
      isBlob: image instanceof Blob,
      isFile: image instanceof File,
      startsWithData: typeof image === 'string' ? image.startsWith('data:') : false,
      startsWithBlob: typeof image === 'string' ? image.startsWith('blob:') : false,
      preview: typeof image === 'string' ? image.substring(0, 50) + '...' : 'N/A'
    });

    let file;
    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        // Base64 data URL ise File'a çevir
        console.log('Converting data URL to File...');
        file = dataURLtoFile(image, filename);
        console.log('File created:', file.name, file.type, file.size, 'bytes');
      } else if (image.startsWith('blob:')) {
        // Blob URL ise fetch ile al ve File'a çevir
        console.log('Converting blob URL to File...');
        file = await blobURLtoFile(image, filename);
        console.log('File created from blob URL:', file.name, file.type, file.size, 'bytes');
      } else {
        throw new Error('Invalid string format. Expected data URL or blob URL.');
      }
    } else if (image instanceof Blob) {
      console.log('Converting Blob to File...');
      file = new File([image], filename, { type: image.type || 'image/jpeg' });
    } else if (image instanceof File) {
      console.log('Using File directly...');
      file = image;
    } else {
      console.error('Invalid image format received:', image);
      throw new Error('Invalid image format. Expected data URL, blob URL, Blob, or File.');
    }

    // Thirdweb Storage ile yükle
    console.log('Uploading to Thirdweb Storage...');
    const uri = await storage.upload(file);
    console.log('Image uploaded successfully:', uri);
    return uri;
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image to IPFS: ' + error.message);
  }
}

/**
 * Birden fazla görseli IPFS'e yükle
 * @param {Array<string|File|Blob>} images - Görseller
 * @returns {Promise<Array<string>>} - IPFS URI'leri
 */
export async function uploadImagesToIPFS(images) {
  try {
    // Tüm görselleri File'a çevir (async işlemler için Promise.all kullan)
    const filePromises = images.map(async (image, index) => {
      if (typeof image === 'string') {
        if (image.startsWith('data:')) {
          return dataURLtoFile(image, `image_${index + 1}.jpg`);
        } else if (image.startsWith('blob:')) {
          return await blobURLtoFile(image, `image_${index + 1}.jpg`);
        } else {
          throw new Error('Invalid string format. Expected data URL or blob URL.');
        }
      } else if (image instanceof Blob) {
        return new File([image], `image_${index + 1}.jpg`, { type: image.type || 'image/jpeg' });
      } else if (image instanceof File) {
        return image;
      }
      throw new Error('Invalid image format');
    });

    const files = await Promise.all(filePromises);

    // Batch upload ile yükle (daha hızlı)
    const uris = await storage.uploadBatch(files);
    console.log('Images uploaded:', uris);
    return uris;
  } catch (error) {
    console.error('Images upload error:', error);
    throw new Error('Failed to upload images to IPFS: ' + error.message);
  }
}

/**
 * NFT Metadata'yı IPFS'e yükle
 * @param {Object} metadata - Metadata objesi { name, description, price, images, creator }
 * @returns {Promise<string>} - Metadata URI (ipfs://...)
 */
export async function uploadMetadataToIPFS(metadata) {
  try {
    // NFT metadata standardına uygun format (ERC-721/1155)
    const nftMetadata = {
      name: metadata.name,
      description: metadata.description,
      image: metadata.images[0], // Ana görsel (zaten ipfs:// formatında)
      attributes: [
        {
          trait_type: 'Price',
          value: metadata.price
        },
        {
          trait_type: 'Total Images',
          value: metadata.images.length
        }
      ],
      properties: {
        images: metadata.images, // Tüm görseller
        price: metadata.price,
        creator: metadata.creator
      }
    };

    // Metadata'yı IPFS'e yükle
    const uri = await storage.upload(nftMetadata);
    console.log('Metadata uploaded:', uri);
    return uri;
  } catch (error) {
    console.error('Metadata upload error:', error);
    throw new Error('Failed to upload metadata to IPFS: ' + error.message);
  }
}

/**
 * Görselleri ve metadata'yı IPFS'e yükle
 * @param {Array<string>} images - Base64 görseller
 * @param {Object} packData - { name, description, price, creator }
 * @returns {Promise<{imageUris: string[], metadataUri: string, baseUri: string}>}
 */
export async function uploadMoodPackToIPFS(images, packData) {
  try {
    // 1. Görselleri yükle
    console.log('Uploading images to IPFS...');
    const imageUris = await uploadImagesToIPFS(images);
    console.log('Images uploaded:', imageUris);

    // 2. Metadata'yı oluştur ve yükle
    console.log('Uploading metadata to IPFS...');
    const metadataUri = await uploadMetadataToIPFS({
      name: packData.name,
      description: packData.description,
      price: packData.price,
      images: imageUris,
      creator: packData.creator
    });
    console.log('Metadata uploaded:', metadataUri);

    // 3. Gateway URL'ini oluştur (baseUri için)
    const baseUri = resolveIPFSUri(metadataUri);

    return {
      imageUris,
      metadataUri,
      baseUri
    };
  } catch (error) {
    console.error('Mood pack upload error:', error);
    throw error;
  }
}

/**
 * IPFS URI'yi gateway URL'e çevir
 * @param {string} uri - IPFS URI (ipfs://...)
 * @param {number} gatewayIndex - Gateway indexi (default: 0)
 * @returns {string} - Gateway URL
 */
export function resolveIPFSUri(uri, gatewayIndex = 0) {
  if (!uri) return '';
  
  // Zaten HTTP URL ise döndür
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  
  // ipfs:// prefix'ini kaldır ve gateway URL oluştur
  const cid = uri.replace('ipfs://', '');
  return `${IPFS_GATEWAYS[gatewayIndex]}${cid}`;
}

/**
 * CID'den ipfs:// URI oluştur
 * @param {string} cid - IPFS CID
 * @returns {string} - ipfs:// URL
 */
export function getIPFSProtocolUrl(cid) {
  if (cid.startsWith('ipfs://')) return cid;
  return `ipfs://${cid}`;
}

/**
 * Thirdweb Storage instance'ını döndür (advanced usage için)
 */
export function getStorage() {
  return storage;
}

export default {
  uploadImageToIPFS,
  uploadImagesToIPFS,
  uploadMetadataToIPFS,
  uploadMoodPackToIPFS,
  resolveIPFSUri,
  getIPFSProtocolUrl,
  getStorage
};
