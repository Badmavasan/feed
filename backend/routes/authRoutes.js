const express = require('express');
const verifyToken = require('../middlewares/verifyToken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

const router = express.Router();

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Successful login, returns token and user info
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account inactive
 *       400:
 *         description: Missing fields
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ code: 'MISSING_FIELDS', message: 'Email and password required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ code: 'USER_INACTIVE', message: 'User inactive. Please contact admin.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    // Query the project to which the user belongs (take the first one as the default)
    const userProjects = await prisma.projectMembership.findMany({
      where: { user_id: user.id },
      orderBy: { id: 'asc' },
      take: 1,
      select: { project_id: true }
    });
    const defaultProjectId = userProjects.length > 0 ? userProjects[0].project_id : null;

    //Generate JWT with default project ID
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        projectId: defaultProjectId, // Add default items
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        defaultProjectId // 可以返回给前端备用
      }
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Unexpected server error.' });
  }
});



/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 avatar_url:
 *                   type: string
 *                 role:
 *                   type: string
 *                 is_active:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 */
router.get('/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        role: true,
        is_active: true,
        created_at: true
      }
    });

    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable.' });
    }

    res.json(user);
  } catch (err) {
    console.error('[AUTH_ME ERROR]', err);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Erreur serveur.' });
  }
});


/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 example: 123456
 *               name:
 *                 type: string
 *                 example: New User
 *               role:
 *                 type: string
 *                 enum: [auteur, admin, super_admin]
 *                 example: auteur
 *     responses:
 *       201:
 *         description: Account created, returns token and user info
 *       400:
 *         description: Missing fields
 *       409:
 *         description: Email already registered
 */
router.post('/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ code: 'MISSING_FIELDS', message: 'Email and password required.' });
  }

  const allowedRoles = ['auteur', 'admin', 'super_admin'];
  const userRole = role && allowedRoles.includes(role) ? role : 'auteur';

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ code: 'EMAIL_TAKEN', message: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name: name || null,
        role: userRole,
        is_active: true,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, projectId: null },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
        defaultProjectId: null,
      },
    });
  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Unexpected server error.' });
  }
});


module.exports = router;
