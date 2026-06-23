const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5MB

const allowedImageTypes = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedFileTypes = ['.pdf', '.docx', '.xlsx', '.zip', '.txt'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = './uploads/messages';

    // ✅ 动态目录切换：判断路径或字段
    if (file.fieldname === 'image' && req.baseUrl.includes('/components')) {
      dir = './uploads/components';
    }

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + file.fieldname + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = file.fieldname === 'image';

  if (isImage && !allowedImageTypes.includes(ext)) {
    return cb(new Error('Type d’image invalide'), false);
  }

  if (!isImage && !allowedFileTypes.includes(ext)) {
    return cb(new Error('Type de fichier invalide'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }, // 每个文件最大限制
});

module.exports = upload;
