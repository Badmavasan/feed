const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middlewares/verifyToken');
const { hasPermission } = require('../utils/permissions');
const { checkProjectMembership } = require('../utils/projectPermissions');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Task Types
 *     description: API to manage task types with project support
 */

/**
 * @swagger
 * /api/types:
 *   get:
 *     summary: Get paginated list of task types for a project with optional search
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID to filter task types
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by taskId or name (case-insensitive)
 *     responses:
 *       200:
 *         description: Paginated task types list filtered by project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 types:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TaskTypeSummary'
 *       400:
 *         description: Missing or invalid projectId parameter
 *       403:
 *         description: Access denied (not project member)
 */
router.get('/', verifyToken, checkProjectMembership, async (req, res) => {
  const projectId = req.projectId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';

  const where = {
    status: 'approved',
    project_id: projectId,
    OR: [
      { task_code: { contains: search } },
      { task_name: { contains: search } }
    ]
  };

  const total = await prisma.taskType.count({ where });
  const types = await prisma.taskType.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { task_code: 'asc' },
    select: { id: true, task_code: true, task_name: true }
  });

  res.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    types: types.map(t => ({ id: t.id, taskId: t.task_code, name: t.task_name }))
  });
});

/**
 * @swagger
 * /api/types/selectable:
 *   get:
 *     summary: Get all task types in a project for selection fields
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID to filter task types
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search filter by taskId or name
 *     responses:
 *       200:
 *         description: List of selectable task types filtered by project
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskTypeSummary'
 *       400:
 *         description: Missing or invalid projectId
 *       403:
 *         description: Access denied
 */
router.get('/selectable', verifyToken, checkProjectMembership, async (req, res) => {
  const projectId = req.projectId;
  const search = req.query.search || '';
  const where = {
    status: 'approved',
    project_id: projectId,
    OR: [
      { task_code: { contains: search } },
      { task_name: { contains: search } }
    ]
  };
  const types = await prisma.taskType.findMany({ where });
  res.json(types.map(t => ({ id: t.id, taskId: t.task_code, name: t.task_name })));
});

/**
 * @swagger
 * /api/types/others/{id}:
 *   get:
 *     summary: Get all task types in a project except specified one
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task type ID to exclude
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID to filter task types
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search filter
 *     responses:
 *       200:
 *         description: List of task types excluding given id filtered by project
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskTypeSummary'
 *       400:
 *         description: Missing or invalid projectId
 *       403:
 *         description: Access denied
 */
router.get('/others/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;
  const search = req.query.search || '';

  const types = await prisma.taskType.findMany({
    where: {
      id: { not: id },
      status: 'approved',
      project_id: projectId,
      OR: [
        { task_code: { contains: search } },
        { task_name: { contains: search } }
      ]
    }
  });
  res.json(types.map(t => ({ id: t.id, taskId: t.task_code, name: t.task_name })));
});


/**
 * @swagger
 * /api/types:
 *   post:
 *     summary: Create a task type in a project (approval required if no permission)
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Task type creation payload
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskId, name]
 *             properties:
 *               taskId:
 *                 type: string
 *               name:
 *                 type: string
 *               parentTypeId:
 *                 type: integer
 *               errors:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Created successfully
 *       202:
 *         description: Submitted for approval
 *       400:
 *         description: Duplicate taskId
 */
router.post('/', verifyToken, checkProjectMembership, async (req, res) => {
  const { taskId, name, parentTypeId = null, errors = [] } = req.body;
  const projectId = req.projectId;
  const user = req.user;

  const existing = await prisma.taskType.findFirst({
    where: { task_code: taskId, project_id: projectId }
  });
  if (existing) return res.status(400).json({ message: 'This taskId already exists in the project' });

  const canDirectCreate = await hasPermission(user.id, 'taskType', 'create', projectId );

  if (canDirectCreate) {
    const created = await prisma.taskType.create({
      data: {
        task_code: taskId,
        task_name: name,
        project_id: projectId,
        status: 'approved'
      }
    });

    if (parentTypeId) {
      await prisma.taskTypeRelation.create({
        data: {
          parent_task_id: parentTypeId,
          sub_task_id: created.id
        }
      });
    }

    if (errors.length > 0) {
      await prisma.taskTypeErrorAssociation.createMany({
        data: errors.map(errId => ({
          task_type_id: created.id,
          error_id: errId
        }))
      });
    }

    const [parentDetail, errorDetails, projectInfo] = await Promise.all([
      parentTypeId ? prisma.taskType.findUnique({
        where: { id: parentTypeId },
        select: { id: true, task_code: true, task_name: true }
      }) : null,
      prisma.error.findMany({
        where: { id: { in: errors } },
        select: { id: true, error_tag: true, description: true }
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, description: true }
      })
    ]);

    return res.json({
      message: 'Created successfully',
      type: {
        id: created.id,
        taskId: created.task_code,
        name: created.task_name,
        parent: parentDetail,
        errors: errorDetails,
        project: projectInfo
      }
    });
  }

  // Approval flow
  const [parentDetail, errorDetails] = await Promise.all([
    parentTypeId ? prisma.taskType.findUnique({
      where: { id: parentTypeId },
      select: { id: true, task_code: true, task_name: true }
    }) : null,
    prisma.error.findMany({
      where: { id: { in: errors } },
      select: { id: true, error_tag: true, description: true }
    })
  ]);

  const moderation = await prisma.moderationRequest.create({
    data: {
      requester_id: user.id,
      entity_type: 'taskType',
      action_type: 'create',
      status: 'pending_review',
      project_id: projectId,
      payload: {
        taskId,
        name,
        parentType: parentDetail,
        errors: errorDetails
      }
    }
  });

  return res.status(202).json({
    message: 'Creation request submitted for approval',
    moderation_id: moderation.id
  });
});


/**
 * @swagger
 * /api/types/{id}:
 *   put:
 *     summary: Update a task type in a project (approval required if no permission)
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskId, name]
 *             properties:
 *               taskId:
 *                 type: string
 *               name:
 *                 type: string
 *               parentTypeId:
 *                 type: integer
 *               errors:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Updated successfully
 *       202:
 *         description: Submitted for approval
 *       400:
 *         description: Duplicate taskId
 */
router.put('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const { taskId, name, parentTypeId = null, errors = [] } = req.body;
  const projectId = req.projectId;
  const user = req.user;

  const existing = await prisma.taskType.findFirst({
    where: {
      task_code: taskId,
      id: { not: id },
      project_id: projectId
    }
  });
  if (existing) return res.status(400).json({ message: 'Another type already uses this taskId' });

  const canDirectUpdate = await hasPermission(user.id, 'taskType', 'update', projectId);

  if (canDirectUpdate) {
    await prisma.taskType.update({
      where: { id },
      data: {
        task_code: taskId,
        task_name: name
      }
    });

    await prisma.taskTypeRelation.deleteMany({ where: { sub_task_id: id } });
    if (parentTypeId) {
      await prisma.taskTypeRelation.create({
        data: {
          parent_task_id: parentTypeId,
          sub_task_id: id
        }
      });
    }

    await prisma.taskTypeErrorAssociation.deleteMany({ where: { task_type_id: id } });
    if (errors.length > 0) {
      await prisma.taskTypeErrorAssociation.createMany({
        data: errors.map(errId => ({
          task_type_id: id,
          error_id: errId
        }))
      });
    }

    const [parentDetail, errorDetails, projectInfo] = await Promise.all([
      parentTypeId ? prisma.taskType.findUnique({
        where: { id: parentTypeId },
        select: { id: true, task_code: true, task_name: true }
      }) : null,
      prisma.error.findMany({
        where: { id: { in: errors } },
        select: { id: true, error_tag: true, description: true }
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, description: true }
      })
    ]);

    return res.json({
      message: 'Updated successfully',
      type: {
        id,
        taskId,
        name,
        parent: parentDetail,
        errors: errorDetails,
        project: projectInfo
      }
    });
  }

  // Approval flow
  const [parentDetail, errorDetails] = await Promise.all([
    parentTypeId ? prisma.taskType.findUnique({
      where: { id: parentTypeId },
      select: { id: true, task_code: true, task_name: true }
    }) : null,
    prisma.error.findMany({
      where: { id: { in: errors } },
      select: { id: true, error_tag: true, description: true }
    })
  ]);

  const moderation = await prisma.moderationRequest.create({
    data: {
      requester_id: user.id,
      entity_type: 'taskType',
      entity_id: id,
      action_type: 'update',
      status: 'pending_review',
      project_id: projectId,
      payload: {
        taskId,
        name,
        parentType: parentDetail,
        errors: errorDetails
      }
    }
  });

  return res.status(202).json({
    message: 'Update request submitted for approval',
    moderation_id: moderation.id
  });
});


/**
 * @swagger
 * /api/types/{id}:
 *   delete:
 *     summary: Delete a task type in a project (approval required if no permission)
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task type ID to delete
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       202:
 *         description: Delete request submitted
 *       404:
 *         description: Not found
 */
router.delete('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;
  const user = req.user;

  const type = await prisma.taskType.findUnique({ where: { id, project_id: projectId } });
  if (!type) return res.status(404).json({ message: 'Task type not found in this project' });

  const hasDeleteRight = await hasPermission(user.id, 'taskType', 'delete', projectId);

  if (!hasDeleteRight) {
    const [parentRelation, errorAssociations] = await Promise.all([
      prisma.taskTypeRelation.findFirst({
        where: { sub_task_id: id },
        include: { parent: true }
      }),
      prisma.taskTypeErrorAssociation.findMany({
        where: { task_type_id: id },
        include: { error: true }
      })
    ]);

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: 'taskType',
        entity_id: id,
        action_type: 'delete',
        status: 'pending_review',
        project_id: projectId,
        payload: {
          taskId: type.task_code,
          name: type.task_name,
          parentType: parentRelation?.parent ?? null,
          errors: errorAssociations.map(e => e.error)
        }
      }
    });

    return res.status(202).json({ message: 'Delete request submitted for approval' });
  }

  await prisma.taskTypeRelation.deleteMany({
    where: {
      OR: [
        { parent_task_id: id },
        { sub_task_id: id }
      ]
    }
  });

  await prisma.taskTypeErrorAssociation.deleteMany({ where: { task_type_id: id } });
  await prisma.taskTypeExerciseAssociation.deleteMany({ where: { task_type_id: id } });
  await prisma.componentTaskType.deleteMany({ where: { task_type_id: id } });

  await prisma.taskType.delete({ where: { id } });

  return res.json({ message: 'Deleted successfully' });
});

/**
 * @swagger
 * /api/types/{id}/associations:
 *   get:
 *     summary: Get associated entities for a task type in a project
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task type ID
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID of the task type
 *     responses:
 *       200:
 *         description: Associated entities returned filtered by project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 associations:
 *                   type: object
 *                   properties:
 *                     parentType:
 *                       $ref: '#/components/schemas/TaskTypeSummary'
 *                     subTypes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TaskTypeSummary'
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           tag:
 *                             type: string
 *                           description:
 *                             type: string
 *                     associatedExercises:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                     associatedComponents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           description:
 *                             type: string
 *                           type:
 *                             type: string
 */
router.get('/:id/associations', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;

  // 验证taskType是否属于项目
  const task = await prisma.taskType.findFirst({ where: { id, project_id: projectId } });
  if (!task) return res.status(404).json({ message: 'Task type not found in this project' });

  const [childRelations, parentRelation, errors, exercises, components] = await Promise.all([
    prisma.taskTypeRelation.findMany({
      where: { parent_task_id: id },
      include: { sub: true }
    }),
    prisma.taskTypeRelation.findFirst({
      where: { sub_task_id: id },
      include: { parent: true }
    }),
    prisma.taskTypeErrorAssociation.findMany({
      where: { task_type_id: id },
      include: { error: true }
    }),
    prisma.taskTypeExerciseAssociation.findMany({
      where: { task_type_id: id },
      include: { exercise: true }
    }),
    prisma.componentTaskType.findMany({
      where: { task_type_id: id },
      include: { component: true }
    })
  ]);

  res.json({
    associations: {
      parentType: parentRelation?.parent
        ? {
            id: parentRelation.parent.id,
            taskId: parentRelation.parent.task_code,
            name: parentRelation.parent.task_name
          }
        : null,
      subTypes: childRelations.map(r => ({
        id: r.sub.id,
        taskId: r.sub.task_code,
        name: r.sub.task_name
      })),
      errors: errors.map(e => ({
        id: e.error.id,
        tag: e.error.error_tag,
        description: e.error.description
      })),
      associatedExercises: exercises.map(e => ({
        id: e.exercise.id,
        title: e.exercise.title,
        description: e.exercise.description
      })),
      associatedComponents: components.map(c => ({
        id: c.component.id,
        description: c.component.description,
        type: c.component.type
      }))
    }
  });
});



/**
 * @swagger
 * /api/types/tree:
 *   get:
 *     summary: Get task types as a tree structure filtered by project
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID to filter task types
 *       - in: query
 *         name: rootId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Root task type ID to build tree from
 *     responses:
 *       200:
 *         description: Tree of task types filtered by project
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskTypeTreeNode'
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task type not found
 */
router.get('/tree', verifyToken, checkProjectMembership, async (req, res) => {
  const projectId = req.projectId;
  const rootId = parseInt(req.query.rootId);

  if (isNaN(rootId)) {
    return res.status(400).json({ message: "Invalid rootId parameter" });
  }

  const [allTypes, allRelations] = await Promise.all([
    prisma.taskType.findMany({
      where: { project_id: projectId },
      select: { id: true, task_code: true, task_name: true }
    }),
    prisma.taskTypeRelation.findMany({
      where: {
        parent_task_id: {
          in: (await prisma.taskType.findMany({
            where: { project_id: projectId },
            select: { id: true }
          })).map(t => t.id)
        }
      }
    })
  ]);

  const parentToChildren = {};
  allRelations.forEach(rel => {
    if (!parentToChildren[rel.parent_task_id]) {
      parentToChildren[rel.parent_task_id] = [];
    }
    parentToChildren[rel.parent_task_id].push(rel.sub_task_id);
  });

  const typeMap = {};
  allTypes.forEach(t => {
    typeMap[t.id] = {
      id: t.id,
      taskId: t.task_code,
      name: t.task_name,
      children: []
    };
  });

  function buildSubtree(nodeId) {
    const node = typeMap[nodeId];
    if (!node) return null;
    const childrenIds = parentToChildren[nodeId] || [];
    childrenIds.forEach(childId => {
      const childNode = buildSubtree(childId);
      if (childNode) node.children.push(childNode);
    });
    return node;
  }

  const rootNode = buildSubtree(rootId);
  if (!rootNode) return res.status(404).json({ message: "Task type not found" });

  res.json(rootNode);
});

/**
 * @swagger
 * /api/types/{id}:
 *   get:
 *     summary: Get details of a task type in a project
 *     tags: [Task Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task type ID
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID of the task type
 *     responses:
 *       200:
 *         description: Task type details filtered by project
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskTypeDetailFull'
 *       400:
 *         description: Missing or invalid projectId
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task type not found
 */
router.get('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;

  const task = await prisma.taskType.findFirst({ where: { id, project_id: projectId } });
  if (!task) return res.status(404).json({ message: 'Task type not found in this project' });

  const [parentRelation, childRelations, errors, exercises, components] = await Promise.all([
    prisma.taskTypeRelation.findFirst({
      where: { sub_task_id: id },
      include: { parent: true }
    }),
    prisma.taskTypeRelation.findMany({
      where: { parent_task_id: id },
      include: { sub: true }
    }),
    prisma.taskTypeErrorAssociation.findMany({
      where: { task_type_id: id },
      include: { error: true }
    }),
    prisma.taskTypeExerciseAssociation.findMany({
      where: { task_type_id: id },
      include: { exercise: true }
    }),
    prisma.componentTaskType.findMany({
      where: { task_type_id: id },
      include: { component: true }
    })
  ]);

  res.json({
    id: task.id,
    taskId: task.task_code,
    name: task.task_name,
    parent: parentRelation?.parent ? {
      id: parentRelation.parent.id,
      taskId: parentRelation.parent.task_code,
      name: parentRelation.parent.task_name
    } : null,
    subTypes: childRelations.map(r => ({
      id: r.sub.id,
      taskId: r.sub.task_code,
      name: r.sub.task_name
    })),
    errors: errors.map(e => ({
      id: e.error.id,
      tag: e.error.error_tag,
      description: e.error.description
    })),
    associatedExercises: exercises.map(e => ({
      id: e.exercise.id,
      title: e.exercise.title,
      description: e.exercise.description
    })),
    associatedComponents: components.map(c => ({
      id: c.component.id,
      description: c.component.description,
      type: c.component.type
    }))
  });
});

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     TaskTypeSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         taskId:
 *           type: string
 *         name:
 *           type: string
 *     TaskTypeDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/TaskTypeSummary'
 *         - type: object
 *           properties:
 *             parent:
 *               $ref: '#/components/schemas/TaskTypeSummary'
 *             errors:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   tag:
 *                     type: string
 *                   description:
 *                     type: string
 *     TaskTypeDetailFull:
 *       allOf:
 *         - $ref: '#/components/schemas/TaskTypeDetail'
 *         - type: object
 *           properties:
 *             subTypes:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskTypeSummary'
 *             associatedExercises:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *             associatedComponents:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   description:
 *                     type: string
 *                   type:
 *                     type: string
 *     TaskTypeTreeNode:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         taskId:
 *           type: string
 *         name:
 *           type: string
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TaskTypeTreeNode'
 */
