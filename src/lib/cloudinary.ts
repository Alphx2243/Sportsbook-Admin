import { v2 as cloudinary } from 'cloudinary';
import { requireServerEnv } from './env';

cloudinary.config({
    cloud_name: requireServerEnv('CLOUDINARY_CLOUD_NAME'),
    api_key: requireServerEnv('CLOUDINARY_API_KEY'),
    api_secret: requireServerEnv('CLOUDINARY_API_SECRET'),
});

export default cloudinary;
