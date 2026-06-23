const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'NO_TOKEN', message: 'Token manquant.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 统一 user 对象结构
    req.user = {
      id: decoded.id,      // 将原始 userId 变成 id 字段
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    return res.status(403).json({ code: 'INVALID_TOKEN', message: 'Token invalide ou expiré.' });
  }
}

module.exports = verifyToken;
