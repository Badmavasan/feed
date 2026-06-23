const express = require('express');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const verifyToken = require('../middlewares/verifyToken');
const { checkProjectMembership } = require('../utils/projectPermissions');


/**
 * @swagger
 * /api/users/list:
 *   get:
 *     summary: Obtenir la liste paginée des tous les utilisateurs avec recherche(superAdmin)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page actuelle
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche par nom ou email
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 */
router.get('/list', verifyToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const skip = (page - 1) * pageSize;

  const whereClause = {
    OR: [
      { name: { contains: search } },
      { email: { contains: search } }
    ]
  };

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        include: { permissions: true }
      })
    ]);

  res.json({
    total,
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.is_active,
      permissions: u.permissions.reduce((acc, p) => {
        acc[p.module] = {
          create: p.can_create,
          update: p.can_update,
          delete: p.can_delete
        };
        return acc;
      }, {})
    }))
  });
});


/**
 * @swagger
 * /api/users/auteurs:
 *   get:
 *     summary: Obtenir la liste paginée des auteurs avec recherche(admin)
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste des utilisateurs de rôle auteur
 */
router.get('/auteurs', verifyToken, async (req, res) => {
  const { page = 1, pageSize = 10, search = '' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const [total, users] = await Promise.all([
    prisma.user.count({
      where: {
        role: 'auteur',
        OR: [
          { name: { contains: search } },
          { email: { contains: search } }
        ]
      }
    }),
    prisma.user.findMany({
      where: {
        role: 'auteur',
        OR: [
          { name: { contains: search } },
          { email: { contains: search } }
        ]
      },
      skip,
      take: parseInt(pageSize),
      include: { permissions: true }
    })
  ]);

  res.json({
    total,
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.is_active,
      permissions: u.permissions.reduce((acc, p) => {
        acc[p.module] = {
          create: p.can_create,
          update: p.can_update,
          delete: p.can_delete
        };
        return acc;
      }, {})
    }))
  });
});



/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Créer un nouvel utilisateur (avec permissions)  
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [auteur, admin]
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     create:
 *                       type: boolean
 *                     update:
 *                       type: boolean
 *                     delete:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 */

// Create a user No more authorization because authorization should be authorized under the project
// (Simplified version, no email sent, set a unified initial password)
router.post('/', verifyToken, async (req, res) => {
  const { name, email, role } = req.body;
  const currentUser = req.user;

  // Verify that the current user has the authority to create the role
  if (currentUser.role === 'admin' && role !== 'auteur') {
    return res.status(403).json({ message: "Les administrateurs ne peuvent créer que des auteurs." });
  }

  if (!['auteur', 'admin'].includes(role)) {
    return res.status(400).json({ message: "Rôle invalide." });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD;
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      is_active: true,
      password_hash: hashedPassword
    }
  });

  res.status(201).json({
    message: `User created successfully. The default password is: ${defaultPassword}`,
    defaultPassword,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});


/**
 * @swagger
 * /api/users/{id}/active:
 *   put:
 *     summary: Activate or deactivate a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Set to true to activate, false to deactivate
 *     responses:
 *       200:
 *         description: User account status updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put('/:id/active', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const { isActive } = req.body;
  await prisma.user.update({ where: { id }, data: { is_active: isActive } });
  res.json({ message: 'Mise à jour' });
});


// Before deleting a user, prompt: which projects he is involved in
router.get('/:id/associations', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { project: true }
        },
        permissions: true,
        moderationRequests: true,
        reviewedRequests: true,
        sentMessages: true,
        receivedMessages: true
      }
    });

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    res.json({
      projects: user.memberships.map(m => ({
        id: m.project.id,
        name: m.project.name,
        role: m.role
      })),
      permissionsCount: user.permissions.length,
      requestsCount: user.moderationRequests.length + user.reviewedRequests.length,
      messageCount: user.sentMessages.length + user.receivedMessages.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});


//  Delete the user (and clean up all associations)
router.delete('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    // Clear Project Association
    await prisma.projectMembership.deleteMany({ where: { user_id: id } });

    // Clear permissions
    await prisma.userPermission.deleteMany({ where: { user_id: id } });

    // Clear review request
    await prisma.moderationRequest.deleteMany({ where: {
      OR: [
        { requester_id: id },
        { reviewed_by: id }
      ]
    }});

    // Clear Message
    await prisma.internalMessage.deleteMany({
      where: {
        OR: [
          { senderId: id },
          { receiverId: id }
        ]
      }
    });

    // Deleting a User
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('[DELETE USER ERROR]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});


/**
 * @swagger
 * /api/users/project-auteurs:
 *   get:
 *     summary: Get a paginated list of auteurs in the current project
 *     tags: [Project Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: List of auteurs in the project
 */
// Get all auteurs under a project (pagination + search) => GET /api/users/project-auteurs?projectId=xx
router.get('/project-auteurs', verifyToken, checkProjectMembership, async (req, res) => {
  const { page = 1, pageSize = 10, search = '' } = req.query;
  const projectId = req.projectId;
  const skip = (parseInt(page) - 1) * parseInt(pageSize);

  const membership = await prisma.projectMembership.findUnique({
    where: {
      user_id_project_id: {
        user_id: req.user.id,
        project_id: projectId
      }
    }
  });

  if (!membership || membership.role !== 'editeur') {
    return res.status(403).json({ message: 'You are not the editeur of the project.' });
  }

  const [total, memberships] = await Promise.all([
    prisma.projectMembership.count({
      where: {
        project_id: projectId,
        role: 'auteur',
        user: {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } }
          ]
        }
      }
    }),

    prisma.projectMembership.findMany({
      where: {
        project_id: projectId,
        role: 'auteur',
        user: {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } }
          ]
        }
      },
      skip,
      take: parseInt(pageSize),
      include: {
        user: true
      },
      orderBy: {
        user_id: 'asc'
      }
    })
  ]);

  if (total === 0) {
    return res.json({
      message: 'There is no auteur under this project yet.',
      total: 0,
      auteurs: []
    });
  }

  const auteurs = memberships.map(m => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.user.role,
    isActive: m.user.is_active
  }));


  res.json({ total, page: Number(page), pageSize: Number(pageSize), auteurs });
});


/**
 * @swagger
 * /api/users/project-auteur-permissions:
 *   put:
 *     summary: Update an auteur's module permissions in a project
 *     tags: [Project Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the project
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     create:
 *                       type: boolean
 *                     update:
 *                       type: boolean
 *                     delete:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *       400:
 *         description: Invalid permission payload
 *       500:
 *         description: Internal server error
 */
router.put('/project-auteur-permissions', verifyToken, checkProjectMembership, async (req, res) => {
  const projectId = req.projectId;
  const userId = parseInt(req.query.userId);
  const { permissions } = req.body;

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ message: 'Missing permission parameter' });
  }

  try {
    // Remove old permissions
    await prisma.userPermission.deleteMany({ where: { user_id: userId, project_id: projectId } });

    // Assembling new permission data
    const data = Object.entries(permissions).map(([module, perms]) => ({
      user_id: userId,
      project_id: projectId,
      module,
      can_create: perms.create,
      can_update: perms.update,
      can_delete: perms.delete
    }));

    await prisma.userPermission.createMany({ data });
    res.json({ message: 'Permissions saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save permissions' });
  }
});


/**
 * @swagger
 * /api/users/{id}/permissions:
 *   get:
 *     summary: Get an auteur's permissions in the current project
 *     tags: [Project Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: User permission data
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/:id/permissions', verifyToken, checkProjectMembership, async (req, res) => {
  const userId = parseInt(req.params.id);
  const projectId = req.projectId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

  // The current requester must be an editeur of the project
  const editorMembership = await prisma.projectMembership.findUnique({
    where: {
      user_id_project_id: {
        user_id: req.user.id,
        project_id: projectId
      }
    }
  });

  if (!editorMembership || editorMembership.role !== 'editeur') {
    return res.status(403).json({ message: 'Only an editor can view permissions.' });
  }

  const permissions = await prisma.userPermission.findMany({
    where: {
      user_id: userId,
      project_id: projectId
    }
  });

  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    projectId,
    permissions: permissions.reduce((acc, p) => {
      acc[p.module] = {
        create: p.can_create,
        update: p.can_update,
        delete: p.can_delete
      };
      return acc;
    }, {})
  });
});


/**
 * @swagger
 * /api/users/active-auteurs:
 *   get:
 *     summary: Get all active users with role 'auteur'
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional name or email search
 *     responses:
 *       200:
 *         description: List of active auteur users
 */
router.get('/active-auteurs', verifyToken, async (req, res) => {
  const { search } = req.query;

  try {
    const auteurs = await prisma.user.findMany({
      where: {
        role: 'auteur',
        is_active: true,
        OR: search
          ? [
              { name: { contains: search } },
              { email: { contains: search } }
            ]
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.json(auteurs);
  } catch (error) {
    console.error('Failed to get auteurs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/users/active-admins:
 *   get:
 *     summary: Get all active admin users (excluding self)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Optional name or email search
 *     responses:
 *       200:
 *         description: List of active admin users excluding the current user
 */
router.get('/active-admins', verifyToken, async (req, res) => {
  const { search } = req.query;

  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        is_active: true,
        id: { not: req.user.id }, // Exclude Yourself
        OR: search
          ? [
              { name: { contains: search } },
              { email: { contains: search } }
            ]
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.json(admins);
  } catch (error) {
    console.error('Failed to get admins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/users/selectable:
 *   get:
 *     summary: Get selectable users for messaging (active only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active users with minimal profile info
 *       500:
 *         description: Server error
 */
router.get("/selectable", verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await prisma.user.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.error(" Failed to fetch user list:", error);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get system user detail including project memberships
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: User details with associated projects
 *       404:
 *         description: User not found
 */
router.get('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable' });
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    projects: user.memberships.map(m => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description
    }))
  });
});

router.post("/change-password", verifyToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || typeof user.password_hash !== "string") {
        return res.status(400).json({ message: "User account is not properly configured." });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect." });
    }



  

    if (oldPassword === newPassword) {
        return res.status(400).json({ message: "New password must be different from current password." });
    }

    const isStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?{}[\]~])[A-Za-z\d!@#$%^&*()_\-+=<>?{}[\]~]{8,}$/.test(newPassword);
    if (!isStrong) {
        return res.status(400).json({ message: "Password does not meet strength requirements." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: { password_hash: hashed },
    });

    return res.json({ message: "Password updated successfully." });
});


module.exports = router;
