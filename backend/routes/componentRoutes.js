const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middlewares/verifyToken');
const { hasPermission } = require('../utils/permissions');
const { checkProjectMembership } = require('../utils/projectPermissions');
const upload = require("../middlewares/upload");

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/components:
 *   get:
 *     summary: Get a paginated list of approved components by project
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list
 */
router.get('/', verifyToken, checkProjectMembership, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const projectId = parseInt(req.query.projectId);

  if (!projectId) return res.status(400).json({ message: 'projectId is required' });

  const where = {
    status: 'approved',
    project_id: projectId,
    OR: [
      { description: { contains: search } },
      { tag: { contains: search } }
    ]
  };

  const total = await prisma.feedbackComponent.count({ where });
  const components = await prisma.feedbackComponent.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      tag: true,
      description: true,
      type: true,
      nature: true
    }
  });

  res.json({ total, page, limit, totalPages: Math.ceil(total / limit), components });
});

/**
 * @swagger
 * /api/components/selectable:
 *   get:
 *     summary: Get approved components for selection (no pagination)
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Dropdown list
 */
router.get('/selectable', verifyToken, checkProjectMembership, async (req, res) => {
  const search = req.query.search || '';
  const projectId = parseInt(req.query.projectId);

  if (!projectId) return res.status(400).json({ message: 'projectId is required' });

  const components = await prisma.feedbackComponent.findMany({
    where: {
      status: 'approved',
      project_id: projectId,
      OR: [
        { description: { contains: search } },
        { tag: { contains: search } }
      ]
    }
  });

  res.json(components);
});

/**
 * @swagger
 * /api/components:
 *   post:
 *     summary: Create component (with approval logic)
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tag, description, type, nature, content, projectId]
 */
router.post('/', upload.single('image'), verifyToken, checkProjectMembership,  async (req, res) => {
  const {
    tag,
    description,
    type,
    nature,
    content,
    projectId,
    associatedTypeIds = [],
    associatedExerciseIds = [],
    pointedErrorIds = []
  } = req.body;

  const user = req.user;

   let parsedAssociatedTypeIds = associatedTypeIds;
    let parsedAssociatedExerciseIds = associatedExerciseIds;
    let parsedPointedErrorIds = pointedErrorIds;

    try {
      if (typeof associatedTypeIds === 'string') {
        parsedAssociatedTypeIds = JSON.parse(associatedTypeIds);
      }
      if (typeof associatedExerciseIds === 'string') {
        parsedAssociatedExerciseIds = JSON.parse(associatedExerciseIds);
      }
      if (typeof pointedErrorIds === 'string') {
        parsedPointedErrorIds = JSON.parse(pointedErrorIds);
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid array format in request body' });
    }


  const finalContent =
    type === 'Image' && req.file
      ? `/uploads/components/${req.file.filename}` //Save file path
      : content;

      const existing = await prisma.feedbackComponent.findFirst({
        where: {
          tag,
          project_id: parseInt(projectId)
        }
      });

      if (existing) {
        return res.status(400).json({ message: 'This tag is already used in the project.' });
      }

  const canDirectCreate =
    user.role !== 'auteur' || await hasPermission(user.id, 'component', 'create', parseInt(projectId));

  if (canDirectCreate) {
    const created = await prisma.feedbackComponent.create({
      data: {
        tag,
        description,
        type,
        nature,
        content: finalContent,
        project_id: parseInt(projectId),
        error_id: nature === 'erreur_pointée' && pointedErrorIds.length > 0 ? pointedErrorIds[0] : null,
        status: 'approved'
      }
    });

    // Save the relationship (note: these fields are JSON strings)
     if (parsedAssociatedTypeIds?.length) {
        await prisma.componentTaskType.createMany({
          data: parsedAssociatedTypeIds.map((id) => ({
            component_id: created.id,
            task_type_id: id
          }))
        });
      }

      if (parsedAssociatedExerciseIds?.length) {
        await prisma.componentExercise.createMany({
          data: parsedAssociatedExerciseIds.map((id) => ({
            component_id: created.id,
            exercise_id: id
          }))
        });
      }


    return res.json({ message: 'Created successfully', component: created });
  } else {
    // Create a review request
    const payload = {
      tag, description, type, nature,
      content: finalContent,
      projectId,
      associatedTypes: JSON.parse(associatedTypeIds),
      associatedExercises: JSON.parse(associatedExerciseIds),
      pointedError: pointedErrorIds
    };

    const moderation = await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: 'component',
        action_type: 'create',
        status: 'pending_review',
        project_id: parseInt(projectId),
        payload: JSON.stringify(payload)
      }
    });

    return res.status(202).json({ message: 'Creation request submitted for approval', moderation_id: moderation.id });
  }
});



/**
 * @swagger
 * /api/components/{id}:
 *   put:
 *     summary: Update component (with approval logic)
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Component ID
 */
router.put('/:id', upload.single('image'), verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    tag,
    description,
    type,
    nature,
    content,
    projectId,
    associatedTypeIds = [],
    associatedExerciseIds = [],
    pointedErrorIds = []
  } = req.body;

  const user = req.user;

  // 安全解析数组字段（无论是 string 还是 array）
  let parsedAssociatedTypeIds = associatedTypeIds;
  let parsedAssociatedExerciseIds = associatedExerciseIds;
  let parsedPointedErrorIds = pointedErrorIds;

  try {
    if (typeof associatedTypeIds === 'string') {
      parsedAssociatedTypeIds = JSON.parse(associatedTypeIds);
    }
    if (typeof associatedExerciseIds === 'string') {
      parsedAssociatedExerciseIds = JSON.parse(associatedExerciseIds);
    }
    if (typeof pointedErrorIds === 'string') {
      parsedPointedErrorIds = JSON.parse(pointedErrorIds);
    }
  } catch (error) {
    return res.status(400).json({ message: 'Invalid array format in request body' });
  }

  const finalContent =
    type === 'Image' && req.file
      ? `/uploads/components/${req.file.filename}`
      : content;

  // 校验 tag 是否重复
  const existing = await prisma.feedbackComponent.findFirst({
    where: {
      tag,
      project_id: parseInt(projectId),
      NOT: { id: parseInt(id) }
    }
  });

  if (existing) {
    return res.status(400).json({ message: 'This tag is already used in the project.' });
  }

  // 权限判断
  const canUpdate =
    user.role !== 'auteur' || await hasPermission(user.id, 'component', 'update', parseInt(projectId));

  if (!canUpdate) {
    const payload = {
      tag,
      description,
      type,
      nature,
      content: finalContent,
      associatedTypes: parsedAssociatedTypeIds,
      associatedExercises: parsedAssociatedExerciseIds,
      pointedError: parsedPointedErrorIds
    };

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: 'component',
        entity_id: id,
        action_type: 'update',
        status: 'pending_review',
        project_id: parseInt(projectId),
        payload: JSON.stringify(payload)
      }
    });

    return res.json({ message: 'Update request submitted' });
  }

  // 执行更新
  await prisma.feedbackComponent.update({
    where: { id },
    data: {
      tag,
      description,
      type,
      nature,
      content: finalContent,
      error_id: nature === 'erreur_pointée' && parsedPointedErrorIds.length > 0 ? parsedPointedErrorIds[0] : null
    }
  });

  // 重新插入关联关系
  await prisma.componentTaskType.deleteMany({ where: { component_id: id } });
  await prisma.componentExercise.deleteMany({ where: { component_id: id } });

  if (parsedAssociatedTypeIds?.length > 0) {
    await prisma.componentTaskType.createMany({
      data: parsedAssociatedTypeIds.map(tid => ({
        component_id: id,
        task_type_id: tid
      }))
    });
  }

  if (parsedAssociatedExerciseIds?.length > 0) {
    await prisma.componentExercise.createMany({
      data: parsedAssociatedExerciseIds.map(eid => ({
        component_id: id,
        exercise_id: eid
      }))
    });
  }

  return res.json({ message: 'Updated successfully' });
});



/**
 * @swagger
 * /api/components/{id}:
 *   delete:
 *     summary: Delete component (with approval logic)
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted or submitted for approval
 */
router.delete('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const user = req.user;

  // Find components and related information
  const component = await prisma.feedbackComponent.findUnique({
    where: { id },
    include: {
      taskTypes: { include: { taskType: true } },
      exercises: { include: { exercise: true } },
      error: true,
      project: true
    }
  });

  if (!component) return res.status(404).json({ message: 'Component not found' });

  // First check if there is any Feedback using this component
  const usedInFeedbacks = await prisma.feedbackComponentsMapping.findMany({
    where: { component_id: id },
    include: { feedback: true }
  });

  if (usedInFeedbacks.length > 0) {
    return res.status(400).json({
      message: 'This component is still used in the following feedbacks. Please remove it from them before deleting.',
      feedbacks: usedInFeedbacks.map(fm => ({
        id: fm.feedback.id,
        code: fm.feedback.feedback_code
      }))
    });
  }

  // Perform permission judgment
  const canDelete = user.role !== 'auteur' || await hasPermission(user.id, 'component', 'delete', component.project_id);

  if (canDelete) {
    // Direct hard deletion
    await prisma.$transaction([
      prisma.componentTaskType.deleteMany({ where: { component_id: id } }),
      prisma.componentExercise.deleteMany({ where: { component_id: id } }),
      prisma.feedbackComponentsMapping.deleteMany({ where: { component_id: id } }),
      prisma.feedbackComponent.delete({ where: { id } })
    ]);
    return res.json({ message: 'Deleted successfully' });
  } else {
    // Otherwise submit a deletion request
    const payload = {
      id: component.id,
      tag: component.tag,
      description: component.description,
      type: component.type,
      nature: component.nature,
      content: component.content,
      associatedTypes: component.taskTypes.map(r => ({
        id: r.taskType.id,
        taskId: r.taskType.task_code,
        name: r.taskType.task_name
      })),
      associatedExercises: component.exercises.map(r => ({
        id: r.exercise.id,
        title: r.exercise.title,
        description: r.exercise.description
      })),
      pointedError: component.error ? [{
        id: component.error.id,
        tag: component.error.error_tag,
        description: component.error.description
      }] : []
    };

    const moderation = await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: 'component',
        entity_id: id,
        action_type: 'delete',
        status: 'pending_review',
        project_id: component.project.id,
        payload: JSON.stringify(payload)
      }
    });

    return res.status(202).json({
      message: 'Delete request submitted for approval',
      moderation_id: moderation.id
    });
  }
});


/**
 * @swagger
 * /api/components/{id}:
 *   get:
 *     summary: Get component detail
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Component detail
 */
// routes/componentRoutes.js 或相关文件

router.get('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);

  const component = await prisma.feedbackComponent.findUnique({
    where: { id },
    include: {
      taskTypes: { include: { taskType: true } },
      exercises: { include: { exercise: true } },
      error: true
    }
  });

  if (!component || component.status !== 'approved') {
    return res.status(404).json({ message: 'Component not found' });
  }


  const referencedFeedbacks = await prisma.feedback.findMany({
  where: {
    mappings: {
      some: {
        component_id: id 
      }
    }
  },
  select: {
    id: true,
    feedback_code: true,
    description: true
  }
});


  res.json({
    id: component.id,
    tag: component.tag,
    description: component.description,
    type: component.type,
    nature: component.nature,
    content: component.content,
    associatedTypes: component.taskTypes.map(r => ({
      id: r.taskType.id,
      taskId: r.taskType.task_code,
      name: r.taskType.task_name
    })),
    associatedExercises: component.exercises.map(r => ({
      id: r.exercise.id,
      title: r.exercise.title,
      description: r.exercise.description
    })),
    pointedError: component.error ? [{
      id: component.error.id,
      tag: component.error.error_tag,
      description: component.error.description
    }] : [],
    referencedFeedbacks
  });
});



/**
 * @swagger
 * /api/components/{id}/associations:
 *   get:
 *     summary: Get all associations of a component
 *     tags: [Components]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Associations list
 */
router.get('/:id/associations', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);

  const component = await prisma.feedbackComponent.findUnique({
    where: { id },
    include: {
      taskTypes: { include: { taskType: true } },
      exercises: { include: { exercise: true } },
      error: true
    }
  });

  if (!component || component.status !== 'approved') {
    return res.status(404).json({ message: 'Component not found' });
  }

  res.json({
    taskTypes: component.taskTypes.map(r => ({ id: r.taskType.id, taskId: r.taskType.task_code, name: r.taskType.task_name })),
    exercises: component.exercises.map(r => ({ id: r.exercise.id, title: r.exercise.title })),
    error: component.error ? { id: component.error.id, tag: component.error.error_tag } : null
  });
});

module.exports = router;
