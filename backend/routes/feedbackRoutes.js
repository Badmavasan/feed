const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middlewares/verifyToken');
const { checkProjectMembership } = require('../utils/projectPermissions');
const { hasPermission } = require('../utils/permissions');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/feedbacks:
 *   get:
 *     summary: Retrieve a paginated list of feedbacks
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Current page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of feedbacks per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword for feedback content
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', verifyToken, checkProjectMembership, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const projectId = parseInt(req.query.projectId);

  const where = {
    status: 'approved',
    project_id: projectId,
    OR: [
      { feedback_code: { contains: search } },
      { description: { contains: search } }
    ]
  };

  const total = await prisma.feedback.count({ where });
  const feedbacks = await prisma.feedback.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { id: 'asc' },
    select: { id: true, feedback_code: true, description: true, status: true }
  });

  res.json({ total, page, limit, totalPages: Math.ceil(total / limit), feedbacks });
});

/**
 * @swagger
 * /api/feedbacks:
 *   post:
 *     summary: Create feedback (components required, deduces other links automatically)
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [feedback_code, description, components, projectId]
 *             properties:
 *               feedback_code:
 *                 type: string
 *               description:
 *                 type: string
 *               projectId:
 *                 type: integer
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     position: { type: integer }
 *     responses:
 *       200:
 *         description: Feedback created with linked components
 */
router.post("/", verifyToken, checkProjectMembership, async (req, res) => {
  const { feedback_code, description, components = [], projectId } = req.body;
  const user = req.user;

  if (!Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ message: "At least one component is required." });
  }

  const canCreate = user.role !== "auteur" || (await hasPermission(user.id, "feedback", "create", projectId));

  if (!canCreate) {
    const composantDetails = await prisma.feedbackComponent.findMany({
      where: { id: { in: components.map((c) => c.id) } },
    });

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: "feedback",
        action_type: "create",
        status: "pending_review",
        project_id: projectId,
        payload: JSON.stringify({ feedback_code, description, components: composantDetails }),
      },
    });

    return res.status(202).json({ message: "Creation request submitted for approval" });
  }

  try {
    const created = await prisma.feedback.create({
      data: { feedback_code, description, status: "approved", project_id: projectId },
    });

    await prisma.feedbackComponentsMapping.createMany({
      data: components.map((c) => ({
        feedback_id: created.id,
        component_id: c.id,
        position: c.position,
      })),
    });

    return res.json({ message: "Created successfully", id: created.id });

  } catch (error) {
    if (error.code === "P2002" && error.meta?.target?.includes("feedback_code")) {
      return res.status(400).json({ message: "This feedback tag already exists in the project." });
    }

    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "An unexpected error occurred." });
  }
});



/**
 * @swagger
 * /api/feedbacks/{id}:
 *   put:
 *     summary: Update feedback (approval if needed)
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [feedback_code, description, components]
 *             properties:
 *               feedback_code: { type: string }
 *               description: { type: string }
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     position: { type: integer }
 *     responses:
 *       200:
 *         description: Updated or submitted for review
 */
router.put("/:id", verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const { feedback_code, description, components = [] } = req.body;
  const user = req.user;
  const projectId = req.projectId;

  const canUpdate = user.role !== "auteur" || (await hasPermission(user.id, "feedback", "update", projectId));

  if (!canUpdate) {
    const composantDetails = await prisma.feedbackComponent.findMany({
      where: { id: { in: components.map((c) => c.id) } },
    });

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: "feedback",
        entity_id: id,
        action_type: "update",
        status: "pending_review",
        project_id: projectId,
        payload: JSON.stringify({ feedback_code, description, components: composantDetails }),
      },
    });

    return res.json({ message: "Update request submitted for approval" });
  }

  try {
    const existing = await prisma.feedback.findFirst({
      where: {
        feedback_code,
        project_id: projectId,
        NOT: { id }
      }
    });

    if (existing) {
      return res.status(400).json({ message: "This feedback tag already exists in the project." });
    }

    await prisma.feedback.update({
      where: { id },
      data: { feedback_code, description },
    });

    await prisma.feedbackComponentsMapping.deleteMany({ where: { feedback_id: id } });
    await prisma.feedbackComponentsMapping.createMany({
      data: components.map((c) => ({
        feedback_id: id,
        component_id: c.id,
        position: c.position,
      })),
    });

    res.json({ message: "Updated successfully" });

  } catch (error) {
    if (error.code === "P2002" && error.meta?.target?.includes("feedback_code")) {
      return res.status(400).json({ message: "This feedback tag already exists in the project." });
    }

    console.error("Unexpected error during feedback update:", error);
    return res.status(500).json({ message: "An unexpected error occurred." });
  }
});



/**
 * @swagger
 * /api/feedbacks/{id}:
 *   delete:
 *     summary: Delete feedback (approval required for auteur)
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted or approval requested
 */
router.delete("/:id", verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user;
  const projectId = req.projectId;

  const feedback = await prisma.feedback.findFirst({ where: { id, project_id: projectId } });
  if (!feedback) return res.status(404).json({ message: "Feedback not found in this project" });

  const canDelete = user.role !== "auteur" || (await hasPermission(user.id, "feedback", "delete", projectId));

  if (!canDelete) {
    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: "feedback",
        entity_id: id,
        action_type: "delete",
        status: "pending_review",
        project_id: projectId,
        payload: JSON.stringify(feedback),
      },
    });
    return res.json({ message: "Delete request submitted for approval" });
  }

  await prisma.feedbackComponentsMapping.deleteMany({ where: { feedback_id: id } });
  await prisma.feedback.delete({ where: { id } });

  res.json({ message: "Deleted successfully" });
});

/**
 * @swagger
 * /api/feedbacks/{id}:
 *   get:
 *     summary: View the details of an approved feedback (and its associations)
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feedback
 *     responses:
 *       200:
 *         description: Feedback details successfully returned
 *       404:
 *         description: Feedback not found or not approved
 */
router.get('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;

  const feedback = await prisma.feedback.findFirst({
    where: { id, project_id: projectId },
    include: {
      mappings: {
        include: { component: true },
        orderBy: { position: 'asc' }
      }
    }
  });

  if (!feedback || feedback.status !== 'approved') {
    return res.status(404).json({ message: 'Feedback introuvable ou non approuvé' });
  }

  const componentIds = feedback.mappings.map(fc => fc.component_id);
  const composants = feedback.mappings.map(fc => fc.component);

  const erreurs = await prisma.error.findMany({
    where: {
      project_id: projectId,
      components: { some: { id: { in: componentIds } } }
    }
  });

  const exercicesList = await prisma.componentExercise.findMany({
    where: { component_id: { in: componentIds } }
  });

  const exerciseGrouped = composants.map(c =>
    exercicesList.filter(e => e.component_id === c.id).map(e => e.exercise_id)
  );

  const intersection = exerciseGrouped.reduce((acc, ids) =>
    acc.length === 0 ? ids : acc.filter(id => ids.includes(id))
  , []);

  const exercices = await prisma.exercise.findMany({
    where: { id: { in: intersection }, project_id: projectId }
  });

  const taskTypeRelations = await prisma.componentTaskType.findMany({
    where: { component_id: { in: componentIds } }
  });

  const taskTypeIds = [...new Set(taskTypeRelations.map(t => t.task_type_id))];
  const taskTypes = await prisma.taskType.findMany({
    where: { id: { in: taskTypeIds }, project_id: projectId }
  });

  res.json({
    id: feedback.id,
    feedback_code: feedback.feedback_code,
    description: feedback.description,
    status: feedback.status,
    components: composants.map(c => ({
      id: c.id,
      description: c.description,
      type: c.type,
      nature: c.nature,
      content: c.content
    })),
    erreurs,
    exercices,
    typesDeTaches: taskTypes.map(t => ({
      id: t.id,
      taskId: t.task_code,
      nom: t.task_name
    }))
  });
});



/**
 * @swagger
 * /api/feedbacks/{id}/associations:
 *   get:
 *     summary: Retrieve entities associated with a feedback (derived from components)
 *     tags: [Feedbacks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the feedback
 *     responses:
 *       200:
 *         description: Automatically inferred associations returned
 *       404:
 *         description: Feedback not found
 */
router.get('/:id/associations', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;

  const feedback = await prisma.feedback.findFirst({
    where: { id, project_id: projectId },
    include: {
      mappings: { orderBy: { position: 'asc' } }
    }
  });

  if (!feedback || feedback.status !== 'approved') {
    return res.status(404).json({ message: 'Feedback introuvable ou non approuvé' });
  }

  const componentIds = feedback.mappings.map(fc => fc.component_id);
  if (componentIds.length === 0) {
    return res.json({ erreurs: [], exercices: [], typesDeTaches: [] });
  }

  const composants = await prisma.feedbackComponent.findMany({
    where: { id: { in: componentIds }, project_id: projectId },
    include: {
      error: true,
      componentExercises: true,
      componentTaskTypes: true
    }
  });

  const erreurs = composants.map(c => c.error).filter(Boolean);

  const exercicesList = composants.map(c =>
    c.componentExercises.map(e => e.exercise_id)
  );
  const intersection = exercicesList.reduce(
    (acc, cur) => acc.length === 0 ? cur : acc.filter(id => cur.includes(id)),
    []
  );
  const exercices = await prisma.exercise.findMany({
    where: { id: { in: intersection }, project_id: projectId }
  });

  const taskTypeIds = [...new Set(
    composants.flatMap(c => c.componentTaskTypes.map(t => t.task_type_id))
  )];
  const taskTypes = await prisma.taskType.findMany({
    where: { id: { in: taskTypeIds }, project_id: projectId }
  });

  res.json({
    erreurs: erreurs.map(e => ({
      id: e.id,
      tag: e.error_tag,
      description: e.description
    })),
    exercices,
    typesDeTaches: taskTypes.map(t => ({
      id: t.id,
      taskId: t.task_code,
      nom: t.task_name
    }))
  });
});


module.exports = router;
