const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const verifyToken = require('../middlewares/verifyToken'); // 认证中间件

/**
 * @swagger
 * /api/projects/mine:
 *   get:
 *     summary: Get all projects of current user
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 */

router.get('/mine', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all projects owned by a user from the projectMembership table
    const memberships = await prisma.projectMembership.findMany({
      where: { user_id: userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Retrieve the project list
    const projects = memberships.map(m => ({
      id: m.project.id,
      name: m.project.name,
    }));

    res.json(projects);
  } catch (error) {
    console.error('[GET /api/projects/mine] error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get paginated list of projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: createdOnly
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: joinedOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Paginated list of projects
 */
router.get("/", verifyToken, async (req, res) => {
const page = typeof req.query.page === 'string' ? parseInt(req.query.page) : 1;
const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
  const skip = (page - 1) * limit;
  const search = req.query.search?.toString() || "";
  const createdOnly = req.query.createdOnly === "true";
  const joinedOnly = req.query.joinedOnly === "true";

  const baseWhere = {
    name: { contains: search },
  };

  try {
    let where = { ...baseWhere };

    if (createdOnly) {
      where.creator_id = req.user.id;
    } else if (joinedOnly) {
      // 通过关系查询用户参与的项目
      const memberships = await prisma.projectMembership.findMany({
        where: { user_id: req.user.id },
        select: { project_id: true },
      });
      const projectIds = memberships.map(m => m.project_id);

      where.id = { in: projectIds };
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can view all projects" });
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    res.json({ data: projects, total });
  } catch (e) {
    console.error("Fetch paginated projects error:", e);
    res.status(500).json({ message: "Failed to fetch project list" });
  }
});


/**
 * @swagger
 * /api/projects/{id}/members:
 *   put:
 *     summary: Update project members (editeur only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               editeurs:
 *                 type: array
 *                 items:
 *                   type: integer
 *               auteurs:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Members updated
 */
router.put("/:id/members", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const { editeurs = [], auteurs = [] } = req.body;

  const membership = await prisma.projectMembership.findFirst({
    where: { user_id: req.user.id, project_id: id, role: "editeur" },
  });

  if (!membership) {
    return res.status(403).json({ message: "Only editeur can manage members" });
  }

  try {
    // Delete all old members
    await prisma.projectMembership.deleteMany({ where: { project_id: id } });

    // Reinsert
    await prisma.projectMembership.createMany({
      data: [
        ...editeurs.map(uid => ({ user_id: uid, project_id: id, role: "editeur" })),
        ...auteurs.map(uid => ({ user_id: uid, project_id: id, role: "auteur" })),
        { user_id: req.user.id, project_id: id, role: "editeur" }, // 保证自己在
      ],
      skipDuplicates: true,
    });

    res.json({ message: "Members updated successfully" });
  } catch (e) {
    console.error("Update members error:", e);
    res.status(500).json({ message: "Failed to update members" });
  }
});


/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project (admin only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               members:
 *                 type: array
 *                 description: Array of auteur user IDs
 *                 items:
 *                   type: integer
 *               editeurs:
 *                 type: array
 *                 description: Array of admin user IDs to be set as editeurs
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Project created with members
 */
router.post("/", verifyToken, async (req, res) => {
  const { name, description, members = [], editeurs = [] } = req.body;

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can create projects" });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        description,
        creator: {
          connect: { id: req.user.id }, // Association Creator
        },
        memberships: {
          createMany: {
            data: [
              ...members.map((id) => ({ user_id: id, role: "auteur" })),
              ...editeurs.map((id) => ({ user_id: id, role: "editeur" })),
              { user_id: req.user.id, role: "editeur" },
            ],
            skipDuplicates: true,
          },
        },
      },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    res.json(project);
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ message: "Failed to create project" });
  }
});

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update a project and its members (editeur only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               members:
 *                 type: array
 *                 items:
 *                   type: integer
 *               editeurs:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Project updated
 *       409:
 *         description: Project name already exists
 */
router.put("/:id", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, members = [], editeurs = [] } = req.body;

  const membership = await prisma.projectMembership.findFirst({
    where: {
      user_id: req.user.id,
      project_id: id,
      role: "editeur",
    },
  });

  if (!membership) {
    return res.status(403).json({ message: "Only project editeur can update" });
  }

  try {
    // Find Current Project
    const existingProject = await prisma.project.findUnique({ where: { id } });

    // If the name changes, check whether it is repeated
    if (existingProject.name !== name) {
      const nameExists = await prisma.project.findFirst({
        where: {
          name,
          NOT: { id }, // Excluding current project
        },
      });

      if (nameExists) {
        return res.status(409).json({ message: "Project name already exists" });
      }
    }

    // Update project information
    await prisma.project.update({
      where: { id },
      data: { name, description },
    });

    // Clear old membership
    await prisma.projectMembership.deleteMany({ where: { project_id: id } });

    // Re-insert new members
    await prisma.projectMembership.createMany({
      data: [
        ...members.map((uid) => ({ user_id: uid, project_id: id, role: "auteur" })),
        ...editeurs.map((uid) => ({ user_id: uid, project_id: id, role: "editeur" })),
        { user_id: req.user.id, project_id: id, role: "editeur" }, // 保证自己为 editeur
      ],
      skipDuplicates: true,
    });

    res.json({ message: "Project updated successfully" });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ message: "Failed to update project" });
  }
});


/**
 * @swagger
 * /api/projects/{id}/related:
 *   get:
 *     summary: Get all data associated with a project (editeur only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of associated entities under the project
 */
router.get("/:id/related", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);

  const membership = await prisma.projectMembership.findFirst({
    where: { project_id: id, user_id: req.user.id, role: "editeur" },
  });

  if (!membership) {
    return res.status(403).json({ message: "Only project editeur can view related data" });
  }

  const [taskTypes, errors, exercises, components, feedbacks] = await Promise.all([
    prisma.taskType.findMany({ where: { project_id: id } }),
    prisma.error.findMany({ where: { project_id: id } }),
    prisma.exercise.findMany({ where: { project_id: id } }),
    prisma.feedbackComponent.findMany({ where: { project_id: id } }),
    prisma.feedback.findMany({ where: { project_id: id } }),
  ]);

  res.json({
    taskTypes: taskTypes.map((t) => t.task_code),
    errors: errors.map((e) => e.error_tag),
    exercises: exercises.map((e) => e.title),
    components: components.map((c) => c.tag),
    feedbacks: feedbacks.map((f) => f.feedback_code),
  });
});


/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a project and all its related data (editeur only)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project and associated data deleted
 *       403:
 *         description: Unauthorized
 */
router.delete("/:id", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  // Check if the user is an 'editeur' in this project
  const membership = await prisma.projectMembership.findFirst({
    where: {
      user_id: req.user.id,
      project_id: id,
      role: "editeur",
    },
  });

  if (!membership) {
    return res.status(403).json({ message: "Only project editeur can delete" });
  }
  
  try {
    await prisma.$transaction([
      // Delete project membership records
      prisma.projectMembership.deleteMany({ where: { project_id: id } }),

      // Delete component ↔ exercise many-to-many associations
      prisma.componentExercise.deleteMany({ where: { component: { project_id: id } } }),

      // Delete component ↔ taskType many-to-many associations
      prisma.componentTaskType.deleteMany({ where: { component: { project_id: id } } }),

      // Delete taskType ↔ error/exercise many-to-many associations
      prisma.taskTypeErrorAssociation.deleteMany({ where: { taskType: { project_id: id } } }),
      prisma.taskTypeExerciseAssociation.deleteMany({ where: { taskType: { project_id: id } } }),

      // Delete taskType hierarchy (parent-child relationships)
      prisma.taskTypeRelation.deleteMany({
        where: {
          OR: [
            { parent: { project_id: id } },
            { sub: { project_id: id } },
          ],
        },
      }),

      // Delete feedback ↔ component mappings
      prisma.feedbackComponentsMapping.deleteMany({
        where: { feedback: { project_id: id } },
      }),

      // Delete feedbacks and feedback components
      prisma.feedback.deleteMany({ where: { project_id: id } }),
      prisma.feedbackComponent.deleteMany({ where: { project_id: id } }),

      // Delete exercises and errors
      prisma.exercise.deleteMany({ where: { project_id: id } }),
      prisma.error.deleteMany({ where: { project_id: id } }),

      // Delete taskTypes in two steps (first those with children, then the rest)
      prisma.taskType.deleteMany({
        where: {
          project_id: id,
          parentRelations: { some: {} },
        },
      }),
      prisma.taskType.deleteMany({ where: { project_id: id } }),

      // Delete moderation requests and user permissions
        // Delete moderation messages first
      prisma.moderationMessage.deleteMany({
        where: {
          moderation: { project_id: id }
        }
      }),
      prisma.moderationRequest.deleteMany({ where: { project_id: id } }),
      prisma.userPermission.deleteMany({ where: { project_id: id } }),

      // Finally, delete the project itself
      prisma.project.delete({ where: { id } }),
    ]);

    res.json({ message: "Project and related data deleted" });
  } catch (e) {
    console.error("Failed to delete project:", e);
    res.status(500).json({ message: "Deletion failed" });
  }
});


/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project detail including members (separated by role)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Project detail with auteurs and editeurs
 */
router.get("/:id", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Classification by role
    const auteurs = project.memberships
      .filter((m) => m.role === "auteur")
      .map((m) => m.user);

    const editeurs = project.memberships
      .filter((m) => m.role === "editeur")
      .map((m) => m.user);

    // Return project details and group members
    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      auteurs,
      editeurs,
    });
  } catch (e) {
    console.error("Fetch project error:", e);
    res.status(500).json({ message: "Failed to fetch project" });
  }
});


module.exports = router;