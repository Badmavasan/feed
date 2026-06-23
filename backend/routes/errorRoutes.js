const express = require('express');
const { PrismaClient } = require('@prisma/client');
const verifyToken = require('../middlewares/verifyToken');
const { hasPermission } = require('../utils/permissions');
const { checkProjectMembership } = require('../utils/projectPermissions');

const multer = require('multer');
const xlsx = require('xlsx');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer();

/**
 * @swagger
 * /api/errors:
 *   get:
 *     summary: Get paginated list of approved errors in a project
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
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
      { error_tag: { contains: search } },
      { description: { contains: search } }
    ]
  };

  const total = await prisma.error.count({ where });
  const errors = await prisma.error.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { error_tag: 'asc' }
  });

  res.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    errors: errors.map(e => ({ id: e.id, tag: e.error_tag, description: e.description }))
  });
});

/**
 * @swagger
 * /api/errors/selectable:
 *   get:
 *     summary: Get approved errors in a project for selection
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/selectable', verifyToken, checkProjectMembership, async (req, res) => {
  const projectId = req.projectId;
  const search = req.query.search || '';

  const errors = await prisma.error.findMany({
    where: {
      status: 'approved',
      project_id: projectId,
      OR: [
        { error_tag: { contains: search } },
        { description: { contains: search } }
      ]
    }
  });

  res.json(errors.map(e => ({ id: e.id, tag: e.error_tag, description: e.description })));
});

/**
 * @swagger
 * /api/errors:
 *   post:
 *     summary: Create an error (approval if needed)
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tag, description, projectId]
 *             properties:
 *               tag:
 *                 type: string
 *               description:
 *                 type: string
 *               associatedTypes:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: Created or approval request submitted
 */
router.post('/', verifyToken, checkProjectMembership, async (req, res) => {
  const { tag, description, associatedTypes = [] } = req.body;
  const projectId = req.projectId;
  const user = req.user;

  const existing = await prisma.error.findFirst({ where: { error_tag: tag, project_id: projectId } });
  if (existing) return res.status(400).json({ message: 'This errorTag already exists' });

  const canDirect = user.role !== 'auteur' || await hasPermission(user.id, 'error', 'create', projectId);

  if (canDirect) {
    const created = await prisma.error.create({ data: { error_tag: tag, description, status: 'approved', project_id: projectId } });
    if (associatedTypes.length > 0) {
      await prisma.taskTypeErrorAssociation.createMany({
        data: associatedTypes.map(id => ({ error_id: created.id, task_type_id: id }))
      });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, description: true } });
    const types = await prisma.taskType.findMany({
      where: { errorAssociations: { some: { error_id: created.id } } },
      select: { id: true, task_code: true, task_name: true }
    });

    return res.json({
      message: 'Created successfully',
      error: {
        id: created.id,
        tag,
        description,
        associatedTypes: types.map(t => ({ id: t.id, taskId: t.task_code, name: t.task_name })),
        project
      }
    });
  }

  const typesDetails = await prisma.taskType.findMany({
    where: { id: { in: associatedTypes } },
    select: { id: true, task_code: true, task_name: true }
  });

  const moderation = await prisma.moderationRequest.create({
    data: {
      requester_id: user.id,
      entity_type: 'error',
      action_type: 'create',
      status: 'pending_review',
      project_id: projectId,
      payload: { tag, description, associatedTypes: typesDetails }
    }
  });

  return res.status(202).json({ message: 'Creation request submitted for approval', moderation_id: moderation.id });
});

/**
 * @swagger
 * /api/errors/{id}:
 *   put:
 *     summary: Update error (approval if needed)
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *       - in: query
 *         name: projectId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Success or submitted for review
 */
router.put('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const { tag, description, associatedTypes = [] } = req.body;
  const projectId = req.projectId;
  const user = req.user;

  const duplicate = await prisma.error.findFirst({ where: { error_tag: tag, id: { not: id }, project_id: projectId } });
  if (duplicate) return res.status(400).json({ message: 'Duplicate tag in this project' });

  const canUpdate = user.role !== 'auteur' || await hasPermission(user.id, 'error', 'update', projectId);

  if (!canUpdate) {
    const details = await prisma.taskType.findMany({
      where: { id: { in: associatedTypes } },
      select: { id: true, task_code: true, task_name: true }
    });

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: 'error',
        entity_id: id,
        action_type: 'update',
        status: 'pending_review',
        project_id: projectId,
        payload: { tag, description, associatedTypes: details }
      }
    });

    return res.json({ message: 'Update request submitted for approval' });
  }

  await prisma.error.update({ where: { id }, data: { error_tag: tag, description } });
  await prisma.taskTypeErrorAssociation.deleteMany({ where: { error_id: id } });

  if (associatedTypes.length > 0) {
    await prisma.taskTypeErrorAssociation.createMany({
      data: associatedTypes.map(typeId => ({ error_id: id, task_type_id: typeId }))
    });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, description: true } });
  const types = await prisma.taskType.findMany({
    where: { errorAssociations: { some: { error_id: id } } },
    select: { id: true, task_code: true, task_name: true }
  });

  res.json({
    message: 'Updated successfully',
    error: {
      id,
      tag,
      description,
      associatedTypes: types.map(t => ({ id: t.id, taskId: t.task_code, name: t.task_name })),
      project
    }
  });
});

/**
 * @swagger
 * /api/errors/{id}:
 *   delete:
 *     summary: Delete error (approval if needed)
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *       - in: query
 *         name: projectId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted or review submitted
 */
router.delete('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;
  const user = req.user;

  const error = await prisma.error.findFirst({ where: { id, project_id: projectId } });
  if (!error) return res.status(404).json({ message: 'Error not found' });

  // First check whether it is referenced by the component
  const linkedComponents = await prisma.feedbackComponent.findMany({
    where: { error_id: id },
    select: { id: true, tag: true }
  });

  if (linkedComponents.length > 0) {
    return res.status(400).json({
      message: "Cannot delete this error because it is still used by the following components.",
      components: linkedComponents.map(c => ({ id: c.id, tag: c.tag }))
    });
  }

  // Deletion permission judgment
  const canDelete = user.role !== 'auteur' || await hasPermission(user.id, 'error', 'delete', projectId);

  if (!canDelete) {
    const types = await prisma.taskType.findMany({
      where: { errorAssociations: { some: { error_id: id } } },
      select: { id: true, task_code: true, task_name: true }
    });

    await prisma.moderationRequest.create({
      data: {
        requester_id: user.id,
        entity_type: 'error',
        entity_id: id,
        action_type: 'delete',
        status: 'pending_review',
        project_id: projectId,
        payload: { tag: error.error_tag, description: error.description, associatedTypes: types }
      }
    });

    return res.json({ message: 'Delete request submitted for approval' });
  }

  // No reference + permission, then delete
  await prisma.taskTypeErrorAssociation.deleteMany({ where: { error_id: id } });
  await prisma.error.delete({ where: { id } });

  res.json({ message: 'Deleted successfully' });
});


/**
 * @swagger
 * /api/errors/import:
 *   post:
 *     summary: Import multiple errors from an Excel or CSV file
 *     description: Accepts an uploaded .xlsx or .csv file containing error data and creates them in the database. Duplicate tags will be skipped.
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the current project
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Excel or CSV file with 'Tag' and 'Description' columns
 *     responses:
 *       200:
 *         description: Import completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 createdCount:
 *                   type: integer
 *                 skippedCount:
 *                   type: integer
 *                 skipped:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tag:
 *                         type: string
 *                       reason:
 *                         type: string
 *       400:
 *         description: Missing file or invalid format
 *       500:
 *         description: Server error
 */

router.post('/import', verifyToken, checkProjectMembership, upload.single('file'), async (req, res) => {
  const projectId = parseInt(req.query.projectId?.toString());
  const file = req.file;
  const user = req.user;

  if (!projectId || !file) {
    return res.status(400).json({ message: 'Missing file or projectId.' });
  }

  try {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    let rows = [];

    if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(sheet);
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please upload .xlsx or .csv.' });
    }

    const created = [];
    const skipped = [];

    for (const row of rows) {
      const tag = row["Tag"]?.toString().trim();
      const description = row["Description"]?.toString().trim();

      if (!tag || !description) {
        skipped.push({ tag: tag || '(empty)', reason: 'Missing required fields' });
        continue;
      }

      const exists = await prisma.error.findFirst({
        where: {
          error_tag: tag,
          project_id: projectId
        }
      });

      if (exists) {
        skipped.push({ tag, reason: 'Duplicate tag' });
        continue;
      }

      await prisma.error.create({
        data: {
          error_tag: tag,
          description,
          project_id: projectId,
          status: 'approved'
        }
      });

      created.push(tag);
    }

    return res.status(200).json({
      message: 'Import completed',
      createdCount: created.length,
      skippedCount: skipped.length,
      skipped
    });
  } catch (error) {
    console.error('Error importing file:', error);
    return res.status(500).json({ message: 'An error occurred during import.' });
  }
});

/**
 * @swagger
 * /api/errors/template:
 *   get:
 *     summary: Download the Excel template for bulk error import
 *     description: Generates and returns an Excel (.xlsx) template with the required columns for error import.
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the project (for permission check)
 *     responses:
 *       200:
 *         description: Excel file returned successfully
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing or invalid projectId
 *       500:
 *         description: Server error
 */
router.get('/template', verifyToken, checkProjectMembership, async (req, res) => {
  const projectId = parseInt(req.query.projectId?.toString());
  if (!projectId) {
    return res.status(400).json({ message: 'Missing projectId' });
  }

  try {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      ["Tag", "Description"],
      ["absence-boucle", "L'élève n'a pas utilisé de boucle pour faire la somme."]
    ]);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Template");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=error_template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Failed to generate template:", error);
    res.status(500).json({ message: "Failed to generate template file" });
  }
});

/**
 * @swagger
 * /api/errors/{id}:
 *   get:
 *     summary: Get error detail by id
 *     tags: [Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *       - in: query
 *         name: projectId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:id', verifyToken, checkProjectMembership, async (req, res) => {
  const id = parseInt(req.params.id);
  const projectId = req.projectId;

  const error = await prisma.error.findFirst({ where: { id, project_id: projectId } });
  if (!error || error.status !== 'approved') return res.status(404).json({ message: 'Error not found' });

  const types = await prisma.taskType.findMany({
    where: { errorAssociations: { some: { error_id: id } } },
    select: { id: true, task_code: true, task_name: true }
  });

  res.json({
    id: error.id,
    tag: error.error_tag,
    description: error.description,
    associatedTypes: types.map(t => ({ id: t.id, taskId: t.task_code, name: t.task_name }))
  });
});



module.exports = router;