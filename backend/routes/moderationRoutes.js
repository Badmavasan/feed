const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const verifyToken = require('../middlewares/verifyToken');
const { formatTypePayload } = require('../utils/formatPayload');
const { checkProjectMembership } = require('../utils/projectPermissions');


/**
 * @swagger
 * tags:
 *   name: Moderations
 *   description: Management of moderation requests
 */

/**
 * @swagger
 * /api/moderations/mine:
 *   get:
 *     summary: Retrieve moderation requests submitted by the current user
 *     tags: [Moderations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending_review, approved, rejected]
 *         description: Filter by moderation status
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Keyword to search in moderation requests
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
 *     responses:
 *       200:
 *         description: List of moderation requests submitted by the user
 */
router.get('/mine', verifyToken, checkProjectMembership, async (req, res) => {
  const { status, page = 1, pageSize = 10, keyword = '' } = req.query;
  const skip = (Number(page) - 1) * Number(pageSize);
  const projectId = req.projectId;

  const where = {
    requester_id: req.user.id,
    project_id: projectId,
    ...(status ? { status } : {}),
    ...(keyword
      ? {
          OR: [
            {
              entity_type: {
                contains: keyword
              },
            },
            {
              action_type: {
                contains: keyword,
              },
            },
            {
              reason: {
                contains: keyword
              },
            },
          ],
        }
      : {}),
  };

  const [total, data] = await Promise.all([
    prisma.moderationRequest.count({ where }),
    prisma.moderationRequest.findMany({
      where,
      skip,
      take: Number(pageSize),
      orderBy: { created_at: 'desc' },
    }),
  ]);

  res.json({ total, page: Number(page), pageSize: Number(pageSize), data });
});
router.get('/mine/pending', (req, res, next) => { req.query.status = 'pending_review'; next(); }, router.handle);
router.get('/mine/approved', (req, res, next) => { req.query.status = 'approved'; next(); }, router.handle);
router.get('/mine/rejected', (req, res, next) => { req.query.status = 'rejected'; next(); }, router.handle);
router.get('/mine/withdrawn', (req, res, next) => { req.query.status = 'withdrawn'; next(); }, router.handle);

/**
 * @swagger
 * /api/moderations/{id}:
 *   delete:
 *     summary: Withdraw a pending moderation request (by requester only)
 *     tags: [Moderations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the moderation request
 *     responses:
 *       200:
 *         description: Request withdrawn successfully
 *       400:
 *         description: Only pending requests can be withdrawn
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Request not found
 */
router.delete('/:id', verifyToken, async (req, res, next) => {
  const id = parseInt(req.params.id);
  const moderation = await prisma.moderationRequest.findUnique({ where: { id } });

  if (!moderation) return res.status(404).json({ message: 'Demande introuvable' });

  if (moderation.requester_id !== req.user.id) {
    return res.status(403).json({ message: 'Vous ne pouvez retirer que vos propres demandes.' });
  }

  if (moderation.status !== 'pending_review') {
    return res.status(400).json({ message: 'Seules les demandes en attente peuvent être retirées.' });
  }

  // Put the projectId in advance for the middleware to use
  req.projectId = moderation.project_id;
  next();
}, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);

  await prisma.moderationRequest.update({
    where: { id },
    data: { status: 'withdrawn' }
  });

  res.json({ message: 'Demande retirée.' });
});


/**
 * @swagger
 * /api/moderations:
 *   get:
 *     summary: List moderation requests for the current project (editor only)
 *     tags: [Moderations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending_review, approved, rejected, withdrawn]
 *         description: Filter by request status
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Search by feedback code or payload
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
 *     responses:
 *       200:
 *         description: List of moderation requests for the current project
 */
router.get('/', verifyToken, checkProjectMembership, async (req, res) => {
  const user = req.user;
  const projectId = req.projectId;
  const { status, keyword = '', page = 1, pageSize = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(pageSize);

  //Check if the user is an editor of the item
  const membership = await prisma.projectMembership.findUnique({
    where: {
      user_id_project_id: {
        user_id: user.id,
        project_id: projectId
      }
    }
  });

  if (!membership || membership.role !== 'editeur') {
    return res.status(403).json({ message: 'Seul un éditeur du projet peut accéder à cette ressource.' });
  }

  const where = {
    project_id: projectId,
    ...(status ? { status } : {}),
    ...(keyword
      ? {
          OR: [
            { feedback: { feedback_code: { contains: keyword } } },
            { payload: { contains: keyword } }
          ]
        }
      : {})
  };

  const [total, data] = await Promise.all([
    prisma.moderationRequest.count({ where }),
    prisma.moderationRequest.findMany({
      where,
      skip,
      take: Number(pageSize),
      orderBy: { created_at: 'desc' },
      include: {
        requester: true,
        reviewer: true
      }
    })
  ]);

  res.json({
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    data
  });
});


/**
 * @swagger
 * /api/moderations/{id}:
 *   get:
 *     summary: View moderation request details
 *     tags: [Moderations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the moderation request
 *     responses:
 *       200:
 *         description: Moderation request details
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Request not found
 */
router.get('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);

  const moderation = await prisma.moderationRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      reviewer: true,
    },
  });

  if (!moderation) {
    return res.status(404).json({ message: 'Demande introuvable' });
  }

  const isRequester = moderation.requester_id === req.user.id;
  const isAdmin = ['admin'].includes(req.user.role);

  // If not a submitter or administrator, check if you are an editor of the project.
  let isProjectEditor = false;
  if (!isRequester && !isAdmin) {
    const membership = await prisma.projectMembership.findUnique({
      where: {
        user_id_project_id: {
          user_id: req.user.id,
          project_id: moderation.project_id
        }
      }
    });

    isProjectEditor = !!membership && membership.role === 'editeur';
  }

  if (!isRequester && !isAdmin && !isProjectEditor) {
    return res.status(403).json({ message: 'Accès interdit' });
  }

  res.json(moderation);
});


/**
 * @swagger
 * /api/moderations/{id}:
 *   put:
 *     summary: Approve or reject a moderation request
 *     tags: [Moderations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the moderation request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               reason:
 *                 type: string
 *                 description: Optional reason for rejection
 *     responses:
 *       200:
 *         description: Moderation request processed
 *       400:
 *         description: Invalid or already processed request
 *       403:
 *         description: Forbidden
 */
router.put('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const { action, reason } = req.body;

  const moderation = await prisma.moderationRequest.findUnique({ where: { id } });
  if (!moderation || moderation.status !== 'pending_review') {
    return res.status(400).json({ message: 'Demande invalide ou déjà traitée.' });
  }

  // Only editeur in the project can review
  const membership = await prisma.projectMembership.findUnique({
    where: {
      user_id_project_id: {
        user_id: req.user.id,
        project_id: moderation.project_id
      }
    }
  });
  if (!membership || membership.role !== 'editeur') {
    return res.status(403).json({ message: 'Seul un éditeur du projet peut approuver cette demande.' });
  }

  if (action === 'approve') {
    const payload = typeof moderation.payload === 'string' ? JSON.parse(moderation.payload) : moderation.payload;
    const { entity_type, action_type } = moderation;
    let entityId = moderation.entity_id;

    try {
      if (entity_type === 'taskType') {
        const mapped = {
          task_code: payload.taskId,
          task_name: payload.name,
          project_id: moderation.project_id,
          status: 'approved'
        };

         if (action_type === 'create') {
          const created = await prisma.taskType.create({ data: mapped });
          entityId = created.id;

          // Insert parentType relationship
          if (payload.parentType?.id) {
            await prisma.taskTypeRelation.create({
              data: {
                parent_task_id: payload.parentType.id,
                sub_task_id: created.id
              }
            });
          }

          // Insert association error
          if (payload.errors?.length) {
            await prisma.taskTypeErrorAssociation.createMany({
              data: payload.errors.map(e => ({
                error_id: e.id,
                task_type_id: created.id
              }))
            });
          }
        } else if (action_type === 'update') {
          await prisma.taskType.update({ where: { id: entityId }, data: mapped });

          // update parentType
          await prisma.taskTypeRelation.deleteMany({
            where: {
              OR: [
                { parent_task_id: entityId },
                { sub_task_id: entityId }
              ]
            }
          });
          if (payload.parentType?.id) {
            await prisma.taskTypeRelation.create({
              data: {
                parent_task_id: payload.parentType.id,
                sub_task_id: entityId
              }
            });
          }

          // Update error association
          await prisma.taskTypeErrorAssociation.deleteMany({ where: { task_type_id: entityId } });
          if (payload.errors?.length) {
            await prisma.taskTypeErrorAssociation.createMany({
              data: payload.errors.map(e => ({
                error_id: e.id,
                task_type_id: entityId
              }))
            });
          }
        } else if (action_type === 'delete') {
          await prisma.taskTypeRelation.deleteMany({ where: { OR: [{ parent_task_id: entityId }, { sub_task_id: entityId }] } });
          await prisma.taskTypeErrorAssociation.deleteMany({ where: { task_type_id: entityId } });
          await prisma.taskTypeExerciseAssociation.deleteMany({ where: { task_type_id: entityId } });
          await prisma.componentTaskType.deleteMany({ where: { task_type_id: entityId } });
          await prisma.taskType.delete({ where: { id: entityId } });
        }
      }

      else if (entity_type === 'error') {
        const mapped = {
          error_tag: payload.tag,
          description: payload.description,
          project_id: moderation.project_id,
          status: 'approved'
        };

        if (action_type === 'create') {
          const created = await prisma.error.create({ data: mapped });
          entityId = created.id;

          if (payload.associatedTypes?.length) {
            await prisma.taskTypeErrorAssociation.createMany({
              data: payload.associatedTypes.map(t => ({ error_id: entityId, task_type_id: t.id }))
            });
          }
        } else if (action_type === 'update') {
          await prisma.error.update({ where: { id: entityId }, data: mapped });

          await prisma.taskTypeErrorAssociation.deleteMany({ where: { error_id: entityId } });
          if (payload.associatedTypes?.length) {
            await prisma.taskTypeErrorAssociation.createMany({
              data: payload.associatedTypes.map(t => ({ error_id: entityId, task_type_id: t.id }))
            });
          }
        } else if (action_type === 'delete') {
          // First check if there is a component referencing this error
          const referencingComponents = await prisma.feedbackComponent.findMany({
            where: { error_id: entityId },
            select: { id: true, tag: true }
          });

          if (referencingComponents.length > 0) {
            throw new Error(
              `Deletion failed: This error is still used in components [${referencingComponents.map(c => `"${c.tag}"`).join(', ')}].`
            );
          }

          // If there is no reference, delete normally
          await prisma.taskTypeErrorAssociation.deleteMany({ where: { error_id: entityId } });
          await prisma.error.delete({ where: { id: entityId } });
        }

      }

      else if (entity_type === 'exercise') {
        const mapped = { ...payload, project_id: moderation.project_id, status: 'approved' };

        if (action_type === 'create') {
          const { taskTypes = [], ...exerciseData } = mapped;

          const created = await prisma.exercise.create({
            data: exerciseData
          });
          entityId = created.id;

          if (taskTypes.length > 0) {
            await prisma.taskTypeExerciseAssociation.createMany({
              data: taskTypes.map(tid => ({
                exercise_id: entityId,
                task_type_id: tid
              }))
            });
          }
        }

        else if (action_type === 'update') {
          const { taskTypes = [], ...exerciseData } = mapped;

          await prisma.exercise.update({
            where: { id: entityId },
            data: exerciseData
          });

          // Clear old associations before adding new ones
          await prisma.taskTypeExerciseAssociation.deleteMany({ where: { exercise_id: entityId } });

          if (taskTypes.length > 0) {
            await prisma.taskTypeExerciseAssociation.createMany({
              data: taskTypes.map(tid => ({
                exercise_id: entityId,
                task_type_id: tid
              }))
            });
          }
        }

        else if (action_type === 'delete') {
          // Delete related table records
          await prisma.taskTypeExerciseAssociation.deleteMany({ where: { exercise_id: entityId } });
          await prisma.componentExercise.deleteMany({ where: { exercise_id: entityId } });

          await prisma.exercise.delete({ where: { id: entityId } });
        }
      }


      else if (entity_type === 'component') {
        const {
          associatedTypes = [],
          associatedExercises = [],
          pointedError = [],
          ...componentData
        } = payload;

        const mapped = {
          ...componentData,
          error_id: pointedError.length > 0 ? pointedError[0].id : null,
          project_id: moderation.project_id,
          status: 'approved'
        };

        if (action_type === 'create') {
          const created = await prisma.feedbackComponent.create({ data: mapped });
          entityId = created.id;

          if (associatedTypes.length > 0) {
            await prisma.componentTaskType.createMany({
              data: associatedTypes.map(t => ({
                component_id: entityId,
                task_type_id: t.id
              }))
            });
          }

          if (associatedExercises.length > 0) {
            await prisma.componentExercise.createMany({
              data: associatedExercises.map(e => ({
                component_id: entityId,
                exercise_id: e.id
              }))
            });
          }
        }

        else if (action_type === 'update') {
          await prisma.feedbackComponent.update({
            where: { id: entityId },
            data: mapped
          });

          await prisma.componentTaskType.deleteMany({ where: { component_id: entityId } });
          await prisma.componentExercise.deleteMany({ where: { component_id: entityId } });

          if (associatedTypes.length > 0) {
            await prisma.componentTaskType.createMany({
              data: associatedTypes.map(t => ({
                component_id: entityId,
                task_type_id: t.id
              }))
            });
          }

          if (associatedExercises.length > 0) {
            await prisma.componentExercise.createMany({
              data: associatedExercises.map(e => ({
                component_id: entityId,
                exercise_id: e.id
              }))
            });
          }
        }

        else if (action_type === 'delete') {
          // Check if there is any feedback using this component
          const isUsedInFeedback = await prisma.feedbackComponentsMapping.findFirst({
            where: { component_id: entityId }
          });

          if (isUsedInFeedback) {
            throw new Error(`Cannot delete component ${entityId} because it is still used in feedback ID ${isUsedInFeedback.feedback_id}.`);
          }

          // No association, continue to delete all references and ontologies
          await prisma.$transaction([
            prisma.componentTaskType.deleteMany({ where: { component_id: entityId } }),
            prisma.componentExercise.deleteMany({ where: { component_id: entityId } }),
            prisma.feedbackComponentsMapping.deleteMany({ where: { component_id: entityId } }),
            prisma.feedbackComponent.delete({ where: { id: entityId } })
          ]);
        }
      }


    else if (entity_type === 'feedback') {
        const mapped = {
          feedback_code: payload.feedback_code,
          description: payload.description,
          project_id: moderation.project_id,
          status: 'approved'
        };

        if (action_type === 'create') {
          const created = await prisma.feedback.create({ data: mapped });
          entityId = created.id;

          if (payload.components?.length > 0) {
            await prisma.feedbackComponentsMapping.createMany({
              data: payload.components.map(c => ({
                feedback_id: created.id,
                component_id: c.id,
                position: c.position
              }))
            });
          }
        }

        else if (action_type === 'update') {
          await prisma.feedback.update({ where: { id: entityId }, data: mapped });

          await prisma.feedbackComponentsMapping.deleteMany({ where: { feedback_id: entityId } });

          if (payload.components?.length > 0) {
            await prisma.feedbackComponentsMapping.createMany({
              data: payload.components.map(c => ({
                feedback_id: entityId,
                component_id: c.id,
                position: c.position
              }))
            });
          }
        }

        else if (action_type === 'delete') {
          await prisma.feedbackComponentsMapping.deleteMany({ where: { feedback_id: entityId } });
          await prisma.feedback.delete({ where: { id: entityId } });
        }
    }


      await prisma.moderationRequest.update({
        where: { id },
        data: {
          status: 'approved',
          reason: null,
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
          entity_id: entityId
        }
      });

      return res.json({ message: 'Demande approuvée.' });
    } catch (err) {
      console.error('[APPROVE ERROR]', err);
      return res.status(500).json({ message: 'Erreur lors de l’application de la demande.' });
    }
  }

  // rejection
  const updated = await prisma.moderationRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      reason,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    }
  });

  return res.json(updated);
});

/**
 * @swagger
 * /api/moderations/{id}/messages:
 *   get:
 *     summary: Get messages of a moderation request
 *     tags: [ModerationMessages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the moderation request
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the project
 *     responses:
 *       200:
 *         description: List of moderation messages
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Error retrieving messages
 */
router.get('/:id/messages', verifyToken, checkProjectMembership, async (req, res) => {
  const moderationId = parseInt(req.params.id);
  const projectId = parseInt(req.query.projectId);

  try {
    const messages = await prisma.moderationMessage.findMany({
      where: {
        moderationId,
        moderation: {
          project_id: projectId,
        },
      },
      include: {
        sender: true,
      },
      orderBy: { created_at: 'asc' },
    });

    res.json(messages);
  } catch (e) {
    res.status(500).json({ message: 'Erreur lors de la récupération des messages.' });
  }
});


module.exports = router;
