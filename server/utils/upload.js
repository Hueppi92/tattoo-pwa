import multer from 'multer';
import path from 'path';
import fs from 'fs';

export function makeUploader(baseDir, subDir) {
  const dir = path.join(baseDir, subDir);
  fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, ts + '-' + safe);
    }
  });
  return multer({ storage });
}
